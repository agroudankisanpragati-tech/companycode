"""
Translation Manager — central facade for the entire localization engine.

Public API
----------
  get(language, module, dialogue_id, context)  → str
  get_module(language, module)                 → dict[str, str]
  switch_language(new_language)                → SwitchResult
  reload(language, module)                     → dict[str, str]
  preload(language)                            → None
  validate(language, module)                   → ValidationReport
  cache_stats()                                → dict
  available_languages()                        → list[str]
  current_language                             → str
"""

from __future__ import annotations

import threading
from typing import Any, Callable, Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger, log_performance
from localization.dialect_manager import DialectManager
from localization.fallback_manager import FallbackManager
from localization.formatter import Formatter
from localization.language_switcher import LanguageSwitcher, SwitchResult
from localization.pluralization import Pluralization
from localization.translation_cache import TranslationCache
from localization.translation_events import TranslationEventDispatcher
from localization.translation_loader import TranslationLoader
from localization.translation_memory import TranslationMemory
from localization.translation_selector import TranslationSelector
from localization.translation_validator import TranslationValidator, ValidationReport

_log = get_logger("localization.translation_manager")


class TranslationManager:
    """
    Central facade for the Translation & Localization Engine.

    Thread-safe. One instance per application.

    Parameters
    ----------
    initial_language : language code to start with (default: "hi")
    cache_ttl        : TTL in seconds for cached translations
    cache_max_size   : maximum cache entries
    """

    def __init__(
        self,
        initial_language: str = DEFAULT_LANGUAGE,
        cache_ttl: float = 1800.0,
        cache_max_size: int = 512,
    ) -> None:
        self._lock = threading.Lock()

        # ── Core components ────────────────────────────────────────────────────
        self._cache = TranslationCache(ttl_seconds=cache_ttl, max_size=cache_max_size)
        self._loader = TranslationLoader(cache=self._cache)
        self._fallback = FallbackManager()
        self._dialect = DialectManager(loader=self._loader, fallback=self._fallback)
        self._selector = TranslationSelector(
            loader=self._loader,
            fallback=self._fallback,
            dialect=self._dialect,
        )
        self._formatter = Formatter()
        self._pluralization = Pluralization()
        self._memory = TranslationMemory(initial_language=initial_language)
        self._events = TranslationEventDispatcher()
        self._validator = TranslationValidator()
        self._switcher = LanguageSwitcher(
            cache=self._cache,
            loader=self._loader,
            memory=self._memory,
            events=self._events,
        )

    # ── Core translation lookup ────────────────────────────────────────────────

    def get(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Return the translated string for *dialogue_id*.

        Applies placeholder substitution if *context* is provided.
        Falls back through the chain. Returns "" if nothing found.
        """
        resolved_lang, text = self._selector.select(language, module, dialogue_id)

        if not text:
            self._events.translation_failed(language, module, dialogue_id, "not_found")
            return ""

        if resolved_lang != language:
            self._events.fallback_activated(language, resolved_lang, module, dialogue_id)

        if context:
            text = self._formatter.format(text, context)

        return text

    def get_module(
        self,
        language: str,
        module: str,
    ) -> dict[str, str]:
        """
        Return the full translation dict for *language* / *module*.

        Falls back through the chain. Returns {} if nothing found.
        """
        resolved_lang, data = self._selector.select_module(language, module)

        if not data:
            self._events.translation_failed(language, module, "", "module_not_found")
            return {}

        if resolved_lang != language:
            self._events.fallback_activated(language, resolved_lang, module, None)

        return data

    def get_plural(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        count: int,
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Return the correct plural form for *count*.

        Expects the translation value to be a JSON-encoded dict of
        CLDR plural categories, or a plain string (returned as-is).
        """
        import json as _json

        _, raw = self._selector.select(language, module, dialogue_id)
        if not raw:
            return ""

        try:
            forms = _json.loads(raw)
            if isinstance(forms, dict):
                text = self._pluralization.select(language, count, forms)
            else:
                text = raw
        except (_json.JSONDecodeError, ValueError):
            text = raw

        if context:
            text = self._formatter.format(text, context)
        return text

    # ── Language switching ─────────────────────────────────────────────────────

    def switch_language(self, new_language: str) -> SwitchResult:
        """Switch the active language. Returns SwitchResult."""
        return self._switcher.switch(new_language)

    def register_switch_callback(self, callback: Callable[[str, str], None]) -> None:
        """Register a callback invoked after every language switch."""
        self._switcher.register_callback(callback)

    def unregister_switch_callback(self, callback: Callable[[str, str], None]) -> None:
        self._switcher.unregister_callback(callback)

    # ── Cache management ───────────────────────────────────────────────────────

    def reload(self, language: str, module: str) -> dict[str, str]:
        """Force reload a module from disk, bypassing cache."""
        return self._loader.reload(language, module)

    def reload_language(self, language: str) -> None:
        """Invalidate all cached data for *language*."""
        self._cache.invalidate_language(language)
        _log.info("Cache invalidated for language=%s", language)

    def preload(self, language: str) -> None:
        """Eagerly load all modules for *language* into cache."""
        self._loader.load_all_modules(language)
        _log.info("Preloaded all modules for language=%s", language)

    def clear_cache(self) -> None:
        """Clear the entire translation cache."""
        self._cache.clear()
        _log.info("Translation cache cleared.")

    def clear_expired(self) -> int:
        """Remove expired cache entries. Returns count removed."""
        return self._cache.clear_expired()

    # ── Validation ─────────────────────────────────────────────────────────────

    def validate(self, language: str, module: str) -> ValidationReport:
        """Validate a single translation file."""
        return self._validator.validate_file(language, module)

    def validate_language(self, language: str) -> list[ValidationReport]:
        """Validate all modules for *language*."""
        return self._validator.validate_language(language)

    # ── Introspection ──────────────────────────────────────────────────────────

    @property
    def current_language(self) -> str:
        return self._memory.last_language

    @property
    def preferred_language(self) -> Optional[str]:
        return self._memory.preferred_language

    def set_preferred_language(self, language: str) -> None:
        self._memory.set_preferred(language)

    def available_languages(self) -> list[str]:
        """Return all supported language codes."""
        from config.constants import SUPPORTED_LANGUAGES
        return list(SUPPORTED_LANGUAGES.keys())

    def available_dialects(self) -> list[str]:
        return self._dialect.all_dialects()

    def fallback_chain(self, language: str) -> list[str]:
        return self._fallback.chain(language)

    def cache_stats(self) -> dict[str, Any]:
        return self._cache.stats()

    def memory_snapshot(self) -> dict:
        return self._memory.snapshot()

    # ── Event subscription ─────────────────────────────────────────────────────

    @property
    def events(self) -> TranslationEventDispatcher:
        return self._events

    # ── Subsystem accessors ────────────────────────────────────────────────────

    @property
    def cache(self) -> TranslationCache:
        return self._cache

    @property
    def loader(self) -> TranslationLoader:
        return self._loader

    @property
    def fallback(self) -> FallbackManager:
        return self._fallback

    @property
    def dialect(self) -> DialectManager:
        return self._dialect

    @property
    def formatter(self) -> Formatter:
        return self._formatter

    @property
    def memory(self) -> TranslationMemory:
        return self._memory

    @property
    def switcher(self) -> LanguageSwitcher:
        return self._switcher

    def __repr__(self) -> str:
        return (
            f"TranslationManager("
            f"language={self.current_language!r}, "
            f"cache_size={self._cache.stats()['size']})"
        )
