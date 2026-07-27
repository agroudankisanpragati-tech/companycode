"""
Voice Guide AI — Dialogue Engine.

RC-2 FIX: DialogueEngine is now a pure dialogue selector / state machine.
  * play()  → loads dialogue, validates, transitions state, calls player.play()
  * player.play() emits VOICE_EVENT_PLAY → DialogueRuntime._handle_voice_event
    → VoiceEngine.play()  (single pipeline)
  * DialogueEngine NEVER calls VoiceEngine or AudioPlayer directly.

Thread-safety: NOT thread-safe by design.
  DialogueRuntime._CommandQueue ensures only one thread ever calls this class.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.exceptions import (
    DialogueConditionError,
    DialogueEngineError,
    DialogueNotFoundError,
    DialogueStateError,
    DialogueValidationError,
    UnsupportedLanguageError,
)
from config.logger import get_logger, log_performance
from config.settings import SETTINGS
from core.dialogue_condition import DialogueCondition
from core.dialogue_history import DialogueHistory
from core.dialogue_player import DialoguePlayer, EventCallback
from core.dialogue_selector import DialogueSelector
from core.dialogue_state import DialogueState, DialogueStateMachine
from utils.helper import Helper
from utils.language_manager import LanguageManager
from utils.validation import Validator

_log = get_logger("dialogue_engine")


@dataclass
class EngineResult:
    """Structured response returned by every engine operation."""

    success:      bool
    operation:    str
    dialogue_id:  Optional[str] = None
    page:         Optional[str] = None
    language:     Optional[str] = None
    state:        Optional[str] = None
    error:        Optional[str] = None
    error_code:   Optional[str] = None
    events:       list[dict[str, Any]] = field(default_factory=list)
    metadata:     dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "success":     self.success,
            "operation":   self.operation,
            "dialogue_id": self.dialogue_id,
            "page":        self.page,
            "language":    self.language,
            "state":       self.state,
            "error":       self.error,
            "error_code":  self.error_code,
            "events":      self.events,
            "metadata":    self.metadata,
        }


class DialogueEngine:
    """
    Dialogue selector, validator, and state machine.

    Responsibilities (ONLY):
      - Load dialogue JSON via DialogueSelector
      - Validate dialogue
      - Check conditions
      - Maintain history
      - Maintain state machine
      - Call DialoguePlayer.play() which emits voice/avatar events

    NOT responsible for:
      - Audio playback (VoiceEngine / AudioPlayer)
      - Thread management
      - HTTP communication

    Thread-safety: NOT thread-safe.
    Only called from DialogueRuntime._CommandQueue worker thread.
    """

    def __init__(
        self,
        language: Optional[str] = None,
        selector: Optional[DialogueSelector] = None,
        player: Optional[DialoguePlayer] = None,
        condition: Optional[DialogueCondition] = None,
        history: Optional[DialogueHistory] = None,
        state_machine: Optional[DialogueStateMachine] = None,
        language_manager: Optional[LanguageManager] = None,
        validator: Optional[Validator] = None,
    ) -> None:
        self._language: str = language or SETTINGS.default_language
        self._lm       = language_manager or LanguageManager()
        self._selector = selector or DialogueSelector(language_manager=self._lm)
        self._player   = player or DialoguePlayer()
        self._condition = condition or DialogueCondition()
        self._history  = history or DialogueHistory(
            max_entries=SETTINGS.max_history_entries
        )
        self._sm       = state_machine or DialogueStateMachine()
        self._val      = validator or Validator()

        self._context: dict[str, Any] = {}
        self._current_dialogue: Optional[dict[str, Any]] = None
        self._current_page: Optional[str] = None
        self._previous_page: Optional[str] = None

        _log.info(
            "DialogueEngine initialised | lang=%s state=%s",
            self._language, self._sm.state.value,
        )

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language_code: str) -> EngineResult:
        try:
            validated = self._lm.validate(language_code)
            self._language = validated
            self._context["language"] = validated
            _log.info("Language set to: %s", validated)
            return EngineResult(
                success=True,
                operation="set_language",
                language=validated,
                state=self._sm.state.value,
            )
        except UnsupportedLanguageError as exc:
            return self._error_result("set_language", exc)

    def get_language(self) -> str:
        return self._language

    # ── Context ───────────────────────────────────────────────────────────────

    def set_context(self, key: str, value: Any) -> None:
        self._context[key] = value

    def update_context(self, data: dict[str, Any]) -> None:
        self._context.update(data)

    def get_context(self) -> dict[str, Any]:
        return dict(self._context)

    # ── Core playback ─────────────────────────────────────────────────────────

    @log_performance("engine_play")
    def play(
        self,
        page: str,
        dialogue_type: str = "welcome",
        context: Optional[dict[str, Any]] = None,
    ) -> EngineResult:
        """
        Load, validate, and play a dialogue.

        RC-2 FIX: This method calls self._player.play(dialogue) which emits
        VOICE_EVENT_PLAY.  DialogueRuntime._handle_voice_event receives that
        event and calls VoiceEngine.play().  This method does NOT call
        VoiceEngine or AudioPlayer directly — single pipeline enforced.
        """
        if context:
            self._context.update(context)
        self._context.setdefault("language", self._language)
        self._context["page"] = page

        try:
            _stoppable = {
                DialogueState.PLAYING,
                DialogueState.LISTENING,
                DialogueState.THINKING,
                DialogueState.WAITING,
                DialogueState.SUCCESS,
                DialogueState.WARNING,
                DialogueState.STOPPED,
                DialogueState.ERROR,
                DialogueState.LOADING,
                DialogueState.READY,
            }
            if self._sm.state in _stoppable:
                self._player.stop()
                self._sm.force(DialogueState.IDLE)

            self._sm.transition(DialogueState.LOADING)

            dialogue = self._selector.get_dialogue(
                page, dialogue_type, language=self._language
            )

            self._sm.transition(DialogueState.READY)

            if not self._condition.check(dialogue, self._context):
                _log.info(
                    "Dialogue conditions not met: page=%s type=%s", page, dialogue_type
                )
                self._sm.force(DialogueState.IDLE)
                return EngineResult(
                    success=False,
                    operation="play",
                    page=page,
                    language=self._language,
                    state=self._sm.state.value,
                    error="Dialogue conditions not satisfied.",
                    error_code="CONDITION_NOT_MET",
                )

            self._sm.transition(DialogueState.PLAYING)

            # RC-2: player.play() emits VOICE_EVENT_PLAY → single audio pipeline.
            self._player.play(dialogue)

            self._history.record(
                dialogue_id=dialogue.get("id", ""),
                current_page=page,
                language=self._language,
                previous_page=self._previous_page,
            )

            self._previous_page    = self._current_page
            self._current_page     = page
            self._current_dialogue = dialogue

            _log.info(
                "Dialogue playing: id=%s page=%s lang=%s",
                dialogue.get("id"), page, self._language,
            )

            return EngineResult(
                success=True,
                operation="play",
                dialogue_id=dialogue.get("id"),
                page=page,
                language=self._language,
                state=self._sm.state.value,
                events=list(self._player._state.events_emitted),
                metadata={
                    "title":        dialogue.get("title"),
                    "version":      dialogue.get("version"),
                    "replay_count": self._history.replay_count(
                        page, dialogue.get("id", "")
                    ),
                },
            )

        except DialogueNotFoundError as exc:
            return self._recover_error("play", exc, DialogueState.ERROR)
        except DialogueValidationError as exc:
            return self._recover_error("play", exc, DialogueState.ERROR)
        except DialogueConditionError as exc:
            return self._recover_error("play", exc, DialogueState.WARNING)
        except DialogueStateError as exc:
            return self._recover_error("play", exc, DialogueState.ERROR)
        except Exception as exc:
            return self._recover_error("play", exc, DialogueState.ERROR)

    def pause(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.WAITING)
            success = self._player.pause()
            return EngineResult(
                success=success,
                operation="pause",
                dialogue_id=self._player.current_dialogue_id,
                page=self._current_page,
                language=self._language,
                state=self._sm.state.value,
            )
        except DialogueStateError as exc:
            return self._error_result("pause", exc)

    def resume(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.PLAYING)
            success = self._player.resume()
            return EngineResult(
                success=success,
                operation="resume",
                dialogue_id=self._player.current_dialogue_id,
                page=self._current_page,
                language=self._language,
                state=self._sm.state.value,
            )
        except DialogueStateError as exc:
            return self._error_result("resume", exc)

    def stop(self) -> EngineResult:
        """Idempotent stop — safe to call when already stopped."""
        try:
            self._sm.transition(DialogueState.STOPPED)
            success = self._player.stop()
            self._current_dialogue = None
            return EngineResult(
                success=success,
                operation="stop",
                page=self._current_page,
                language=self._language,
                state=self._sm.state.value,
            )
        except DialogueStateError:
            # Already stopped — force and return success.
            self._player.stop()
            self._sm.force(DialogueState.STOPPED)
            self._current_dialogue = None
            return EngineResult(
                success=True,
                operation="stop",
                page=self._current_page,
                language=self._language,
                state=self._sm.state.value,
            )

    def replay(self) -> EngineResult:
        last = self._history.last()
        if last is None:
            return EngineResult(
                success=False,
                operation="replay",
                state=self._sm.state.value,
                error="No dialogue in history to replay.",
                error_code="NO_HISTORY",
            )

        if last.replay_count >= SETTINGS.max_replay_count:
            _log.warning(
                "Max replay count (%d) reached for id=%s",
                SETTINGS.max_replay_count, last.dialogue_id,
            )
            return EngineResult(
                success=False,
                operation="replay",
                dialogue_id=last.dialogue_id,
                state=self._sm.state.value,
                error=f"Maximum replay count ({SETTINGS.max_replay_count}) reached.",
                error_code="MAX_REPLAY_REACHED",
            )

        parts = last.dialogue_id.split("_")
        page  = last.current_page
        if len(parts) >= 3:
            dtype = "_".join(parts[1:-1])
        elif len(parts) == 2:
            dtype = parts[1]
        else:
            dtype = "welcome"
        return self.play(page, dtype)

    # ── State transitions ─────────────────────────────────────────────────────

    def set_listening(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.LISTENING)
            self._player.emit_listening()
            return EngineResult(success=True, operation="set_listening", state=self._sm.state.value)
        except DialogueStateError as exc:
            return self._error_result("set_listening", exc)

    def set_thinking(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.THINKING)
            self._player.emit_thinking()
            return EngineResult(success=True, operation="set_thinking", state=self._sm.state.value)
        except DialogueStateError as exc:
            return self._error_result("set_thinking", exc)

    def set_success(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.SUCCESS)
            self._player.emit_success()
            return EngineResult(success=True, operation="set_success", state=self._sm.state.value)
        except DialogueStateError as exc:
            return self._error_result("set_success", exc)

    def set_offline(self) -> EngineResult:
        try:
            self._sm.transition(DialogueState.OFFLINE)
        except DialogueStateError:
            self._sm.force(DialogueState.OFFLINE)
        return EngineResult(success=True, operation="set_offline", state=self._sm.state.value)

    def exit(self) -> EngineResult:
        self._player.stop()
        self._sm.force(DialogueState.EXIT)
        _log.info("DialogueEngine exiting.")
        return EngineResult(success=True, operation="exit", state=self._sm.state.value)

    def reset(self) -> EngineResult:
        self._player.stop()
        self._sm.reset()
        self._current_dialogue = None
        _log.info("DialogueEngine reset to IDLE.")
        return EngineResult(success=True, operation="reset", state=self._sm.state.value)

    # ── Inspection ────────────────────────────────────────────────────────────

    @property
    def state(self) -> DialogueState:
        return self._sm.state

    @property
    def history(self) -> DialogueHistory:
        return self._history

    def get_status(self) -> dict[str, Any]:
        last = self._history.last()
        return {
            "state":            self._sm.state.value,
            "language":         self._language,
            "current_page":     self._current_page,
            "previous_page":    self._previous_page,
            "is_playing":       self._player.is_playing,
            "is_paused":        self._player.is_paused,
            "history_count":    self._history.count(),
            "last_dialogue_id": last.dialogue_id if last else None,
            "context":          dict(self._context),
        }

    # ── Callback registration ─────────────────────────────────────────────────

    def on_avatar_event(self, callback: EventCallback) -> None:
        self._player.on_avatar_event(callback)

    def on_voice_event(self, callback: EventCallback) -> None:
        self._player.on_voice_event(callback)

    # ── Error recovery ────────────────────────────────────────────────────────

    def _recover_error(
        self,
        operation: str,
        exc: Exception,
        target_state: DialogueState = DialogueState.ERROR,
    ) -> EngineResult:
        _log.error("Engine error during '%s': %s", operation, exc, exc_info=True)
        try:
            self._sm.force(target_state)
        except Exception:
            pass
        try:
            self._player.emit_error(str(exc))
        except Exception:
            pass
        return EngineResult(
            success=False,
            operation=operation,
            page=self._current_page,
            language=self._language,
            state=self._sm.state.value,
            error=str(exc),
            error_code=getattr(exc, "code", "UNKNOWN_ERROR"),
        )

    def _error_result(self, operation: str, exc: Exception) -> EngineResult:
        _log.warning("Engine warning during '%s': %s", operation, exc)
        return EngineResult(
            success=False,
            operation=operation,
            page=self._current_page,
            language=self._language,
            state=self._sm.state.value,
            error=str(exc),
            error_code=getattr(exc, "code", "UNKNOWN_ERROR"),
        )

    def __repr__(self) -> str:
        return (
            f"DialogueEngine(state={self._sm.state.value!r}, "
            f"lang={self._language!r}, "
            f"page={self._current_page!r})"
        )
