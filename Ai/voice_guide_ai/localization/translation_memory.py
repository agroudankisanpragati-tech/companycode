"""
Translation Memory — persists user language preferences across sessions.

Stores
------
  * last_language    : most recently active language
  * preferred_language : explicitly chosen by user
  * last_dialect     : most recently active dialect (rj/*)
  * switch_history   : ordered list of language switches (capped at 50)

Thread-safe. In-memory only (no disk persistence required for this layer).
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger

_log = get_logger("localization.translation_memory")

_MAX_HISTORY = 50


@dataclass
class LanguageSwitchRecord:
    from_language: str
    to_language: str
    timestamp: float = field(default_factory=time.time)


class TranslationMemory:
    """
    Remembers language preferences and switch history for the current session.

    Thread-safe.
    """

    def __init__(self, initial_language: str = DEFAULT_LANGUAGE) -> None:
        self._lock = threading.Lock()
        self._last_language: str = initial_language
        self._preferred_language: Optional[str] = None
        self._last_dialect: Optional[str] = None
        self._history: list[LanguageSwitchRecord] = []

    # ── Setters ────────────────────────────────────────────────────────────────

    def record_switch(self, from_language: str, to_language: str) -> None:
        """Record a language switch event."""
        with self._lock:
            self._last_language = to_language
            if to_language.startswith("rj/"):
                self._last_dialect = to_language
            self._history.append(
                LanguageSwitchRecord(from_language, to_language)
            )
            if len(self._history) > _MAX_HISTORY:
                self._history.pop(0)
        _log.debug("Language switch recorded: %s → %s", from_language, to_language)

    def set_preferred(self, language: str) -> None:
        """Explicitly set the user's preferred language."""
        with self._lock:
            self._preferred_language = language

    # ── Getters ────────────────────────────────────────────────────────────────

    @property
    def last_language(self) -> str:
        with self._lock:
            return self._last_language

    @property
    def preferred_language(self) -> Optional[str]:
        with self._lock:
            return self._preferred_language

    @property
    def effective_language(self) -> str:
        """Return preferred language if set, otherwise last language."""
        with self._lock:
            return self._preferred_language or self._last_language

    @property
    def last_dialect(self) -> Optional[str]:
        with self._lock:
            return self._last_dialect

    @property
    def switch_history(self) -> list[LanguageSwitchRecord]:
        with self._lock:
            return list(self._history)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "last_language": self._last_language,
                "preferred_language": self._preferred_language,
                "last_dialect": self._last_dialect,
                "switch_count": len(self._history),
            }

    def reset(self) -> None:
        with self._lock:
            self._last_language = DEFAULT_LANGUAGE
            self._preferred_language = None
            self._last_dialect = None
            self._history.clear()
