"""
Voice Guide AI — Page Context.

Maintains a rich context snapshot for the currently active page,
including previous page, language, farmer profile, last AI response,
current avatar/audio state, and arbitrary page-level metadata.
Thread-safe.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("intelligence.page_context")

SUPPORTED_PAGES = frozenset({
    "language_popup", "home", "login", "register", "profile",
    "weather", "mandi", "soil_health", "crop_recommendation",
    "disease_detection", "government_scheme", "marketplace",
    "ai_chat", "app_settings", "common",
})


@dataclass
class FarmerProfile:
    """Minimal farmer profile used for context-aware decisions."""
    farmer_id: Optional[str] = None
    name: Optional[str] = None
    language: str = DEFAULT_LANGUAGE
    location: Optional[str] = None
    crop_type: Optional[str] = None
    profile_complete: bool = False
    logged_in: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "farmer_id": self.farmer_id,
            "name": self.name,
            "language": self.language,
            "location": self.location,
            "crop_type": self.crop_type,
            "profile_complete": self.profile_complete,
            "logged_in": self.logged_in,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FarmerProfile":
        return cls(
            farmer_id=data.get("farmer_id"),
            name=data.get("name"),
            language=data.get("language", DEFAULT_LANGUAGE),
            location=data.get("location"),
            crop_type=data.get("crop_type"),
            profile_complete=bool(data.get("profile_complete", False)),
            logged_in=bool(data.get("logged_in", False)),
        )


class PageContext:
    """
    Maintains the full context for the active page.
    Thread-safe.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current_page: Optional[str] = None
        self._previous_page: Optional[str] = None
        self._current_language: str = DEFAULT_LANGUAGE
        self._farmer_profile: FarmerProfile = FarmerProfile()
        self._last_ai_response: Optional[dict[str, Any]] = None
        self._current_avatar: Optional[str] = None
        self._current_audio: Optional[str] = None
        self._page_metadata: dict[str, Any] = {}
        self._entered_at: Optional[str] = None

    # ── Page navigation ───────────────────────────────────────────────────────

    def set_page(self, page: str) -> None:
        with self._lock:
            self._previous_page = self._current_page
            self._current_page = page
            self._entered_at = Helper.current_timestamp()
            self._page_metadata = {}
        _log.debug("PageContext: %s → %s", self._previous_page, page)

    @property
    def current_page(self) -> Optional[str]:
        with self._lock:
            return self._current_page

    @property
    def previous_page(self) -> Optional[str]:
        with self._lock:
            return self._previous_page

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language: str) -> None:
        with self._lock:
            self._current_language = language
            self._farmer_profile.language = language

    @property
    def current_language(self) -> str:
        with self._lock:
            return self._current_language

    # ── Farmer profile ────────────────────────────────────────────────────────

    def update_farmer_profile(self, data: dict[str, Any]) -> None:
        with self._lock:
            for key, value in data.items():
                if hasattr(self._farmer_profile, key):
                    setattr(self._farmer_profile, key, value)

    def set_farmer_profile(self, profile: FarmerProfile) -> None:
        with self._lock:
            self._farmer_profile = profile

    def farmer_profile(self) -> FarmerProfile:
        with self._lock:
            return self._farmer_profile

    def farmer_profile_dict(self) -> dict[str, Any]:
        with self._lock:
            return self._farmer_profile.to_dict()

    # ── AI response ───────────────────────────────────────────────────────────

    def set_last_ai_response(self, response: dict[str, Any]) -> None:
        with self._lock:
            self._last_ai_response = response

    def last_ai_response(self) -> Optional[dict[str, Any]]:
        with self._lock:
            return self._last_ai_response

    # ── Avatar / Audio ────────────────────────────────────────────────────────

    def set_avatar(self, avatar_id: str) -> None:
        with self._lock:
            self._current_avatar = avatar_id

    def set_audio(self, audio_id: str) -> None:
        with self._lock:
            self._current_audio = audio_id

    @property
    def current_avatar(self) -> Optional[str]:
        with self._lock:
            return self._current_avatar

    @property
    def current_audio(self) -> Optional[str]:
        with self._lock:
            return self._current_audio

    # ── Page metadata ─────────────────────────────────────────────────────────

    def set_metadata(self, key: str, value: Any) -> None:
        with self._lock:
            self._page_metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._page_metadata.get(key, default)

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "current_page": self._current_page,
                "previous_page": self._previous_page,
                "current_language": self._current_language,
                "farmer_profile": self._farmer_profile.to_dict(),
                "current_avatar": self._current_avatar,
                "current_audio": self._current_audio,
                "entered_at": self._entered_at,
                "metadata": dict(self._page_metadata),
            }
