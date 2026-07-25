"""
Voice Guide AI — Custom Exception Hierarchy.

All domain-specific exceptions are defined here so callers can catch
them at the appropriate granularity without depending on built-ins.
"""

from __future__ import annotations


class VoiceGuideError(Exception):
    """Base exception for the entire Voice Guide AI module."""

    def __init__(self, message: str, code: str = "VOICE_GUIDE_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(code={self.code!r}, message={self.message!r})"


# ── Configuration ──────────────────────────────────────────────────────────────

class ConfigurationError(VoiceGuideError):
    """Raised when a required configuration value is missing or invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="CONFIGURATION_ERROR")


class EnvironmentError(VoiceGuideError):  # noqa: A001
    """Raised when a required environment variable is absent."""

    def __init__(self, variable: str) -> None:
        super().__init__(
            f"Required environment variable '{variable}' is not set.",
            code="ENVIRONMENT_ERROR",
        )
        self.variable = variable


# ── File / Path ────────────────────────────────────────────────────────────────

class PathNotFoundError(VoiceGuideError):
    """Raised when a required path does not exist on disk."""

    def __init__(self, path: str) -> None:
        super().__init__(f"Path not found: {path}", code="PATH_NOT_FOUND")
        self.path = path


class FileReadError(VoiceGuideError):
    """Raised when a file cannot be read."""

    def __init__(self, path: str, reason: str = "") -> None:
        msg = f"Cannot read file '{path}'" + (f": {reason}" if reason else "")
        super().__init__(msg, code="FILE_READ_ERROR")
        self.path = path


class FileWriteError(VoiceGuideError):
    """Raised when a file cannot be written."""

    def __init__(self, path: str, reason: str = "") -> None:
        msg = f"Cannot write file '{path}'" + (f": {reason}" if reason else "")
        super().__init__(msg, code="FILE_WRITE_ERROR")
        self.path = path


# ── JSON ───────────────────────────────────────────────────────────────────────

class JSONParseError(VoiceGuideError):
    """Raised when a JSON file cannot be decoded."""

    def __init__(self, path: str, reason: str = "") -> None:
        msg = f"Invalid JSON in '{path}'" + (f": {reason}" if reason else "")
        super().__init__(msg, code="JSON_PARSE_ERROR")
        self.path = path


class JSONValidationError(VoiceGuideError):
    """Raised when a JSON document is missing required keys or has wrong types."""

    def __init__(self, path: str, missing_keys: list[str] | None = None) -> None:
        keys_info = f" Missing keys: {missing_keys}" if missing_keys else ""
        super().__init__(
            f"JSON validation failed for '{path}'.{keys_info}",
            code="JSON_VALIDATION_ERROR",
        )
        self.path = path
        self.missing_keys = missing_keys or []


class DuplicateIDError(VoiceGuideError):
    """Raised when duplicate dialogue IDs are detected."""

    def __init__(self, dialogue_id: str, path: str) -> None:
        super().__init__(
            f"Duplicate dialogue ID '{dialogue_id}' found in '{path}'.",
            code="DUPLICATE_ID_ERROR",
        )
        self.dialogue_id = dialogue_id
        self.path = path


# ── Language ───────────────────────────────────────────────────────────────────

class UnsupportedLanguageError(VoiceGuideError):
    """Raised when a language code is not in the supported set."""

    def __init__(self, language_code: str) -> None:
        super().__init__(
            f"Language '{language_code}' is not supported.",
            code="UNSUPPORTED_LANGUAGE",
        )
        self.language_code = language_code


class TranslationNotFoundError(VoiceGuideError):
    """Raised when a translation file for a page/language pair is missing."""

    def __init__(self, language_code: str, page: str) -> None:
        super().__init__(
            f"Translation not found for language='{language_code}', page='{page}'.",
            code="TRANSLATION_NOT_FOUND",
        )
        self.language_code = language_code
        self.page = page


# ── Dialogue ───────────────────────────────────────────────────────────────────

class DialogueNotFoundError(VoiceGuideError):
    """Raised when a requested dialogue file does not exist."""

    def __init__(self, page: str, dialogue_type: str) -> None:
        super().__init__(
            f"Dialogue not found: page='{page}', type='{dialogue_type}'.",
            code="DIALOGUE_NOT_FOUND",
        )
        self.page = page
        self.dialogue_type = dialogue_type


class DialogueValidationError(VoiceGuideError):
    """Raised when a dialogue JSON fails schema validation."""

    def __init__(self, path: str, reason: str = "") -> None:
        msg = f"Dialogue validation failed for '{path}'" + (f": {reason}" if reason else "")
        super().__init__(msg, code="DIALOGUE_VALIDATION_ERROR")
        self.path = path


class DialogueConditionError(VoiceGuideError):
    """Raised when a dialogue condition cannot be evaluated."""

    def __init__(self, condition: str, reason: str = "") -> None:
        msg = f"Condition '{condition}' evaluation failed" + (f": {reason}" if reason else "")
        super().__init__(msg, code="DIALOGUE_CONDITION_ERROR")
        self.condition = condition


class DialogueStateError(VoiceGuideError):
    """Raised when an operation is invalid for the current dialogue state."""

    def __init__(self, current_state: str, operation: str) -> None:
        super().__init__(
            f"Cannot perform '{operation}' while in state '{current_state}'.",
            code="DIALOGUE_STATE_ERROR",
        )
        self.current_state = current_state
        self.operation = operation


class DialogueEngineError(VoiceGuideError):
    """General engine-level error."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="DIALOGUE_ENGINE_ERROR")


# ── History ────────────────────────────────────────────────────────────────────

class HistoryError(VoiceGuideError):
    """Raised when history operations fail."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="HISTORY_ERROR")
