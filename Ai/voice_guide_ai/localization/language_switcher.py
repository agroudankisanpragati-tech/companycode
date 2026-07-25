"""
Language Switcher — orchestrates an instant language switch across all
runtime subsystems without restarting the session.

Coordinates
-----------
  * TranslationMemory  — records the switch
  * TranslationCache   — invalidates old language entries
  * TranslationLoader  — preloads new language modules
  * TranslationEvents  — emits LanguageChangedEvent
  * External callbacks — voice engine, avatar engine, dialogue runtime
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional

from config.constants import SUPPORTED_LANGUAGES
from config.logger import get_logger
from localization.translation_cache import TranslationCache
from localization.translation_events import TranslationEventDispatcher
from localization.translation_loader import TranslationLoader
from localization.translation_memory import TranslationMemory

_log = get_logger("localization.language_switcher")

_SwitchCallback = Callable[[str, str], None]

_PRELOAD_MODULES: tuple[str, ...] = (
    "home", "common", "language_popup",
    "crop_recommendation", "government_scheme", "soil_health",
    "disease_detection", "weather", "mandi", "marketplace",
    "profile", "login", "register", "ai_chat", "app_settings",
)


@dataclass
class SwitchResult:
    success: bool
    old_language: str
    new_language: str
    elapsed_ms: float
    error: Optional[str] = None


class LanguageSwitcher:
    """
    Performs instant language switches across all registered subsystems.

    Parameters
    ----------
    cache   : TranslationCache to invalidate on switch
    loader  : TranslationLoader to preload new language
    memory  : TranslationMemory to record the switch
    events  : TranslationEventDispatcher to emit events
    """

    def __init__(
        self,
        cache: TranslationCache,
        loader: TranslationLoader,
        memory: TranslationMemory,
        events: TranslationEventDispatcher,
    ) -> None:
        self._cache = cache
        self._loader = loader
        self._memory = memory
        self._events = events
        self._callbacks: list[_SwitchCallback] = []
        self._lock = threading.Lock()

    # ── Callback registration ──────────────────────────────────────────────────

    def register_callback(self, callback: _SwitchCallback) -> None:
        """Register a callback invoked after every successful language switch."""
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def unregister_callback(self, callback: _SwitchCallback) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    # ── Switch ─────────────────────────────────────────────────────────────────

    def switch(self, new_language: str) -> SwitchResult:
        """
        Switch to *new_language* immediately.

        Steps
        -----
        1. Validate the language code.
        2. Invalidate cache for old language.
        3. Preload critical modules for new language.
        4. Update memory.
        5. Emit LanguageChangedEvent.
        6. Invoke registered callbacks.

        Returns SwitchResult. Never raises.
        """
        start = time.perf_counter()
        old_language = self._memory.last_language

        if new_language == old_language:
            return SwitchResult(
                success=True,
                old_language=old_language,
                new_language=new_language,
                elapsed_ms=0.0,
            )

        if new_language not in SUPPORTED_LANGUAGES:
            msg = f"Unsupported language: {new_language!r}"
            _log.warning(msg)
            return SwitchResult(
                success=False,
                old_language=old_language,
                new_language=new_language,
                elapsed_ms=(time.perf_counter() - start) * 1000,
                error=msg,
            )

        try:
            self._cache.invalidate_language(old_language)
            for module in _PRELOAD_MODULES:
                self._loader.load(new_language, module)
            self._memory.record_switch(old_language, new_language)
            self._events.language_changed(old_language, new_language)
            self._invoke_callbacks(old_language, new_language)

            elapsed = (time.perf_counter() - start) * 1000
            _log.info(
                "Language switched: %s → %s (%.1f ms)", old_language, new_language, elapsed
            )
            return SwitchResult(
                success=True,
                old_language=old_language,
                new_language=new_language,
                elapsed_ms=elapsed,
            )
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            _log.error("Language switch failed: %s → %s: %s", old_language, new_language, exc)
            return SwitchResult(
                success=False,
                old_language=old_language,
                new_language=new_language,
                elapsed_ms=elapsed,
                error=str(exc),
            )

    # ── Internal ───────────────────────────────────────────────────────────────

    def _invoke_callbacks(self, old: str, new: str) -> None:
        with self._lock:
            callbacks = list(self._callbacks)
        for cb in callbacks:
            try:
                cb(old, new)
            except Exception as exc:
                _log.error("Switch callback error: %s", exc)
