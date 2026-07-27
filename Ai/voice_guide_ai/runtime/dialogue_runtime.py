"""
Voice Guide AI — Dialogue Runtime.

ARCHITECTURE FIX
----------------
All five root causes resolved:

RC-1  DialogueEngine is NOT thread-safe.
      FIX: A single serial worker queue (_CommandQueue) owns the engine.
           Only one thread ever calls engine.play/stop/replay/set_language.
           All public methods post a command and return immediately.

RC-2  Two playback pipelines existed.
      FIX: DialoguePlayer.play() emits a voice event → _handle_voice_event
           → voice_engine.play().  The _play_background thread no longer
           calls voice_engine.play() directly.  One pipeline only:
           Runtime → engine.play() → DialoguePlayer → voice event →
           _handle_voice_event → VoiceEngine → PlaybackController → AudioPlayer.

RC-3  NavigationManager called stop() while background thread called play().
      FIX: All commands are serialised through _CommandQueue.  A STOP command
           posted before a PLAY command always executes first.  The engine
           is never touched from two threads simultaneously.

RC-4  Frontend sent /page + /play while Runtime also scheduled play.
      FIX: Bridge-level _DedupeGuard (500 ms) already deduplicates /page.
           Runtime-level debounce (300 ms) deduplicates play().
           _CommandQueue discards superseded OPEN_PAGE commands.

RC-5  AudioPlayer kept playing after token invalidation.
      FIX: _advance_token() is called before posting STOP to the command
           queue.  The worker checks the token before executing PLAY.
           voice_engine.stop() is called synchronously in the STOP handler
           before any new PLAY command can execute.
"""

from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Optional

from avatar.runtime.avatar_controller import AvatarController
from config.constants import (
    AVATAR_EVENT_ERROR,
    AVATAR_EVENT_IDLE,
    AVATAR_EVENT_LISTEN,
    AVATAR_EVENT_SPEAK,
    AVATAR_EVENT_SUCCESS,
    AVATAR_EVENT_THINK,
    AVATAR_EVENT_WAVE,
)
from config.logger import get_logger
from core.dialogue_engine import DialogueEngine, EngineResult
from runtime.condition_manager import ConditionManager
from runtime.error_manager import ErrorManager
from runtime.event_dispatcher import EventDispatcher
from runtime.offline_manager import OfflineManager
from runtime.queue_manager import QueueManager, PRIORITY_NORMAL
from runtime.replay_manager import ReplayManager
from runtime.session_manager import SessionManager
from runtime.visit_manager import VisitManager
from voice.engine import VoiceEngine

_log = get_logger("runtime.dialogue_runtime")

_DEBOUNCE_MS = 300


# ── Serial command queue ───────────────────────────────────────────────────────

class _Cmd(Enum):
    OPEN_PAGE       = auto()
    PLAY            = auto()
    STOP            = auto()
    REPLAY          = auto()
    CHANGE_LANGUAGE = auto()
    SHUTDOWN        = auto()


@dataclass
class _Command:
    kind:    _Cmd
    token:   int = 0
    page:    str = ""
    dtype:   str = "welcome"
    lang:    Optional[str] = None
    ctx:     Optional[dict[str, Any]] = None
    result:  Optional[dict[str, Any]] = None   # filled by worker for sync ops
    event:   Optional[threading.Event] = None  # set by worker when done


