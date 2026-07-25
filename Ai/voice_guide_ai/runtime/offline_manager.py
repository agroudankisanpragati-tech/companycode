"""
Voice Guide AI — Offline Manager.

Handles offline mode:
  * go_offline() — switch to offline mode, dispatch event, update session
  * go_online()  — restore online mode, dispatch event
  * get_offline_guidance() — return offline fallback dialogue result
  * Never crashes; always returns a safe fallback response

Offline guidance is a static in-memory fallback that does not require
any file I/O, network access, or audio assets.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.offline_manager")

# Static offline guidance messages per language (fallback chain: lang → hi → en)
_OFFLINE_MESSAGES: dict[str, str] = {
    "hi": "आप अभी ऑफलाइन हैं। कृपया इंटरनेट कनेक्शन जांचें।",
    "en": "You are currently offline. Please check your internet connection.",
    "gu": "તમે હાલ ઑફલાઇન છો. કૃપા કરી ઇન્ટરનેટ કનેક્શન તપાસો.",
    "pa": "ਤੁਸੀਂ ਹੁਣ ਔਫਲਾਈਨ ਹੋ। ਕਿਰਪਾ ਕਰਕੇ ਇੰਟਰਨੈੱਟ ਕਨੈਕਸ਼ਨ ਜਾਂਚੋ।",
    "ta": "நீங்கள் தற்போது ஆஃப்லைனில் உள்ளீர்கள். இணைய இணைப்பை சரிபார்க்கவும்.",
    "te": "మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు. దయచేసి ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేయండి.",
    "kn": "ನೀವು ಪ್ರಸ್ತುತ ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ.",
    "ml": "നിങ്ങൾ ഇപ്പോൾ ഓഫ്‌ലൈനിലാണ്. ദയവായി ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിക്കുക.",
    "bn": "আপনি এখন অফলাইনে আছেন। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন।",
    "ur": "آپ ابھی آف لائن ہیں۔ براہ کرم انٹرنیٹ کنکشن چیک کریں۔",
    "od": "ଆପଣ ବର୍ତ୍ତମାନ ଅଫଲାଇନ୍ ଅଛନ୍ତି। ଦୟାକରି ଇଣ୍ଟରନେଟ୍ ସଂଯୋଗ ଯାଞ୍ଚ କରନ୍ତୁ।",
}

_OFFLINE_DIALOGUE_ID = "offline_guidance"


class OfflineManager:
    """
    Manages offline mode state and provides fallback guidance.

    Thread-safe.
    """

    def __init__(
        self,
        event_dispatcher: Any,
        session_manager: Any,
        condition_manager: Any,
    ) -> None:
        self._events = event_dispatcher
        self._session = session_manager
        self._conditions = condition_manager
        self._is_offline = False
        self._offline_since: Optional[str] = None
        self._lock = threading.Lock()

    # ── Mode switching ────────────────────────────────────────────────────────

    def go_offline(self) -> None:
        """Switch to offline mode."""
        with self._lock:
            if self._is_offline:
                return
            self._is_offline = True
            self._offline_since = Helper.current_timestamp()

        self._session.set_online(False)
        self._conditions.set_internet(False)
        self._events.offline()
        _log.warning("Runtime switched to OFFLINE mode.")

    def go_online(self) -> None:
        """Restore online mode."""
        with self._lock:
            if not self._is_offline:
                return
            self._is_offline = False
            self._offline_since = None

        self._session.set_online(True)
        self._conditions.set_internet(True)
        self._events.online()
        _log.info("Runtime restored to ONLINE mode.")

    # ── Offline guidance ──────────────────────────────────────────────────────

    def get_offline_guidance(
        self,
        page: str,
        dialogue_type: str,
        language: str,
    ) -> dict[str, Any]:
        """
        Return a static offline guidance result.

        Never raises.  Always returns a valid dict that the caller can
        treat as a dialogue result.
        """
        message = (
            _OFFLINE_MESSAGES.get(language)
            or _OFFLINE_MESSAGES.get("hi")
            or _OFFLINE_MESSAGES["en"]
        )

        _log.info(
            "Offline guidance served: page=%s type=%s lang=%s",
            page, dialogue_type, language,
        )

        return {
            "success": True,
            "operation": "play",
            "dialogue_id": _OFFLINE_DIALOGUE_ID,
            "page": page,
            "language": language,
            "state": "offline",
            "offline": True,
            "text": message,
            "error": None,
            "error_code": None,
            "events": [],
            "metadata": {
                "dialogue_type": dialogue_type,
                "offline_since": self._offline_since,
            },
        }

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def is_offline(self) -> bool:
        with self._lock:
            return self._is_offline

    @property
    def offline_since(self) -> Optional[str]:
        with self._lock:
            return self._offline_since

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "is_offline": self._is_offline,
                "offline_since": self._offline_since,
            }
