"""
Voice Guide AI — Error Manager.

Handles runtime error recovery for:
  * Missing JSON
  * Missing Translation
  * Missing Audio
  * Missing Avatar
  * Invalid Dialogue
  * Invalid Language
  * General playback failures

Recovery strategy:
  1. Log the error with full context.
  2. Dispatch an error runtime event.
  3. Return a safe fallback result dict (never raises).
  4. Attempt language fallback (→ hi → en) for translation errors.

Thread-safe.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.error_manager")

# Error codes that trigger language fallback
_LANGUAGE_FALLBACK_CODES = frozenset({
    "TRANSLATION_NOT_FOUND",
    "UNSUPPORTED_LANGUAGE",
    "DIALOGUE_NOT_FOUND",
})

# Fallback chain: try these languages in order
_FALLBACK_CHAIN = ["hi", "en"]

# Static error messages per language
_ERROR_MESSAGES: dict[str, str] = {
    "hi": "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
    "en": "Something went wrong. Please try again.",
    "gu": "કંઈક ખોટું થઈ ગયું. કૃપા કરી ફરી પ્રયાસ કરો.",
    "pa": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    "ta": "ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    "te": "ఏదో తప్పు జరిగింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    "kn": "ಏನೋ ತಪ್ಪಾಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "ml": "എന്തോ തെറ്റ് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
    "bn": "কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
    "ur": "کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔",
    "od": "କିଛି ଭୁଲ ହୋଇଗଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
}


class ErrorRecord:
    """A single error occurrence record."""

    def __init__(
        self,
        page: str,
        error_code: str,
        message: str,
        language: str,
    ) -> None:
        self.page = page
        self.error_code = error_code
        self.message = message
        self.language = language
        self.timestamp = Helper.current_timestamp()
        self.error_id = Helper.generate_short_id()

    def to_dict(self) -> dict[str, Any]:
        return {
            "error_id": self.error_id,
            "page": self.page,
            "error_code": self.error_code,
            "message": self.message,
            "language": self.language,
            "timestamp": self.timestamp,
        }


class ErrorManager:
    """
    Handles runtime error recovery and maintains an error log.

    Thread-safe.
    """

    def __init__(self, event_dispatcher: Any) -> None:
        self._events = event_dispatcher
        self._error_log: list[ErrorRecord] = []
        self._lock = threading.Lock()

    # ── Public API ────────────────────────────────────────────────────────────

    def handle(
        self,
        page: str,
        error_code: str,
        message: str,
        language: str,
        context: Optional[dict[str, Any]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Handle a runtime error.

        Steps
        -----
        1. Record the error.
        2. Dispatch error event.
        3. Return a safe fallback result dict, or None if the caller
           should attempt its own recovery.

        Returns
        -------
        dict — safe fallback result, or None
        """
        record = self._record(page, error_code, message, language)
        self._events.error(page, error_code, message)

        _log.error(
            "Runtime error: id=%s page=%s code=%s lang=%s | %s",
            record.error_id, page, error_code, language, message,
        )

        if error_code in _LANGUAGE_FALLBACK_CODES:
            fallback_lang = self._fallback_language(language)
            _log.info(
                "Language fallback: %s → %s (error=%s)",
                language, fallback_lang, error_code,
            )
            return self._fallback_result(page, error_code, message, fallback_lang)

        return self._fallback_result(page, error_code, message, language)

    def record_only(
        self,
        page: str,
        error_code: str,
        message: str,
        language: str,
    ) -> ErrorRecord:
        """Record an error without dispatching an event or returning a result."""
        return self._record(page, error_code, message, language)

    # ── Error log ─────────────────────────────────────────────────────────────

    def get_errors(
        self,
        page: Optional[str] = None,
        error_code: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Return error log, optionally filtered by page or error_code."""
        with self._lock:
            records = list(self._error_log)
        if page:
            records = [r for r in records if r.page == page]
        if error_code:
            records = [r for r in records if r.error_code == error_code]
        return [r.to_dict() for r in records]

    def error_count(self) -> int:
        with self._lock:
            return len(self._error_log)

    def clear_errors(self) -> None:
        with self._lock:
            self._error_log.clear()
        _log.debug("Error log cleared.")

    # ── Internal ──────────────────────────────────────────────────────────────

    def _record(
        self,
        page: str,
        error_code: str,
        message: str,
        language: str,
    ) -> ErrorRecord:
        record = ErrorRecord(page, error_code, message, language)
        with self._lock:
            self._error_log.append(record)
        return record

    @staticmethod
    def _fallback_language(language: str) -> str:
        """Return the next language in the fallback chain."""
        for lang in _FALLBACK_CHAIN:
            if lang != language:
                return lang
        return "en"

    @staticmethod
    def _fallback_result(
        page: str,
        error_code: str,
        message: str,
        language: str,
    ) -> dict[str, Any]:
        text = (
            _ERROR_MESSAGES.get(language)
            or _ERROR_MESSAGES.get("hi")
            or _ERROR_MESSAGES["en"]
        )
        return {
            "success": False,
            "operation": "play",
            "dialogue_id": "error_fallback",
            "page": page,
            "language": language,
            "state": "error",
            "error": message,
            "error_code": error_code,
            "text": text,
            "events": [],
            "metadata": {"recovered": True},
        }