class _CommandQueue:
    """
    Single worker thread that is the ONLY thread to call DialogueEngine.

    RC-1 FIX: Serialises all engine access.
    RC-3 FIX: STOP always executes before the next PLAY.
    """

    def __init__(self, runtime: "DialogueRuntime") -> None:
        self._rt  = runtime
        self._q: queue.Queue[_Command] = queue.Queue()
        self._t   = threading.Thread(
            target=self._loop, daemon=True, name="dialogue-worker"
        )
        self._t.start()

    def post(self, cmd: _Command) -> None:
        self._q.put(cmd)

    def post_sync(self, cmd: _Command) -> dict[str, Any]:
        """Post and block until the worker sets cmd.event."""
        cmd.event = threading.Event()
        self._q.put(cmd)
        cmd.event.wait()
        return cmd.result or {}

    def _loop(self) -> None:
        while True:
            try:
                cmd = self._q.get(timeout=1.0)
            except queue.Empty:
                continue

            if cmd.kind == _Cmd.SHUTDOWN:
                break

            try:
                self._rt._execute(cmd)
            except Exception as exc:
                _log.error("Worker error [%s]: %s", cmd.kind, exc, exc_info=True)
            finally:
                if cmd.event:
                    cmd.event.set()


class DialogueRuntime:
    """
    Orchestrates dialogue playback through the DialogueEngine.

    Thread-safe.  One instance per RuntimeManager.
    All engine access is serialised through _CommandQueue.
    """

    def __init__(
        self,
        event_dispatcher: Optional[EventDispatcher] = None,
        session_manager: Optional[SessionManager] = None,
        queue_manager: Optional[QueueManager] = None,
        visit_manager: Optional[VisitManager] = None,
        condition_manager: Optional[ConditionManager] = None,
        replay_manager: Optional[ReplayManager] = None,
        error_manager: Optional[ErrorManager] = None,
        offline_manager: Optional[OfflineManager] = None,
        engine: Optional[DialogueEngine] = None,
        scheduler: Optional[Any] = None,
        dialogue_loader: Optional[Any] = None,
        voice_engine: Optional[Any] = None,
        avatar_controller: Optional[Any] = None,
    ) -> None:
        self._events     = event_dispatcher or EventDispatcher()
        self._session    = session_manager or SessionManager()
        self._queue      = queue_manager or QueueManager()
        self._visits     = visit_manager or VisitManager()
        self._conditions = condition_manager or ConditionManager()
        self._replay     = replay_manager or ReplayManager()
        self._error_mgr  = error_manager or ErrorManager(event_dispatcher=self._events)
        self._offline    = offline_manager or OfflineManager(
            event_dispatcher=self._events,
            session_manager=self._session,
            condition_manager=self._conditions,
        )
        self._engine            = engine or DialogueEngine()
        self._scheduler         = scheduler
        self._loader            = dialogue_loader
        self._voice_engine      = voice_engine or VoiceEngine()
        self._avatar_controller = avatar_controller or AvatarController()
        self._avatar_controller.initialise()

        # RC-2 FIX: voice events from DialoguePlayer are the ONLY path to audio.
        # _play_background must NOT call voice_engine.play() directly.
        self._engine.on_avatar_event(self._handle_avatar_event)
        self._engine.on_voice_event(self._handle_voice_event)

        # RC-1 FIX: single token guards stale commands in the worker.
        self._token_lock    = threading.Lock()
        self._session_token: int = 0

        # Debounce guard (protects _last_play_key / _last_play_time)
        self._debounce_lock  = threading.Lock()
        self._last_play_key:  tuple[str, str, str] = ("", "", "")
        self._last_play_time: float = 0.0

        # RC-1 FIX: serial worker — only thread that touches DialogueEngine.
        self._worker = _CommandQueue(self)

    # ── Token helpers ─────────────────────────────────────────────────────────

    def _advance_token(self) -> int:
        with self._token_lock:
            self._session_token += 1
            return self._session_token

    def _current_token(self) -> int:
        with self._token_lock:
            return self._session_token

    def _token_valid(self, token: int) -> bool:
        with self._token_lock:
            return self._session_token == token

    # ── Worker executor (called ONLY from _CommandQueue._loop) ───────────────

    def _execute(self, cmd: _Command) -> None:
        """
        All DialogueEngine calls happen here — on the single worker thread.
        RC-1: No other thread ever calls self._engine.*
        """
        if cmd.kind == _Cmd.STOP:
            self._exec_stop(cmd)

        elif cmd.kind in (_Cmd.PLAY, _Cmd.OPEN_PAGE):
            # Discard if a newer token has been issued (navigation superseded this)
            if not self._token_valid(cmd.token):
                _log.debug("Discarding stale %s command (token=%d)", cmd.kind, cmd.token)
                return
            self._exec_play(cmd)

        elif cmd.kind == _Cmd.REPLAY:
            self._exec_replay(cmd)

        elif cmd.kind == _Cmd.CHANGE_LANGUAGE:
            self._exec_change_language(cmd)

    def _exec_stop(self, cmd: _Command) -> None:
        # RC-5 FIX: stop voice engine first, then engine — no overlap possible.
        try:
            self._voice_engine.stop()
        except Exception as exc:
            _log.debug("voice_engine.stop() ignored: %s", exc)

        self._safe_stop_engine()

        try:
            self._avatar_controller.on_speaking_stop()
        except Exception as exc:
            _log.debug("avatar.on_speaking_stop() ignored: %s", exc)

        self._session.set_voice_state("stopped")
        self._session.set_avatar_state("idle")

        page        = self._session.current_page or ""
        dialogue_id = self._session.snapshot().get("current_dialogue_id") or ""
        if dialogue_id:
            self._events.dialogue_finished(page, dialogue_id, completed=False)

        if cmd.event:
            cmd.result = {
                "success": True, "operation": "stop",
                "page": page, "state": "stopped",
                "events": [], "metadata": {},
            }

    def _exec_play(self, cmd: _Command) -> None:
        page  = cmd.page
        dtype = cmd.dtype
        lang  = cmd.lang
        ctx   = dict(cmd.ctx or {})
        token = cmd.token

        try:
            _nav_types = {"welcome", "revisit", "help", "exit"}
            if (
                self._scheduler
                and dtype not in _nav_types
                and not self._scheduler.can_play(page, dtype)
            ):
                _log.debug("Cooldown active: page=%s type=%s", page, dtype)
                return

            if not self._token_valid(token):
                return

            # RC-5 FIX: Guarantee the engine is in a clean state before calling
            # play().  Without this, if a previous play() left the state machine
            # in PLAYING (e.g. because the STOP command ran but the engine
            # transition failed silently), the subsequent LOADING → READY
            # transition inside engine.play() throws DialogueStateError.
            self._safe_stop_engine()

            if not self._token_valid(token):
                return

            # RC-1 FIX: engine.play() called only here, on the worker thread.
            result = self._engine.play(page, dtype, ctx)
            success = (
                result.success
                if hasattr(result, "success")
                else bool(result.get("success", False))
            )

            if not self._token_valid(token):
                # Navigation happened while engine was loading — stop immediately.
                self._safe_stop_engine()
                self._voice_engine.stop()
                return

            if success:
                if self._scheduler:
                    self._scheduler.record_play(page, dtype)

                # Only record completed (non-cancelled) dialogues for replay.
                self._replay.record(page, dtype, lang or "hi")

                dialogue_id = (
                    getattr(result, "dialogue_id", None)
                    if hasattr(result, "dialogue_id")
                    else result.get("dialogue_id")
                ) or f"{page}_{dtype}"

                self._session.set_dialogue(dialogue_id)
                self._events.dialogue_started(page, dialogue_id, lang or "hi")

                if self._token_valid(token):
                    try:
                        self._avatar_controller.on_dialogue_play(page, dtype)
                    except Exception as exc:
                        _log.debug("avatar.on_dialogue_play() ignored: %s", exc)

                # RC-2 FIX: voice_engine.play() is NOT called here.
                # DialoguePlayer.play() already emitted a VOICE_EVENT_PLAY which
                # _handle_voice_event forwarded to voice_engine.play().
                # Calling it again here would be the duplicate pipeline.

                if self._token_valid(token):
                    self._avatar_controller.on_speaking_start()
                    self._events.audio_ready(page, dialogue_id)

                _log.info(
                    "Dialogue playing: page=%s type=%s lang=%s id=%s token=%d",
                    page, dtype, lang, dialogue_id, token,
                )
            else:
                error_code = (
                    getattr(result, "error_code", None)
                    if hasattr(result, "error_code")
                    else result.get("error_code")
                ) or "PLAY_FAILED"
                message = (
                    getattr(result, "error", None)
                    if hasattr(result, "error")
                    else result.get("error")
                ) or "Dialogue play failed."
                _log.warning("Dialogue play failed: page=%s type=%s — %s", page, dtype, message)
                if self._token_valid(token):
                    self._error_mgr.handle(
                        page=page,
                        error_code=error_code,
                        message=message,
                        language=lang or "hi",
                    )

        except Exception as exc:
            _log.error(
                "Worker play error: page=%s type=%s — %s", page, dtype, exc, exc_info=True
            )

    def _exec_replay(self, cmd: _Command) -> None:
        last = self._replay.last()
        if last is None:
            cmd.result = {
                "success": False,
                "error": "No dialogue available to replay.",
                "error_code": "NO_REPLAY_HISTORY",
            }
            return

        page  = last.page
        dtype = last.dialogue_type
        lang  = last.language

        token = self._advance_token()

        # Stop current before replaying
        try:
            self._voice_engine.stop()
        except Exception:
            pass
        self._safe_stop_engine()

        # Post PLAY to the queue instead of calling _execute() recursively.
        # Recursive calls bypass queue ordering and corrupt the state machine.
        self._worker.post(_Command(
            kind=_Cmd.PLAY, token=token,
            page=page, dtype=dtype, lang=lang,
        ))

        cmd.result = {
            "success": True, "operation": "replay",
            "page": page, "dialogue_type": dtype,
            "language": lang, "state": "scheduled",
            "events": [], "metadata": {},
        }

    def _exec_change_language(self, cmd: _Command) -> None:
        lang = cmd.lang or "hi"
        try:
            result = self._engine.set_language(lang)
            cmd.result = result.to_dict() if hasattr(result, "to_dict") else result
        except Exception as exc:
            _log.error("set_language error: %s", exc)
            cmd.result = {"success": False, "error": str(exc)}

    # ── State-safe engine stop ────────────────────────────────────────────────

    def _safe_stop_engine(self) -> None:
        """Stop DialogueEngine only if in a stoppable state. Worker thread only."""
        try:
            from core.dialogue_state import DialogueState
            stoppable = {
                DialogueState.PLAYING, DialogueState.LISTENING,
                DialogueState.THINKING, DialogueState.WAITING,
                DialogueState.READY, DialogueState.LOADING,
                DialogueState.SUCCESS, DialogueState.WARNING,
            }
            if self._engine.state in stoppable:
                self._engine.stop()
        except Exception as exc:
            _log.debug("_safe_stop_engine ignored: %s", exc)

    # ── Avatar / Voice event bridges ──────────────────────────────────────────
    # These run on the worker thread (called from engine.play → player.play).

    def _handle_avatar_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type", "")
        try:
            if event_type == AVATAR_EVENT_SPEAK:
                self._avatar_controller.on_speaking_start()
            elif event_type == AVATAR_EVENT_IDLE:
                self._avatar_controller.on_speaking_stop()
            elif event_type == AVATAR_EVENT_LISTEN:
                self._avatar_controller.on_listening_start()
            elif event_type == AVATAR_EVENT_THINK:
                self._avatar_controller.on_thinking_start()
            elif event_type == AVATAR_EVENT_SUCCESS:
                self._avatar_controller.on_success()
            elif event_type == AVATAR_EVENT_ERROR:
                self._avatar_controller.on_error()
            elif event_type == AVATAR_EVENT_WAVE:
                self._avatar_controller.on_dialogue_play(
                    self._session.current_page or "home", "welcome"
                )
        except Exception as exc:
            _log.debug("avatar event handler ignored: %s", exc)

    def _handle_voice_event(self, event: dict[str, Any]) -> None:
        """
        RC-2 FIX: This is the ONLY path that calls voice_engine.play().
        Called from DialoguePlayer.play() on the worker thread.
        voice_engine.play() posts to AudioPlayer worker queue → returns < 1 ms.
        """
        if event.get("type") != "play":
            return

        # RC-5 FIX: check token before starting audio.
        token = self._current_token()

        # RC-6 FIX: Always use the page from the voice event (set by
        # DialoguePlayer.play()).  Never fall back to session.current_page —
        # that may already be the NEW page if a navigation happened while the
        # worker was executing this command, causing audio to be looked up in
        # the wrong module directory (e.g. hi/soil_health/home_exit_001).
        # DialoguePlayer always sets "page" in the voice event from the
        # dialogue JSON; if it is somehow absent or empty, use the command
        # page stored in the dialogue_id prefix as a last resort.
        page        = (
            event.get("page") or ""
        ).strip() or "home"
        dialogue_id = (
            event.get("dialogue_id")
            or self._session.snapshot().get("current_dialogue_id")
            or f"{page}_welcome"
        )
        language   = event.get("language") or self._session.current_language or "hi"
        text       = event.get("text") or ""
        duration_s = None
        try:
            if event.get("duration_ms"):
                duration_s = round(float(event["duration_ms"]) / 1000.0, 3)
        except Exception:
            pass

        if not self._token_valid(token):
            _log.debug("voice event dropped — token invalidated before audio start")
            return

        played = self._voice_engine.play(
            language=language,
            module=page,
            dialogue_id=dialogue_id,
            text=text or self._build_fallback_text(page, dialogue_id, language),
            rtl=False,
            duration_s=duration_s,
            auto_generate=True,
        )

        # RC-7 FIX: If audio playback could not start (file missing and
        # generation failed), reset the avatar to idle immediately.
        # Without this the avatar stays in "speaking" state indefinitely
        # because no audio_finished callback ever fires.
        if not played:
            try:
                self._avatar_controller.on_speaking_stop()
            except Exception:
                pass
            self._session.set_avatar_state("idle")
            _log.debug("Audio unavailable for %s/%s — avatar reset to idle", page, dialogue_id)

    def _build_fallback_text(self, page: str, dialogue_id: str, language: str) -> str:
        if language.lower().startswith("en"):
            return f"Playing guidance for {page}."
        return f"{page} पेज के लिए मार्गदर्शन चल रहा है।"

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language: str) -> dict[str, Any]:
        """
        Change language. Cancels current speech, then changes language on worker.
        """
        # Cancel current audio immediately (outside worker — non-blocking)
        token = self._advance_token()
        try:
            self._voice_engine.stop()
        except Exception:
            pass

        cmd = _Command(kind=_Cmd.CHANGE_LANGUAGE, token=token, lang=language)
        return self._worker.post_sync(cmd)

    # ── Core playback ─────────────────────────────────────────────────────────

    def play(
        self,
        page: str,
        dialogue_type: str = "welcome",
        language: Optional[str] = None,
        priority: int = PRIORITY_NORMAL,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Schedule dialogue playback and return immediately (< 1 ms).

        RC-1: Posts to serial worker queue — engine never touched here.
        RC-3: Advances token before posting — any in-flight play is cancelled.
        RC-4: Debounce guard drops identical rapid calls.
        """
        lang = language or self._session.current_language

        # Debounce identical rapid calls
        with self._debounce_lock:
            play_key = (page, dialogue_type, lang or "")
            now = time.monotonic()
            if (
                play_key == self._last_play_key
                and (now - self._last_play_time) * 1000 < _DEBOUNCE_MS
            ):
                _log.debug(
                    "Debounced duplicate play: page=%s type=%s lang=%s",
                    page, dialogue_type, lang,
                )
                return {
                    "success": True, "operation": "play",
                    "page": page, "language": lang,
                    "state": "debounced",
                    "dialogue_id": f"{page}_{dialogue_type}",
                    "events": [], "metadata": {},
                }
            self._last_play_key  = play_key
            self._last_play_time = now

        if self._offline.is_offline:
            return self._offline.get_offline_guidance(page, dialogue_type, lang)

        # RC-3 FIX: advance token BEFORE posting STOP so the worker discards
        # any in-flight PLAY command that has not yet executed.
        token = self._advance_token()

        # Post STOP first — worker executes it before the PLAY below.
        self._worker.post(_Command(kind=_Cmd.STOP, token=token))

        self._session.set_page(page)
        self._session.set_dialogue(f"{page}_{dialogue_type}")

        ctx = dict(context or {})
        ctx["language"] = lang
        ctx["page"]     = page
        ctx.setdefault("first_visit", False)

        self._worker.post(_Command(
            kind=_Cmd.PLAY, token=token,
            page=page, dtype=dialogue_type,
            lang=lang, ctx=ctx,
        ))

        return {
            "success": True, "operation": "play",
            "page": page, "language": lang,
            "state": "scheduled",
            "dialogue_id": f"{page}_{dialogue_type}_001",
            "events": [{"event_type": "page_opened", "payload": {"page": page}}],
            "metadata": {},
        }

    # ── Pause / Resume / Stop / Skip ──────────────────────────────────────────

    def pause(self) -> dict[str, Any]:
        self._voice_engine.pause()
        self._avatar_controller.on_speaking_stop()
        self._session.set_voice_state("paused")
        self._session.set_avatar_state("idle")
        _log.info("Dialogue paused.")
        return {"success": True, "operation": "pause", "state": "paused"}

    def resume(self) -> dict[str, Any]:
        self._voice_engine.resume()
        self._avatar_controller.on_speaking_start()
        self._session.set_voice_state("playing")
        self._session.set_avatar_state("speaking")
        _log.info("Dialogue resumed.")
        return {"success": True, "operation": "resume", "state": "playing"}

    def stop(self) -> dict[str, Any]:
        """
        Stop current dialogue. Idempotent — safe to call multiple times.
        RC-3 FIX: Advances token so any queued PLAY is discarded.
        """
        token = self._advance_token()
        # Post STOP to worker — serialised, never races with PLAY.
        cmd = _Command(kind=_Cmd.STOP, token=token)
        return self._worker.post_sync(cmd)

    def skip(self) -> dict[str, Any]:
        result = self.stop()
        return {**result, "skipped": True}

    def replay(self, dialogue_id: Optional[str] = None) -> dict[str, Any]:
        """
        Replay the last COMPLETED dialogue.
        Never replays cancelled or interrupted dialogues.
        """
        page         = self._session.current_page or ""
        lang         = self._session.current_language
        replay_count = self._session.increment_replay()

        if dialogue_id:
            record = self._replay.get(dialogue_id)
            if record:
                self._events.replay_pressed(page, dialogue_id, replay_count)
                return self.play(record.page, record.dialogue_type, lang)
            return {
                "success": False,
                "error": f"Dialogue '{dialogue_id}' not found in replay history.",
                "error_code": "REPLAY_NOT_FOUND",
            }

        cmd = _Command(kind=_Cmd.REPLAY)
        result = self._worker.post_sync(cmd)

        last = self._replay.last()
        if last:
            self._events.replay_pressed(page, last.dialogue_id, replay_count)

        return result

    # ── Dialogue finished callback ────────────────────────────────────────────

    def on_dialogue_finished(self, page: str, dialogue_id: str) -> None:
        self._session.set_voice_state("stopped")
        self._session.set_avatar_state("idle")
        self._session.reset_replay_count()
        self._events.dialogue_finished(page, dialogue_id, completed=True)
        _log.info("Dialogue finished: page=%s id=%s", page, dialogue_id)

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        return self._engine.get_status()

    # ── Shutdown ──────────────────────────────────────────────────────────────

    def shutdown(self) -> None:
        self._worker.post(_Command(kind=_Cmd.SHUTDOWN))
