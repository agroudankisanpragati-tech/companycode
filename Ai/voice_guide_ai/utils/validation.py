"""
Voice Guide AI — Validation Module.

Provides validators for:
  * Dialogue IDs (format, uniqueness)
  * Translation IDs
  * Folder structure integrity
  * JSON schema compliance
  * Language codes
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from config.constants import (
    DIALOGUE_REQUIRED_KEYS,
    SUPPORTED_LANGUAGES,
    TRANSLATION_REQUIRED_KEYS,
)
from config.exceptions import (
    DialogueValidationError,
    JSONValidationError,
    UnsupportedLanguageError,
)
from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("validation")

# Dialogue ID must be: lowercase letters, digits, underscores, hyphens, 3–80 chars
_DIALOGUE_ID_PATTERN: re.Pattern[str] = re.compile(r"^[a-z0-9_\-]{3,80}$")


@dataclass
class ValidationResult:
    """Structured result returned by every validator."""

    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.valid = False

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)

    def __bool__(self) -> bool:
        return self.valid

    def summary(self) -> str:
        parts = [f"valid={self.valid}"]
        if self.errors:
            parts.append(f"errors={self.errors}")
        if self.warnings:
            parts.append(f"warnings={self.warnings}")
        return "ValidationResult(" + ", ".join(parts) + ")"


class Validator:
    """
    Reusable validator for all Voice Guide AI data structures.

    Every method returns a ``ValidationResult`` and optionally raises
    a typed exception when ``raise_on_error=True``.
    """

    # ── Language code ─────────────────────────────────────────────────────────

    def validate_language_code(
        self,
        language_code: str,
        raise_on_error: bool = False,
    ) -> ValidationResult:
        """Validate that *language_code* is in the supported set."""
        result = ValidationResult(valid=True)
        normalised = language_code.strip().lower()

        if normalised not in SUPPORTED_LANGUAGES:
            result.add_error(
                f"Language code '{normalised}' is not supported. "
                f"Supported: {sorted(SUPPORTED_LANGUAGES.keys())}"
            )
            if raise_on_error:
                raise UnsupportedLanguageError(normalised)

        return result

    # ── Dialogue ID ───────────────────────────────────────────────────────────

    def validate_dialogue_id(
        self,
        dialogue_id: str,
        raise_on_error: bool = False,
    ) -> ValidationResult:
        """Validate the format of a dialogue ID."""
        result = ValidationResult(valid=True)

        if not dialogue_id:
            result.add_error("Dialogue ID must not be empty.")
        elif not _DIALOGUE_ID_PATTERN.match(dialogue_id):
            result.add_error(
                f"Dialogue ID '{dialogue_id}' is invalid. "
                "Must be 3–80 chars: lowercase letters, digits, underscores, hyphens."
            )

        if not result.valid and raise_on_error:
            raise DialogueValidationError("", f"Invalid ID: {dialogue_id}")

        return result

    # ── JSON schema ───────────────────────────────────────────────────────────

    def validate_json_schema(
        self,
        data: dict[str, Any],
        required_keys: list[str],
        path: str = "",
        raise_on_error: bool = False,
    ) -> ValidationResult:
        """Validate that *data* contains all *required_keys*."""
        result = ValidationResult(valid=True)
        missing = [k for k in required_keys if k not in data]

        if missing:
            result.add_error(f"Missing required keys: {missing}")
            if raise_on_error:
                raise JSONValidationError(path, missing)

        return result

    def validate_dialogue_json(
        self,
        data: dict[str, Any],
        path: str = "",
        raise_on_error: bool = False,
    ) -> ValidationResult:
        """Validate a dialogue JSON document against the required schema."""
        result = self.validate_json_schema(
            data, DIALOGUE_REQUIRED_KEYS, path, raise_on_error
        )

        # Additional semantic checks
        if "id" in data:
            id_result = self.validate_dialogue_id(data["id"])
            if not id_result.valid:
                for err in id_result.errors:
                    result.add_error(err)

        if "status" in data and data["status"] not in ("active", "inactive", "draft"):
            result.add_warning(
                f"Unexpected status value '{data['status']}' in '{path}'."
            )

        if not result.valid and raise_on_error:
            raise DialogueValidationError(path, "; ".join(result.errors))

        return result

    def validate_translation_json(
        self,
        data: dict[str, Any],
        path: str = "",
        raise_on_error: bool = False,
    ) -> ValidationResult:
        """Validate a translation JSON document."""
        result = self.validate_json_schema(
            data, TRANSLATION_REQUIRED_KEYS, path, raise_on_error
        )

        if "language" in data:
            lang_result = self.validate_language_code(data["language"])
            if not lang_result.valid:
                for err in lang_result.errors:
                    result.add_warning(err)

        return result

    # ── Folder structure ──────────────────────────────────────────────────────

    def validate_folder_structure(self) -> ValidationResult:
        """
        Verify that all required module directories exist.

        Checks: dialogues/, translations/, config/, avatar/config/, voice/
        """
        result = ValidationResult(valid=True)

        required_dirs: list[Path] = [
            PATHS.dialogues,
            PATHS.translations,
            PATHS.config,
            PATHS.avatar_config,
            PATHS.voice,
        ]

        for directory in required_dirs:
            if not directory.exists():
                result.add_error(f"Required directory missing: {directory}")
            elif not directory.is_dir():
                result.add_error(f"Path exists but is not a directory: {directory}")

        if result.valid:
            _log.info("Folder structure validation passed.")
        else:
            _log.warning("Folder structure validation failed: %s", result.errors)

        return result

    def validate_translation_coverage(
        self,
        expected_pages: list[str],
    ) -> ValidationResult:
        """
        Check that every *expected_page* has a translation file for
        every supported language.
        """
        result = ValidationResult(valid=True)

        for lang_code in SUPPORTED_LANGUAGES:
            for page in expected_pages:
                path = PATHS.translation_path(lang_code, page)
                if not path.exists():
                    result.add_warning(
                        f"Missing translation: lang={lang_code}, page={page}"
                    )

        return result

    def validate_dialogue_directory(
        self,
        page: str,
        expected_types: list[str] | None = None,
    ) -> ValidationResult:
        """
        Validate that the dialogue directory for *page* exists and
        contains the expected dialogue type files.
        """
        result = ValidationResult(valid=True)
        page_dir = PATHS.dialogues / page

        if not page_dir.exists():
            result.add_error(f"Dialogue directory missing: {page_dir}")
            return result

        if expected_types:
            for dtype in expected_types:
                file_path = page_dir / f"{dtype}.json"
                if not file_path.exists():
                    result.add_warning(
                        f"Expected dialogue file missing: {file_path}"
                    )

        return result

    # ── Batch validation ──────────────────────────────────────────────────────

    def validate_all_dialogues(self) -> ValidationResult:
        """
        Load and validate every JSON file under dialogues/.

        Returns a combined ValidationResult with all errors and warnings.
        """
        from utils.json_manager import JSONManager  # noqa: PLC0415

        result = ValidationResult(valid=True)
        jm = JSONManager()

        if not PATHS.dialogues.exists():
            result.add_error(f"Dialogues directory not found: {PATHS.dialogues}")
            return result

        for json_file in sorted(PATHS.dialogues.rglob("*.json")):
            data = jm.read_safe(json_file)
            if data is None:
                result.add_error(f"Could not read: {json_file}")
                continue
            sub = self.validate_dialogue_json(data, str(json_file))
            result.errors.extend(sub.errors)
            result.warnings.extend(sub.warnings)
            if sub.errors:
                result.valid = False

        _log.info(
            "Batch dialogue validation: %d errors, %d warnings",
            len(result.errors), len(result.warnings),
        )
        return result
