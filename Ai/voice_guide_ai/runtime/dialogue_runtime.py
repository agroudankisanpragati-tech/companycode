"""
Voice Guide AI — Dialogue Runtime.

Drives the DialogueEngine through the queue, handling:
  * play / pause / resume / stop / skip
  * replay (last dialogue or specific dialogue_id)
  * language switching
  * offline fallback
  * error recovery
  * cooldown enforcement via Scheduler
  * cached dialogue loading via DialogueLoader
  * event dispatching for every lifecycle transition

This is the bridge between the high-level RuntimeManager and the
low-level DialogueEngine (core layer).
"""

from __future__ import annotations

import threading
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
from runtime.queue_manager import QueueManager, PRIORITY_NORMAL, PRIORITY_CRITICAL
from runtime.replay_manager import ReplayManager
from runtime.session_manager import SessionManager
from runtime.visit_manager import VisitManager
from voice.engine import VoiceEngine

_log = get_logger("runtime.dialogue_runtime")


class DialogueRuntime:
    """
    Orchestrates dialogue playback through the DialogueEngine.

    Thread-safe.  One instance per RuntimeManager.
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
        self._events = event_dispatcher or EventDispatcher()
        self._session = session_manager or SessionManager()
        self._queue = queue_manager or QueueManager()
        self._visits = visit_manager or VisitManager()
        self._conditions = condition_manager or ConditionManager()
        self._replay = replay_manager or ReplayManager()
        self._error_mgr = error_manager or ErrorManager(event_dispatcher=self._events)
        self._offline = offline_manager or OfflineManager(
            event_dispatcher=self._events,
            session_manager=self._session,
            condition_manager=self._conditions,
        )
        self._engine = engine or DialogueEngine()
        self._scheduler = scheduler          # Optional[Scheduler]
        self._loader = dialogue_loader       # Optional[DialogueLoader]
        self._voice_engine = voice_engine or VoiceEngine()
        self._avatar_controller = avatar_controller or AvatarController()
        self._avatar_controller.initialise()
        self._engine.on_avatar_event(self._handle_avatar_event)
        self._engine.on_voice_event(self._handle_voice_event)
        self._lock = threading.Lock()

    # ── Runtime event bridges ───────────────────────────────────────────────

    def _handle_avatar_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type", "")
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
                self._session.current_page or "home",
                "welcome",
            )

    def _handle_voice_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type", "")
        if event_type != "play":
            return

        page = self._session.current_page or "home"
        dialogue_id = event.get("dialogue_id") or self._session.snapshot().get("current_dialogue_id") or f"{page}_welcome"
        language = event.get("language") or self._session.current_language or "hi"
        text = event.get("text") or ""
        duration_s = None
        try:
            if event.get("duration_ms"):
                duration_s = round(float(event["duration_ms"]) / 1000.0, 3)
        except Exception:
            duration_s = None

        self._voice_engine.play(
            language=language,
            module=page,
            dialogue_id=dialogue_id,
            text=text or self._build_fallback_text(page, dialogue_id, language),
            rtl=False,
            duration_s=duration_s,
            auto_generate=True,
        )
        self._events.audio_ready(page, dialogue_id)

    def _build_fallback_text(self, page: str, dialogue_id: str, language: str) -> str:
        if language.lower().startswith("en"):
            return f"Playing guidance for {page}."
        return f"{page} पेज के लिए मार्गदर्शन चल रहा है।"

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language: str) -> dict[str, Any]:
        """Update the engine language and return result dict."""
        result = self._engine.set_language(language)
        return result.to_dict()

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
        Enqueue and immediately play a dialogue.

        Checks cooldown via Scheduler (if wired), delegates to
        OfflineManager when offline, and ErrorManager on failure.

        Returns
        -------
        dict — EngineResult.to_dict() or error/offline result
        """
        with self._lock:
            lang = language or self._session.current_language

            if self._offline.is_offline:
                return self._offline.get_offline_guidance(page, dialogue_type, lang)

            self._avatar_controller.initialise()

            # Cooldown check — skip for navigation-triggered dialogues (welcome/revisit/help)
            # so that rapid page changes are never silently dropped.
            _nav_types = {"welcome", "revisit", "help", "exit"}
            if self._scheduler and dialogue_type not in _nav_types and not self._scheduler.can_play(page, dialogue_type):
                _log.debug(
                    "Cooldown active — skipping: page=%s type=%s", page, dialogue_type
                )
                return {
                    "success": False,
                    "operation": "play",
                    "page": page,
                    "language": lang,
                    "state": "cooldown",
                    "error": "Dialogue on cooldown.",
                    "error_code": "COOLDOWN_ACTIVE",
                    "events": [],
                    "metadata": {},
                }

            ctx = dict(context or {})
            ctx["language"] = lang
            ctx["page"] = page

            self._engine.set_language(lang)
            self._session.set_dialogue(f"{page}_{dialogue_type}")

            # Ensure any earlier playback is stopped before starting a new one.
            try:
                self._voice_engine.stop()
            except Exception:
                pass
            try:
                self._engine.stop()
            except Exception:
                pass
            self._avatar_controller.on_speaking_stop()

            result = self._engine.play(page, dialogue_type, ctx)
            success = result.success if hasattr(result, "success") else bool(result.get("success", False))
            if success and self._avatar_controller:
                self._avatar_controller.on_dialogue_play(page, dialogue_type)

            if success:
                if self._scheduler:
                    self._scheduler.record_play(page, dialogue_type)
                self._replay.record(page, dialogue_type, lang)
                dialogue_id = (
                    getattr(result, "dialogue_id", None)
                    if hasattr(result, "dialogue_id")
                    else result.get("dialogue_id")
                ) or f"{page}_{dialogue_type}"
                self._session.set_dialogue(dialogue_id)
                self._events.dialogue_started(page, dialogue_id, lang)

                dialogue_data = getattr(self._engine, "_current_dialogue", None)
                text = None
                if isinstance(dialogue_data, dict):
                    text = dialogue_data.get("text") or dialogue_data.get("content") or ""
                if not text and isinstance(result, dict):
                    text = result.get("text") or ""
                if not text:
                    text = self._build_fallback_text(page, dialogue_id, lang)

                self._voice_engine.play(
                    language=lang,
                    module=page,
                    dialogue_id=dialogue_id,
                    text=text,
                    rtl=False,
                    duration_s=None,
                    auto_generate=True,
                )
                self._avatar_controller.on_speaking_start()
                self._events.audio_ready(page, dialogue_id)

                _log.info(
                    "Dialogue started: page=%s type=%s lang=%s id=%s",
                    page, dialogue_type, lang, dialogue_id,
                )
            else:
                recovered = self._error_mgr.handle(
                    page=page,
                    error_code=(getattr(result, "error_code", None) if hasattr(result, "error_code") else result.get("error_code")) or "PLAY_FAILED",
                    message=(getattr(result, "error", None) if hasattr(result, "error") else result.get("error")) or "Dialogue play failed.",
                    language=lang,
                )
                if recovered:
                    return recovered

            if hasattr(result, "to_dict"):
                return result.to_dict()
            return result

    def pause(self) -> dict[str, Any]:
        """Pause the currently playing dialogue."""
        with self._lock:
            result = self._engine.pause()
            if result.success:
                self._session.set_voice_state("paused")
                self._session.set_avatar_state("idle")
                self._voice_engine.pause()
                self._avatar_controller.on_speaking_stop()
                _log.info("Dialogue paused.")
            return result.to_dict()

    def resume(self) -> dict[str, Any]:
        """Resume a paused dialogue."""
        with self._lock:
            result = self._engine.resume()
            if result.success:
                self._session.set_voice_state("playing")
                self._session.set_avatar_state("speaking")
                self._voice_engine.resume()
                self._avatar_controller.on_speaking_start()
                _log.info("Dialogue resumed.")
            return result.to_dict()

    def stop(self) -> dict[str, Any]:
        """Stop the current dialogue."""
        with self._lock:
            result = self._engine.stop()
            self._session.set_voice_state("stopped")
            self._session.set_avatar_state("idle")
            self._voice_engine.stop()
            self._avatar_controller.on_speaking_stop()
            page = self._session.current_page or ""
            dialogue_id = self._session.snapshot().get("current_dialogue_id") or ""
            if dialogue_id:
                self._events.dialogue_finished(page, dialogue_id, completed=False)
            _log.info("Dialogue stopped.")
            return result.to_dict()

    def skip(self) -> dict[str, Any]:
        """Skip the current dialogue (stop + mark as skipped)."""
        with self._lock:
            page = self._session.current_page or ""
            dialogue_id = self._session.snapshot().get("current_dialogue_id") or ""
            result = self._engine.stop()
            self._session.set_voice_state("stopped")
            self._session.set_avatar_state("idle")
            self._voice_engine.stop()
            self._avatar_controller.on_speaking_stop()
            if dialogue_id:
                self._events.dialogue_finished(page, dialogue_id, completed=False)
            _log.info("Dialogue skipped: page=%s id=%s", page, dialogue_id)
            return {**result.to_dict(), "skipped": True}

    def replay(self, dialogue_id: Optional[str] = None) -> dict[str, Any]:
        """
        Replay the last dialogue or a specific dialogue by ID.

        Uses ReplayManager records directly so the exact page + dialogue_type
        are replayed — never re-derived from a string-parsed dialogue_id.
        """
        with self._lock:
            page = self._session.current_page or ""
            lang = self._session.current_language
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

            last = self._replay.last()
            if last is None:
                return {
                    "success": False,
                    "error": "No dialogue available to replay.",
                    "error_code": "NO_REPLAY_HISTORY",
                }

            self._events.replay_pressed(page, last.dialogue_id, replay_count)
            # Replay using the stored page + dialogue_type — not string-parsed
            _log.info(
                "Replay: page=%s type=%s lang=%s count=%d",
                last.page, last.dialogue_type, lang, replay_count,
            )
            return self.play(last.page, last.dialogue_type, lang)

    # ── Dialogue finished callback ────────────────────────────────────────────

    def on_dialogue_finished(self, page: str, dialogue_id: str) -> None:
        """
        Called by the player/voice engine when a dialogue completes naturally.

        Dispatches dialogue_finished event and resets voice/avatar state.
        """
        self._session.set_voice_state("stopped")
        self._session.set_avatar_state("idle")
        self._session.reset_replay_count()
        self._events.dialogue_finished(page, dialogue_id, completed=True)
        _log.info("Dialogue finished: page=%s id=%s", page, dialogue_id)

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict[str, Any]:
        """Return engine status snapshot."""
        return self._engine.get_status()
