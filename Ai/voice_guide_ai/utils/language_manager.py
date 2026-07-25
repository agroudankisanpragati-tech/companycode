"""
Voice Guide AI — Language Manager.

Manages the full set of supported languages (21 total, including
Rajasthani dialects), provides fallback resolution, display names,
and translation file loading.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config.constants import (
    DEFAULT_LANGUAGE,
    FALLBACK_LANGUAGE,
    SUPPORTED_LANGUAGES,
)
from config.exceptions import (
    TranslationNotFoundError,
    UnsupportedLanguageError,
)
from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("language_manager")


@dataclass
class LanguageInfo:
    """Metadata for a single supported language."""

    code: str
    display_name: str
    is_dialect: bool = False
    parent_code: Optional[str] = None
    rtl: bool = False

    def __str__(self) -> str:
        return f"{self.display_name} ({self.code})"


# ── Static language registry ───────────────────────────────────────────────────

_LANGUAGE_REGISTRY: dict[str, LanguageInfo] = {
    "hi":           LanguageInfo("hi",           "Hindi"),
    "en":           LanguageInfo("en",           "English"),
    "gu":           LanguageInfo("gu",           "Gujarati"),
    "pa":           LanguageInfo("pa",           "Punjabi"),
    "mr":           LanguageInfo("mr",           "Marathi"),
    "ta":           LanguageInfo("ta",           "Tamil"),
    "te":           LanguageInfo("te",           "Telugu"),
    "kn":           LanguageInfo("kn",           "Kannada"),
    "ml":           LanguageInfo("ml",           "Malayalam"),
    "bn":           LanguageInfo("bn",           "Bengali"),
    "ur":           LanguageInfo("ur",           "Urdu",    rtl=True),
    "od":           LanguageInfo("od",           "Odia"),
    "as":           LanguageInfo("as",           "Assamese"),
    "rj/bagri":     LanguageInfo("rj/bagri",     "Bagri",      is_dialect=True, parent_code="hi"),
    "rj/marwari":   LanguageInfo("rj/marwari",   "Marwari",    is_dialect=True, parent_code="hi"),
    "rj/mewari":    LanguageInfo("rj/mewari",    "Mewari",     is_dialect=True, parent_code="hi"),
    "rj/dhundhari": LanguageInfo("rj/dhundhari", "Dhundhari",  is_dialect=True, parent_code="hi"),
    "rj/hadoti":    LanguageInfo("rj/hadoti",    "Hadoti",     is_dialect=True, parent_code="hi"),
    "rj/shekhawati":LanguageInfo("rj/shekhawati","Shekhawati", is_dialect=True, parent_code="hi"),
    "rj/mewati":    LanguageInfo("rj/mewati",    "Mewati",     is_dialect=True, parent_code="hi"),
    "rj/wagdi":     LanguageInfo("rj/wagdi",     "Wagdi",      is_dialect=True, parent_code="hi"),
}


class LanguageManager:
    """
    Central language authority for the Voice Guide AI module.

    Responsibilities
    ----------------
    * Validate language codes
    * Resolve fallback chains
    * Return display names
    * Load translation JSON for a given language + page
    * List available languages and dialects
    """

    def __init__(self) -> None:
        self._registry: dict[str, LanguageInfo] = _LANGUAGE_REGISTRY.copy()
        # Translation cache:  (language_code, page) → dict
        self._translation_cache: dict[tuple[str, str], dict[str, Any]] = {}

    # ── Validation ────────────────────────────────────────────────────────────

    def is_supported(self, language_code: str) -> bool:
        """Return True if *language_code* is in the supported set."""
        return language_code in self._registry

    def validate(self, language_code: str) -> str:
        """
        Validate *language_code* and return it normalised (lower-case).

        Raises
        ------
        UnsupportedLanguageError
        """
        normalised = language_code.strip().lower()
        if not self.is_supported(normalised):
            raise UnsupportedLanguageError(normalised)
        return normalised

    # ── Info ──────────────────────────────────────────────────────────────────

    def get_info(self, language_code: str) -> LanguageInfo:
        """
        Return LanguageInfo for *language_code*.

        Raises
        ------
        UnsupportedLanguageError
        """
        code = self.validate(language_code)
        return self._registry[code]

    def display_name(self, language_code: str) -> str:
        """Return the human-readable name for *language_code*."""
        return self.get_info(language_code).display_name

    def is_rtl(self, language_code: str) -> bool:
        """Return True if the language is right-to-left."""
        return self.get_info(language_code).rtl

    def is_dialect(self, language_code: str) -> bool:
        """Return True if the language is a regional dialect."""
        return self.get_info(language_code).is_dialect

    # ── Listing ───────────────────────────────────────────────────────────────

    def all_codes(self) -> list[str]:
        """Return all supported language codes."""
        return list(self._registry.keys())

    def standard_codes(self) -> list[str]:
        """Return only non-dialect language codes."""
        return [c for c, info in self._registry.items() if not info.is_dialect]

    def dialect_codes(self) -> list[str]:
        """Return only dialect language codes."""
        return [c for c, info in self._registry.items() if info.is_dialect]

    def all_info(self) -> list[LanguageInfo]:
        """Return LanguageInfo for every supported language."""
        return list(self._registry.values())

    # ── Fallback resolution ───────────────────────────────────────────────────

    def resolve_fallback(self, language_code: str) -> str:
        """
        Return the best available fallback for *language_code*.

        Resolution order:
          1. The requested language itself (if supported)
          2. The parent language (for dialects)
          3. The configured default language
          4. English (``"en"``) as last resort
        """
        normalised = language_code.strip().lower()

        if self.is_supported(normalised):
            return normalised

        # Try parent for dialects (e.g. "rj/bagri" → "hi")
        info = self._registry.get(normalised)
        if info and info.parent_code and self.is_supported(info.parent_code):
            _log.debug("Fallback: %s → %s (parent)", normalised, info.parent_code)
            return info.parent_code

        # Default language
        if self.is_supported(DEFAULT_LANGUAGE):
            _log.debug("Fallback: %s → %s (default)", normalised, DEFAULT_LANGUAGE)
            return DEFAULT_LANGUAGE

        _log.debug("Fallback: %s → en (last resort)", normalised)
        return FALLBACK_LANGUAGE

    def fallback_chain(self, language_code: str) -> list[str]:
        """
        Return the ordered fallback chain for *language_code*.

        Example: ``"rj/bagri"`` → ``["rj/bagri", "hi", "en"]``
        """
        chain: list[str] = []
        normalised = language_code.strip().lower()

        if self.is_supported(normalised):
            chain.append(normalised)

        info = self._registry.get(normalised)
        if info and info.parent_code and info.parent_code not in chain:
            chain.append(info.parent_code)

        if DEFAULT_LANGUAGE not in chain:
            chain.append(DEFAULT_LANGUAGE)

        if FALLBACK_LANGUAGE not in chain:
            chain.append(FALLBACK_LANGUAGE)

        return chain

    # ── Translation loading ───────────────────────────────────────────────────

    def load_translation(
        self,
        language_code: str,
        page: str,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        """
        Load the translation JSON for *language_code* and *page*.

        Falls back through the fallback chain if the primary file is
        absent.

        Parameters
        ----------
        language_code : e.g. ``"hi"``, ``"rj/bagri"``
        page          : e.g. ``"home"``, ``"login"``
        use_cache     : return cached result if available

        Returns
        -------
        Parsed translation dict

        Raises
        ------
        TranslationNotFoundError — no translation found in any fallback
        """
        cache_key = (language_code, page)
        if use_cache and cache_key in self._translation_cache:
            return self._translation_cache[cache_key]

        # Lazy import to avoid circular dependency
        from utils.json_manager import JSONManager  # noqa: PLC0415
        jm = JSONManager()

        for code in self.fallback_chain(language_code):
            translation_path = PATHS.translation_path(code, page)
            if translation_path.exists():
                data = jm.read_safe(translation_path)
                if data is not None:
                    if use_cache:
                        self._translation_cache[cache_key] = data
                    _log.debug(
                        "Loaded translation: lang=%s page=%s (resolved=%s)",
                        language_code, page, code,
                    )
                    return data

        raise TranslationNotFoundError(language_code, page)

    def clear_cache(self) -> None:
        """Evict all cached translations."""
        self._translation_cache.clear()
        _log.debug("Translation cache cleared.")

    def translation_exists(self, language_code: str, page: str) -> bool:
        """Return True if a translation file exists for the given pair."""
        return PATHS.translation_path(language_code, page).exists()

    # ── Available translations ────────────────────────────────────────────────

    def available_translations(self) -> dict[str, list[str]]:
        """
        Scan the translations directory and return a mapping of
        ``language_code → [page, ...]`` for all present files.
        """
        result: dict[str, list[str]] = {}
        translations_dir = PATHS.translations

        if not translations_dir.exists():
            return result

        for lang_dir in sorted(translations_dir.iterdir()):
            if not lang_dir.is_dir():
                continue
            # Handle nested dialects like rj/bagri
            for json_file in sorted(lang_dir.rglob("*.json")):
                relative = json_file.relative_to(translations_dir)
                parts = relative.parts
                if len(parts) < 2:
                    continue
                # Build language code from directory path minus filename
                lang_code = "/".join(parts[:-1])
                page = json_file.stem
                result.setdefault(lang_code, []).append(page)

        return result
