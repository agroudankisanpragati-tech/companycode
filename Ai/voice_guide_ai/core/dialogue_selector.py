"""
Voice Guide AI — Dialogue Selector.

Loads, validates, and returns dialogue JSON documents.
Merges translation text when a language code is provided.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from config.exceptions import (
    DialogueNotFoundError,
    DialogueValidationError,
)
from config.logger import get_logger, log_performance
from config.paths import PATHS
from utils.json_manager import JSONManager
from utils.language_manager import LanguageManager
from utils.validation import Validator

_log = get_logger("dialogue_selector")


class DialogueSelector:
    """
    Resolves and loads dialogue JSON files.

    Responsibilities
    ----------------
    * Build the correct file path from (page, dialogue_type)
    * Validate the JSON schema
    * Optionally merge translated text from the translations directory
    * Provide existence checks without loading
    """

    def __init__(
        self,
        json_manager: Optional[JSONManager] = None,
        language_manager: Optional[LanguageManager] = None,
        validator: Optional[Validator] = None,
    ) -> None:
        self._jm  = json_manager or JSONManager()
        self._lm  = language_manager or LanguageManager()
        self._val = validator or Validator()

    # ── Public API ────────────────────────────────────────────────────────────

    @log_performance("dialogue_select")
    def get_dialogue(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
        validate: bool = True,
    ) -> dict[str, Any]:
        """
        Load and return a dialogue JSON document.

        Parameters
        ----------
        page          : page identifier (e.g. ``"login"``, ``"home"``)
        dialogue_type : dialogue type (e.g. ``"welcome"``, ``"error"``)
        language      : if provided, merge translated text into the result
        validate      : if True, validate required keys before returning

        Returns
        -------
        Parsed dialogue dict, optionally with translated ``text`` field

        Raises
        ------
        DialogueNotFoundError    — file does not exist
        DialogueValidationError  — JSON fails schema validation
        """
        path = PATHS.dialogue_path(page, dialogue_type)

        if not path.exists():
            raise DialogueNotFoundError(page, dialogue_type)

        dialogue = self._jm.read(path)

        if validate:
            result = self._val.validate_dialogue_json(dialogue, str(path))
            if not result.valid:
                raise DialogueValidationError(str(path), "; ".join(result.errors))

        if language:
            dialogue = self._merge_translation(dialogue, page, language)

        _log.debug("Selected dialogue: page=%s type=%s lang=%s", page, dialogue_type, language)
        return dialogue

    def get_dialogue_safe(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """Return the dialogue or None on any error (no exception raised)."""
        try:
            return self.get_dialogue(page, dialogue_type, language)
        except Exception as exc:  # noqa: BLE001
            _log.warning(
                "get_dialogue_safe failed: page=%s type=%s — %s",
                page, dialogue_type, exc,
            )
            return None

    def dialogue_exists(self, page: str, dialogue_type: str) -> bool:
        """Return True if the dialogue file exists on disk."""
        return PATHS.dialogue_path(page, dialogue_type).exists()

    def list_dialogues(self, page: str) -> list[str]:
        """
        Return all dialogue type names available for *page*.

        Example: ``["welcome", "error", "help", "exit"]``
        """
        page_dir = PATHS.dialogues / page
        if not page_dir.exists():
            return []
        return sorted(f.stem for f in page_dir.glob("*.json") if f.is_file())

    def list_pages(self) -> list[str]:
        """Return all page names that have at least one dialogue file."""
        if not PATHS.dialogues.exists():
            return []
        return sorted(
            d.name for d in PATHS.dialogues.iterdir()
            if d.is_dir() and any(d.glob("*.json"))
        )

    def get_dialogue_path(self, page: str, dialogue_type: str) -> Path:
        """Return the absolute Path for a dialogue file (may not exist)."""
        return PATHS.dialogue_path(page, dialogue_type)

    # ── Translation merging ───────────────────────────────────────────────────

    def _merge_translation(
        self,
        dialogue: dict[str, Any],
        page: str,
        language: str,
    ) -> dict[str, Any]:
        """
        Merge translated text into *dialogue* for the given *language*.

        The translation file is expected to contain a ``"dialogues"`` dict
        keyed by dialogue ID.  If a matching entry is found, its ``"text"``
        value replaces the base dialogue's ``"text"``.

        Returns a shallow copy of *dialogue* with the merged text.
        """
        try:
            translation = self._lm.load_translation(language, page)
            dialogue_id = dialogue.get("id", "")

            # Translation files are flat dicts: { "dialogue_id": "text", ... }
            # Also support nested format: { "dialogues": { "id": { "text": "..." } } }
            translated_text: str | None = None

            flat_text = translation.get(dialogue_id)
            if isinstance(flat_text, str) and flat_text:
                translated_text = flat_text
            else:
                dialogues_map: dict = translation.get("dialogues", {})
                entry = dialogues_map.get(dialogue_id)
                if isinstance(entry, dict) and "text" in entry:
                    translated_text = entry["text"]
                elif isinstance(entry, str) and entry:
                    translated_text = entry

            if translated_text:
                merged = dict(dialogue)
                merged["text"] = translated_text
                merged["_language"] = language
                return merged

        except Exception as exc:  # noqa: BLE001
            _log.debug(
                "Translation merge skipped for page=%s lang=%s: %s",
                page, language, exc,
            )

        return dialogue
