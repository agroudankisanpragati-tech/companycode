"""
Voice Guide AI — Runtime Session Manager.

Maintains the live session state for a single user session:
  * Current page, dialogue, language
  * Replay count, last interaction timestamp
  * Avatar state, voice state
  * Session start time
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.session_manager")


@dataclass
class SessionState:
    """Snapshot of the current runtime session."""

    session_id: str = field(default_factory=Helper.generate_id)
    current_page: Optional[str] = None
    current_dialogue_id: Optional[str] = None
    current_language: str = DEFAULT_LANGUAGE
    replay_count: int = 0
    last_interaction: Optional[str] = None
    avatar_state: str = "idle"
    voice_state: str = "stopped"
    session_start: str = field(default_factory=Helper.current_timestamp)
    is_online: bool = True
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "current_page": self.current_page,
            "current_dialogue_id": self.current_dialogue_id,
            "current_language": self.current_language,
            "replay_count": self.replay_count,
            "last_interaction": self.last_interaction,
            "avatar_state": self.avatar_state,
            "voice_state": self.voice_state,
            "session_start": self.session_start,
            "is_online": self.is_online,
            "extra": self.extra,
        }


class SessionManager:
    """
    Thread-safe runtime session manager.

    Maintains a single SessionState that is updated as the user
    navigates pages and triggers dialogues.
    """

    def __init__(self) -> None:
        self._state = SessionState()
        self._lock = threading.Lock()

    # ── Reads ─────────────────────────────────────────────────────────────────

    def get_state(self) -> SessionState:
        with self._lock:
            return self._state

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._state.to_dict()

    @property
    def session_id(self) -> str:
        return self._state.session_id

    @property
    def current_page(self) -> Optional[str]:
        with self._lock:
            return self._state.current_page

    @property
    def current_language(self) -> str:
        with self._lock:
            return self._state.current_language

    @property
    def is_online(self) -> bool:
        with self._lock:
            return self._state.is_online

    # ── Writes ────────────────────────────────────────────────────────────────

    def set_page(self, page: str) -> None:
        with self._lock:
            self._state.current_page = page
            self._state.last_interaction = Helper.current_timestamp()
        _log.debug("Session page → %s", page)

    def set_dialogue(self, dialogue_id: str) -> None:
        with self._lock:
            self._state.current_dialogue_id = dialogue_id
            self._state.last_interaction = Helper.current_timestamp()
        _log.debug("Session dialogue → %s", dialogue_id)

    def set_language(self, language: str) -> None:
        with self._lock:
            self._state.current_language = language
            self._state.last_interaction = Helper.current_timestamp()
        _log.debug("Session language → %s", language)

    def set_avatar_state(self, state: str) -> None:
        with self._lock:
            self._state.avatar_state = state

    def set_voice_state(self, state: str) -> None:
        with self._lock:
            self._state.voice_state = state

    def set_online(self, online: bool) -> None:
        with self._lock:
            self._state.is_online = online
        _log.info("Session online → %s", online)

    def increment_replay(self) -> int:
        with self._lock:
            self._state.replay_count += 1
            return self._state.replay_count

    def reset_replay_count(self) -> None:
        with self._lock:
            self._state.replay_count = 0

    def set_extra(self, key: str, value: Any) -> None:
        with self._lock:
            self._state.extra[key] = value

    def get_extra(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._state.extra.get(key, default)

    def touch(self) -> None:
        """Update last_interaction to now."""
        with self._lock:
            self._state.last_interaction = Helper.current_timestamp()

    def reset(self) -> None:
        """Reset session to a fresh state, preserving session_id."""
        with self._lock:
            sid = self._state.session_id
            self._state = SessionState(session_id=sid)
        _log.info("Session reset: id=%s", sid)
