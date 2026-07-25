"""
Voice Guide AI — Text Loader.

Reads translation JSON files from voice_guide_ai/translations/ and
yields structured records for audio generation.

Translation file structure
--------------------------
translations/
  {language}/
    {module}.json          →  { "dialogue_id": "text", ... }
  rj/
    {dialect}/
      {module}.json

Yields
------
TextRecord(language, module, dialogue_id, text)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from config.logger import get_logger

_log = get_logger("voice.generators.text_loader")

SUPPORTED_MODULES = [
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
]


@dataclass(frozen=True)
class TextRecord:
    """A single text entry ready for TTS generation."""
    language:    str
    module:      str
    dialogue_id: str
    text:        str

    def cache_key(self) -> str:
        return f"{self.language}/{self.module}/{self.dialogue_id}"


class TextLoader:
    """
    Loads all translation texts from the translations directory.

    Parameters
    ----------
    translations_dir : absolute path to voice_guide_ai/translations/
    languages        : list of language codes to load; None = all found
    modules          : list of module names to load; None = all found
    """

    def __init__(
        self,
        translations_dir: Path,
        languages: list[str] | None = None,
        modules: list[str] | None = None,
    ) -> None:
        self._root = translations_dir
        self._languages = languages
        self._modules = modules or SUPPORTED_MODULES

    # ── Public API ────────────────────────────────────────────────────────────

    def load_all(self) -> list[TextRecord]:
        """Load and return all TextRecords."""
        return list(self.iter_records())

    def load_language(self, language: str) -> list[TextRecord]:
        """Load all TextRecords for a single *language*."""
        return list(self._iter_language(language))

    def load_module(self, language: str, module: str) -> list[TextRecord]:
        """Load all TextRecords for *language* / *module*."""
        return list(self._iter_module(language, module))

    def iter_records(self) -> Iterator[TextRecord]:
        """Yield all TextRecords across all languages and modules."""
        for lang_dir in self._discover_language_dirs():
            language = self._dir_to_language(lang_dir)
            if self._languages and language not in self._languages:
                continue
            yield from self._iter_language(language)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _iter_language(self, language: str) -> Iterator[TextRecord]:
        lang_dir = self._language_dir(language)
        if not lang_dir.is_dir():
            _log.warning("Translation dir not found: %s", lang_dir)
            return
        for module in self._modules:
            yield from self._iter_module(language, module)

    def _iter_module(self, language: str, module: str) -> Iterator[TextRecord]:
        path = self._language_dir(language) / f"{module}.json"
        if not path.is_file():
            _log.debug("Translation file missing: %s", path)
            return
        try:
            with open(path, encoding="utf-8-sig") as fh:
                data: dict = json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            _log.warning("Cannot read translation %s: %s", path, exc)
            return

        for dialogue_id, text in data.items():
            if not isinstance(text, str) or not text.strip():
                _log.debug("Skipping empty text: %s / %s", module, dialogue_id)
                continue
            yield TextRecord(
                language=language,
                module=module,
                dialogue_id=dialogue_id,
                text=text.strip(),
            )

    def _language_dir(self, language: str) -> Path:
        """Map a language code to its translations directory."""
        # "rj/marwari" → translations/rj/marwari/
        return self._root / Path(language)

    def _discover_language_dirs(self) -> list[Path]:
        """
        Discover all language directories under translations/.

        Handles both flat (hi/, en/) and nested (rj/marwari/) structures.
        """
        dirs: list[Path] = []
        if not self._root.is_dir():
            _log.error("Translations root not found: %s", self._root)
            return dirs

        for item in sorted(self._root.iterdir()):
            if not item.is_dir() or item.name.startswith("."):
                continue
            # Check for nested dialect dirs (e.g. rj/)
            has_json = any(item.glob("*.json"))
            has_subdirs = any(s.is_dir() for s in item.iterdir())

            if has_json:
                dirs.append(item)
            elif has_subdirs:
                for sub in sorted(item.iterdir()):
                    if sub.is_dir() and not sub.name.startswith("."):
                        dirs.append(sub)
        return dirs

    def _dir_to_language(self, lang_dir: Path) -> str:
        """Convert a directory path back to a language code string."""
        try:
            rel = lang_dir.relative_to(self._root)
            return rel.as_posix()
        except ValueError:
            return lang_dir.name
