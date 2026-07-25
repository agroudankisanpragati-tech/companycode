"""
Translation Loader — reads translation JSON files from disk.

Responsibilities
---------------
* Locate translation files for (language, module) pairs.
* Validate UTF-8 encoding and JSON structure.
* Populate TranslationCache on load.
* Never raise — return empty dict on any failure.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from config.paths import PATHS
from localization.translation_cache import TranslationCache

_log = get_logger("localization.translation_loader")

_MODULES: tuple[str, ...] = (
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
)


class TranslationLoader:
    """
    Loads translation JSON files from the translations/ directory tree.

    Parameters
    ----------
    cache : TranslationCache instance to populate on load
    """

    def __init__(self, cache: TranslationCache) -> None:
        self._cache = cache
        self._translations_root: Path = PATHS.translations

    # ── Public API ─────────────────────────────────────────────────────────────

    def load(self, language: str, module: str) -> dict[str, str]:
        """
        Load and return the translation dict for *language* / *module*.

        Returns cached data if available. Falls back to empty dict on error.
        """
        cached = self._cache.get_module(language, module)
        if cached is not None:
            return cached

        data = self._read_file(language, module)
        if data:
            self._cache.set_module(language, module, data)
        return data

    def load_all_modules(self, language: str) -> dict[str, dict[str, str]]:
        """Load every module for *language*. Returns mapping of module → translations."""
        result: dict[str, dict[str, str]] = {}
        for module in _MODULES:
            data = self.load(language, module)
            if data:
                result[module] = data
        return result

    def reload(self, language: str, module: str) -> dict[str, str]:
        """Force re-read from disk, bypassing cache."""
        self._cache.invalidate_module(language, module)
        return self.load(language, module)

    def file_exists(self, language: str, module: str) -> bool:
        """Return True if the translation file exists on disk."""
        return self._resolve_path(language, module).exists()

    def available_modules(self, language: str) -> list[str]:
        """Return list of modules that have translation files for *language*."""
        return [m for m in _MODULES if self.file_exists(language, m)]

    # ── Internal ───────────────────────────────────────────────────────────────

    def _resolve_path(self, language: str, module: str) -> Path:
        return self._translations_root / language / f"{module}.json"

    def _read_file(self, language: str, module: str) -> dict[str, str]:
        path = self._resolve_path(language, module)
        if not path.exists():
            _log.debug("Translation file not found: %s", path)
            return {}
        try:
            # utf-8-sig strips the UTF-8 BOM (\xef\xbb\xbf) written by Windows
            # editors; plain UTF-8 files are read identically.
            with open(path, encoding="utf-8-sig") as fh:
                data = json.load(fh)
            if not isinstance(data, dict):
                _log.warning("Translation file is not a dict: %s", path)
                return {}
            return {str(k): str(v) for k, v in data.items()}
        except (UnicodeDecodeError, json.JSONDecodeError, OSError) as exc:
            _log.error("Failed to load translation %s/%s: %s", language, module, exc)
            return {}
