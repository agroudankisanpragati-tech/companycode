"""
Voice Guide AI — Dialogue Player.

Manages playback lifecycle for a single dialogue:
  * play / pause / resume / stop
  * Generates avatar events (speak, idle, listen, …)
  * Generates voice events (play, stop, pause, resume)
  * Tracks playback position and elapsed time
  * Emits structured event dicts consumed by the engine
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from config.constants import (
    AVATAR_EVENT_ERROR,
    AVATAR_EVENT_IDLE,
    AVATAR_EVENT_LISTEN,
    AVATAR_EVENT_SPEAK,
    AVATAR_EVENT_SUCCESS,
    AVATAR_EVENT_THINK,
    AVATAR_EVENT_WAVE,
    VOICE_EVENT_PAUSE,
    VOICE_EVENT_PLAY,
    VOICE_EVENT_RESUME,
    VOICE_EVENT_STOP,
)
from config.exceptions import DialogueStateError
from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("dialogue_player")

# Callback type: receives an event dict
EventCallback = Callable[[dict[str, Any]], None]


@dataclass
class PlaybackState:
    """Tracks the current playback session."""

    dialogue_id:   str = ""
    page:          str = ""
    language:      str = ""
    is_playing:    bool = False
    is_paused:     bool = False
    start_time:    float = 0.0
    pause_time:    float = 0.0
    elapsed_ms:    float = 0.0
    audio_path:    Optional[str] = None
    events_emitted: list[dict[str, Any]] = field(default_factory=list)

    def reset(self) -> None:
        self.dialogue_id = ""
        self.page = ""
        self.language = ""
        self.is_playing = False
        self.is_paused = False
        self.start_time = 0.0
        self.pause_time = 0.0
        self.elapsed_ms = 0.0
        self.audio_path = None
        self.events_emitted.clear()


class DialoguePlayer:
    """
    Controls playback of a single dialogue.

    The player is intentionally decoupled from the actual audio
    subsystem.  It emits structured event dicts via registered
    callbacks, which the audio/avatar layers consume.

    Register callbacks with ``on_avatar_event`` and ``on_voice_event``.
    """

    def __init__(self) -> None:
        self._state = PlaybackState()
        self._avatar_callbacks: list[EventCallback] = []
        self._voice_callbacks:  list[EventCallback] = []

    # ── Callback registration ─────────────────────────────────────────────────

    def on_avatar_event(self, callback: EventCallback) -> None:
        """Register a callback to receive avatar events."""
        self._avatar_callbacks.append(callback)

    def on_voice_event(self, callback: EventCallback) -> None:
        """Register a callback to receive voice/audio events."""
        self._voice_callbacks.append(callback)

    # ── Playback control ──────────────────────────────────────────────────────

    def play(self, dialogue: dict[str, Any]) -> bool:
        """
        Begin playback of *dialogue*.

        Emits avatar ``speak`` and voice ``play`` events.

        Parameters
        ----------
        dialogue : validated dialogue JSON dict

        Returns
        -------
        True on success

        Raises
        ------
        DialogueStateError — already playing and not paused
        """
        if self._state.is_playing and not self._state.is_paused:
            raise DialogueStateError("playing", "play (already active)")

        dialogue_id = dialogue.get("id", Helper.generate_short_id())
        page        = dialogue.get("page", "")
        language    = dialogue.get("_language") or dialogue.get("language", "")
        text        = dialogue.get("text", "")
        voice_cfg   = dialogue.get("voice", {})
        avatar_cfg  = dialogue.get("avatar", {})

        self._state.reset()
        self._state.dialogue_id = dialogue_id
        self._state.page        = page
        self._state.language    = language
        self._state.is_playing  = True
        self._state.start_time  = time.monotonic()

        # Determine audio path from voice config
        audio_file = voice_cfg.get("file") if isinstance(voice_cfg, dict) else None
        self._state.audio_path = audio_file

        _log.info("Playing dialogue: id=%s page=%s lang=%s", dialogue_id, page, language)

        # Avatar event
        avatar_animation = avatar_cfg.get("animation", AVATAR_EVENT_SPEAK) \
            if isinstance(avatar_cfg, dict) else AVATAR_EVENT_SPEAK
        self._emit_avatar({
            "type":        AVATAR_EVENT_SPEAK,
            "animation":   avatar_animation,
            "dialogue_id": dialogue_id,
            "page":        page,
            "language":    language,
            "timestamp":   Helper.current_timestamp(),
        })

        # Voice event
        self._emit_voice({
            "type":        VOICE_EVENT_PLAY,
            "dialogue_id": dialogue_id,
            "text":        text,
            "audio_file":  audio_file,
            "language":    language,
            "voice_config": voice_cfg,
            "timestamp":   Helper.current_timestamp(),
        })

        return True

    def pause(self) -> bool:
        """
        Pause playback.

        Emits avatar ``idle`` and voice ``pause`` events.

        Returns False if not currently playing.
        """
        if not self._state.is_playing or self._state.is_paused:
            _log.warning("pause() called but not in playing state.")
            return False

        self._state.is_paused  = True
        self._state.pause_time = time.monotonic()

        _log.info("Paused dialogue: id=%s", self._state.dialogue_id)

        self._emit_avatar({
            "type":        AVATAR_EVENT_IDLE,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })
        self._emit_voice({
            "type":        VOICE_EVENT_PAUSE,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })
        return True

    def resume(self) -> bool:
        """
        Resume a paused dialogue.

        Emits avatar ``speak`` and voice ``resume`` events.

        Returns False if not paused.
        """
        if not self._state.is_paused:
            _log.warning("resume() called but not paused.")
            return False

        pause_duration = time.monotonic() - self._state.pause_time
        self._state.elapsed_ms += pause_duration * 1000
        self._state.is_paused   = False

        _log.info("Resumed dialogue: id=%s", self._state.dialogue_id)

        self._emit_avatar({
            "type":        AVATAR_EVENT_SPEAK,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })
        self._emit_voice({
            "type":        VOICE_EVENT_RESUME,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })
        return True

    def stop(self) -> bool:
        """
        Stop playback and reset state.

        Emits avatar ``idle`` and voice ``stop`` events.

        Returns False if nothing is playing.
        """
        if not self._state.is_playing:
            _log.debug("stop() called but nothing is playing.")
            return False

        dialogue_id = self._state.dialogue_id
        elapsed = (time.monotonic() - self._state.start_time) * 1000

        _log.info(
            "Stopped dialogue: id=%s elapsed=%.0f ms", dialogue_id, elapsed
        )

        self._emit_avatar({
            "type":        AVATAR_EVENT_IDLE,
            "dialogue_id": dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })
        self._emit_voice({
            "type":        VOICE_EVENT_STOP,
            "dialogue_id": dialogue_id,
            "elapsed_ms":  elapsed,
            "timestamp":   Helper.current_timestamp(),
        })

        self._state.reset()
        return True

    # ── Avatar / Voice event helpers ──────────────────────────────────────────

    def emit_listening(self) -> None:
        """Emit avatar ``listen`` event (e.g. when STT is active)."""
        self._emit_avatar({
            "type":        AVATAR_EVENT_LISTEN,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })

    def emit_thinking(self) -> None:
        """Emit avatar ``think`` event (e.g. while AI processes input)."""
        self._emit_avatar({
            "type":        AVATAR_EVENT_THINK,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })

    def emit_success(self) -> None:
        """Emit avatar ``success`` event."""
        self._emit_avatar({
            "type":        AVATAR_EVENT_SUCCESS,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })

    def emit_error(self, reason: str = "") -> None:
        """Emit avatar ``error`` event."""
        self._emit_avatar({
            "type":        AVATAR_EVENT_ERROR,
            "dialogue_id": self._state.dialogue_id,
            "reason":      reason,
            "timestamp":   Helper.current_timestamp(),
        })

    def emit_wave(self) -> None:
        """Emit avatar ``wave`` event (greeting)."""
        self._emit_avatar({
            "type":        AVATAR_EVENT_WAVE,
            "dialogue_id": self._state.dialogue_id,
            "timestamp":   Helper.current_timestamp(),
        })

    # ── State inspection ──────────────────────────────────────────────────────

    @property
    def is_playing(self) -> bool:
        return self._state.is_playing and not self._state.is_paused

    @property
    def is_paused(self) -> bool:
        return self._state.is_paused

    @property
    def current_dialogue_id(self) -> str:
        return self._state.dialogue_id

    def get_playback_state(self) -> dict[str, Any]:
        """Return a snapshot of the current playback state."""
        return {
            "dialogue_id": self._state.dialogue_id,
            "page":        self._state.page,
            "language":    self._state.language,
            "is_playing":  self._state.is_playing,
            "is_paused":   self._state.is_paused,
            "audio_path":  self._state.audio_path,
            "elapsed_ms":  self._state.elapsed_ms,
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _emit_avatar(self, event: dict[str, Any]) -> None:
        self._state.events_emitted.append({"channel": "avatar", **event})
        for cb in self._avatar_callbacks:
            try:
                cb(event)
            except Exception as exc:  # noqa: BLE001
                _log.warning("Avatar callback error: %s", exc)

    def _emit_voice(self, event: dict[str, Any]) -> None:
        self._state.events_emitted.append({"channel": "voice", **event})
        for cb in self._voice_callbacks:
            try:
                cb(event)
            except Exception as exc:  # noqa: BLE001
                _log.warning("Voice callback error: %s", exc)
