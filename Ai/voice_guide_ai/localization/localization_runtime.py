"""
Localization Runtime — synchronizes the TranslationManager with the
Dialogue Engine, Voice Engine, Avatar Engine, and AI Intelligence Layer.

Responsibilities
----------------
* Own the single TranslationManager instance.
* Register language-switch callbacks for each engine.
* Provide a unified translate() entry point used by all engines.
* Emit runtime events via the existing runtime EventDispatcher.
* Expose start() / stop() lifecycle methods.
"""

from __future__ import annotations

import threading
from typing import Any, Callable, Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger
from localization.language_switcher import SwitchResult
from localization.translation_manager import TranslationManager

_log = get_logger("localization.localization_runtime")


class LocalizationRuntime:
    """
    Runtime bridge between the TranslationManager and all engine layers.

    Parameters
    ----------
    initial_language : starting language code
    cache_ttl        : translation cache TTL in seconds
    """

    def __init__(
        self,
        initial_language: str = DEFAULT_LANGUAGE,
        cache_ttl: float = 1800.0,
    ) -> None:
        self._manager = TranslationManager(
            initial_language=initial_language,
            cache_ttl=cache_ttl,
        )
        self._lock = threading.Lock()
        self._started = False
        self._runtime_event_dispatcher: Optional[Any] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        with self._lock:
            if self._started:
                return
            self._started = True
        self._manager.preload(self._manager.current_language)
        _log.info(
            "LocalizationRuntime started | language=%s",
            self._manager.current_language,
        )

    def stop(self) -> None:
        with self._lock:
            if not self._started:
                return
            self._started = False
        self._manager.clear_expired()
        _log.info("LocalizationRuntime stopped.")

    # ── Engine integration ─────────────────────────────────────────────────────

    def attach_runtime_dispatcher(self, dispatcher: Any) -> None:
        """
        Attach the runtime EventDispatcher so language-change events are
        forwarded to the broader runtime event bus.
        """
        self._runtime_event_dispatcher = dispatcher
        self._manager.register_switch_callback(self._on_language_switched)

    def register_engine_callback(self, callback: Callable[[str, str], None]) -> None:
        """Register an external engine callback for language switches."""
        self._manager.register_switch_callback(callback)

    def unregister_engine_callback(self, callback: Callable[[str, str], None]) -> None:
        self._manager.unregister_switch_callback(callback)

    # ── Translation API ────────────────────────────────────────────────────────

    def translate(
        self,
        module: str,
        dialogue_id: str,
        language: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Return the translated string for *dialogue_id* in *module*.

        Uses the current active language if *language* is not specified.
        Applies *context* placeholder substitution.
        """
        lang = language or self._manager.current_language
        return self._manager.get(lang, module, dialogue_id, context)

    def translate_module(
        self,
        module: str,
        language: Optional[str] = None,
    ) -> dict[str, str]:
        """Return the full translation dict for *module*."""
        lang = language or self._manager.current_language
        return self._manager.get_module(lang, module)

    # ── Language switching ─────────────────────────────────────────────────────

    def switch_language(self, new_language: str) -> SwitchResult:
        """
        Switch the active language across all registered engines.

        Returns SwitchResult with success flag and timing.
        """
        return self._manager.switch_language(new_language)

    def set_preferred_language(self, language: str) -> None:
        self._manager.set_preferred_language(language)

    # ── Introspection ──────────────────────────────────────────────────────────

    @property
    def current_language(self) -> str:
        return self._manager.current_language

    @property
    def manager(self) -> TranslationManager:
        return self._manager

    def fallback_chain(self, language: str) -> list[str]:
        return self._manager.fallback_chain(language)

    def available_languages(self) -> list[str]:
        return self._manager.available_languages()

    def cache_stats(self) -> dict[str, Any]:
        return self._manager.cache_stats()

    def status(self) -> dict[str, Any]:
        return {
            "started": self._started,
            "current_language": self._manager.current_language,
            "preferred_language": self._manager.preferred_language,
            "memory": self._manager.memory_snapshot(),
            "cache": self._manager.cache_stats(),
        }

    # ── Internal ───────────────────────────────────────────────────────────────

    def _on_language_switched(self, old: str, new: str) -> None:
        """Forward language-change to the runtime event dispatcher if attached."""
        if self._runtime_event_dispatcher is not None:
            try:
                self._runtime_event_dispatcher.language_changed(old, new)
            except Exception as exc:
                _log.error("Failed to forward language_changed event: %s", exc)
        _log.info("Language switch forwarded to runtime: %s → %s", old, new)
