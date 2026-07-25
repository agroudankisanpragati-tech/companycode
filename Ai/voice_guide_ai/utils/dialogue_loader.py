"""
Voice Guide AI — Dialogue Loader.

Loads dialogue JSON files from disk with:
  * In-memory caching (via CacheManager)
  * Fallback dialogue type resolution (welcome → help → common)
  * Translation text injection from translations/
  * Batch preloading for a page
  * Existence checks without loading

This is a higher-level wrapper over JSONManager + LanguageManager
that adds caching and fallback resolution.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from config.exceptions import DialogueNotFoundError
from config.logger import get_logger
from config.paths import PATHS
from utils.cache_manager import CacheManager
from utils.json_manager import JSONManager
from utils.language_manager import LanguageManager

_log = get_logger("utils.dialogue_loader")

# Fallback dialogue type chain: if requested type is missing, try these in order
_DIALOGUE_TYPE_FALLBACK: dict[str, list[str]] = {
    "welcome":    ["welcome", "help", "common"],
    "help":       ["help", "welcome", "common"],
    "error":      ["error", "common"],
    "offline":    ["offline", "error", "common"],
    "exit":       ["exit", "common"],
    "result":     ["result", "success", "common"],
    "processing": ["processing", "common"],
    "success":    ["success", "result", "common"],
    "failure":    ["failure", "error", "common"],
    "replay":     ["replay", "welcome", "common"],
}


class DialogueLoader:
    """
    Loads and caches dialogue JSON files with fallback resolution.

    Parameters
    ----------
    cache_manager    : shared CacheManager instance (or creates its own)
    json_manager     : JSONManager instance
    language_manager : LanguageManager instance
    """

    def __init__(
        self,
        cache_manager: Optional[CacheManager] = None,
        json_manager: Optional[JSONManager] = None,
        language_manager: Optional[LanguageManager] = None,
    ) -> None:
        self._cache = cache_manager or CacheManager()
        self._jm = json_manager or JSONManager()
        self._lm = language_manager or LanguageManager()

    # ── Public API ────────────────────────────────────────────────────────────

    def load(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
        use_cache: bool = True,
        use_fallback: bool = True,
    ) -> dict[str, Any]:
        """
        Load a dialogue JSON for *page* / *dialogue_type*.

        Parameters
        ----------
        page          : page identifier, e.g. "login"
        dialogue_type : dialogue type, e.g. "welcome"
        language      : if provided, inject translated text
        use_cache     : return cached result when available
        use_fallback  : try fallback dialogue types if primary is missing

        Returns
        -------
        Parsed dialogue dict with optional translated text

        Raises
        ------
        DialogueNotFoundError — no dialogue found (even after fallback)
        """
        cache_key = f"{page}:{dialogue_type}:{language or ''}"

        if use_cache:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

        dialogue = self._load_with_fallback(page, dialogue_type, use_fallback)

        if language:
            dialogue = self._inject_translation(dialogue, page, language)

        if use_cache:
            self._cache.set(cache_key, dialogue)

        return dialogue

    def load_safe(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Load a dialogue; return None instead of raising on any error."""
        try:
            return self.load(page, dialogue_type, language)
        except Exception as exc:
            _log.warning(
                "load_safe failed: page=%s type=%s lang=%s — %s",
                page, dialogue_type, language, exc,
            )
            return None

    def exists(self, page: str, dialogue_type: str) -> bool:
        """Return True if the dialogue file exists on disk."""
        return PATHS.dialogue_path(page, dialogue_type).exists()

    def list_types(self, page: str) -> list[str]:
        """Return all dialogue type names available for *page*."""
        page_dir = PATHS.dialogues / page
        if not page_dir.is_dir():
            return []
        return sorted(f.stem for f in page_dir.glob("*.json") if f.is_file())

    def preload_page(self, page: str, language: Optional[str] = None) -> int:
        """
        Preload all dialogue types for *page* into the cache.

        Returns the number of dialogues loaded.
        """
        types = self.list_types(page)
        loaded = 0
        for dtype in types:
            try:
                self.load(page, dtype, language)
                loaded += 1
            except Exception as exc:
                _log.debug("Preload skipped: page=%s type=%s — %s", page, dtype, exc)
        _log.debug("Preloaded %d dialogues for page=%s lang=%s", loaded, page, language)
        return loaded

    def invalidate(self, page: str, dialogue_type: Optional[str] = None) -> None:
        """Invalidate cache entries for *page* (and optionally *dialogue_type*)."""
        self._cache.invalidate_page(page)
        _log.debug("Cache invalidated: page=%s type=%s", page, dialogue_type)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load_with_fallback(
        self, page: str, dialogue_type: str, use_fallback: bool
    ) -> dict[str, Any]:
        """Try the requested type, then fallback types if enabled."""
        candidates = (
            _DIALOGUE_TYPE_FALLBACK.get(dialogue_type, [dialogue_type])
            if use_fallback
            else [dialogue_type]
        )

        for dtype in candidates:
            path = PATHS.dialogue_path(page, dtype)
            if path.exists():
                data = self._jm.read_safe(path)
                if data is not None:
                    _log.debug(
                        "Loaded dialogue: page=%s type=%s (requested=%s)",
                        page, dtype, dialogue_type,
                    )
                    return data

        raise DialogueNotFoundError(page, dialogue_type)

    def _inject_translation(
        self,
        dialogue: dict[str, Any],
        page: str,
        language: str,
    ) -> dict[str, Any]:
        """
        Inject translated text into *dialogue* for *language*.

        The translation file is a flat dict of dialogue_id → text string.
        If the dialogue ID is found, its text replaces the base text.
        Returns a shallow copy — never mutates the original.
        """
        dialogue_id = dialogue.get("id", "")
        if not dialogue_id:
            return dialogue

        try:
            translation_path = PATHS.translation_path(language, page)
            if not translation_path.exists():
                # Try fallback language
                for fallback_lang in self._lm.fallback_chain(language)[1:]:
                    translation_path = PATHS.translation_path(fallback_lang, page)
                    if translation_path.exists():
                        break
                else:
                    return dialogue

            data = self._jm.read_safe(translation_path)
            if data is None:
                return dialogue

            # Translation file is a flat dict: { "dialogue_id": "text", ... }
            translated_text = data.get(dialogue_id)
            if translated_text and isinstance(translated_text, str):
                merged = dict(dialogue)
                merged["text"] = translated_text
                merged["_language"] = language
                return merged

        except Exception as exc:
            _log.debug(
                "Translation inject skipped: page=%s lang=%s id=%s — %s",
                page, language, dialogue_id, exc,
            )

        return dialogue
