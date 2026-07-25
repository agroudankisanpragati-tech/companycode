"""
Voice Guide AI — Intelligence Context Manager.

Aggregates and maintains the full runtime context used by every
intelligence subsystem:
  * Current / previous page
  * Current language
  * Farmer profile
  * Last AI response
  * Current avatar / audio
  * Session state
  * Connectivity
Thread-safe.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from config.constants import DEFAULT_LANGUAGE
from config.logger import get_logger
from intelligence.page_context import PageContext, FarmerProfile
from intelligence.session_memory import SessionMemory
from utils.helper import Helper

_log = get_logger("intelligence.context_manager")


class ContextManager:
    """
    Central context store for the intelligence layer.

    Wraps PageContext and SessionMemory and exposes a unified API
    for reading and writing all context dimensions.
    Thread-safe.
    """

    def __init__(
        self,
        page_context: Optional[PageContext] = None,
        session_memory: Optional[SessionMemory] = None,
    ) -> None:
        self._page_ctx = page_context or PageContext()
        self._session_mem = session_memory or SessionMemory()
        self._lock = threading.Lock()
        self._is_online: bool = True
        self._session_id: str = Helper.generate_id()

    # ── Page ──────────────────────────────────────────────────────────────────

    def set_page(self, page: str) -> None:
        self._page_ctx.set_page(page)
        self._session_mem.record_page_visit(page)

    @property
    def current_page(self) -> Optional[str]:
        return self._page_ctx.current_page

    @property
    def previous_page(self) -> Optional[str]:
        return self._page_ctx.previous_page

    # ── Language ──────────────────────────────────────────────────────────────

    def set_language(self, language: str) -> None:
        self._page_ctx.set_language(language)
        self._session_mem.set_language_preference(language)

    @property
    def current_language(self) -> str:
        return self._page_ctx.current_language

    # ── Farmer profile ────────────────────────────────────────────────────────

    def update_farmer_profile(self, data: dict[str, Any]) -> None:
        self._page_ctx.update_farmer_profile(data)

    def set_farmer_profile(self, profile: FarmerProfile) -> None:
        self._page_ctx.set_farmer_profile(profile)

    def farmer_profile(self) -> FarmerProfile:
        return self._page_ctx.farmer_profile()

    def farmer_profile_dict(self) -> dict[str, Any]:
        return self._page_ctx.farmer_profile_dict()

    # ── AI response ───────────────────────────────────────────────────────────

    def set_last_ai_response(self, response: dict[str, Any]) -> None:
        self._page_ctx.set_last_ai_response(response)
        self._session_mem.set_last_ai_response(response)

    def last_ai_response(self) -> Optional[dict[str, Any]]:
        return self._page_ctx.last_ai_response()

    # ── Avatar / Audio ────────────────────────────────────────────────────────

    def set_avatar(self, avatar_id: str) -> None:
        self._page_ctx.set_avatar(avatar_id)

    def set_audio(self, audio_id: str) -> None:
        self._page_ctx.set_audio(audio_id)

    @property
    def current_avatar(self) -> Optional[str]:
        return self._page_ctx.current_avatar

    @property
    def current_audio(self) -> Optional[str]:
        return self._page_ctx.current_audio

    # ── Connectivity ──────────────────────────────────────────────────────────

    def set_online(self, online: bool) -> None:
        with self._lock:
            self._is_online = online

    @property
    def is_online(self) -> bool:
        with self._lock:
            return self._is_online

    # ── Session memory passthrough ────────────────────────────────────────────

    @property
    def session_memory(self) -> SessionMemory:
        return self._session_mem

    @property
    def page_context(self) -> PageContext:
        return self._page_ctx

    # ── Full context dict (used by decision/workflow engines) ─────────────────

    def build_context(self) -> dict[str, Any]:
        """Return a unified context dict consumed by all intelligence engines."""
        profile = self._page_ctx.farmer_profile()
        return {
            "session_id": self._session_id,
            "current_page": self._page_ctx.current_page,
            "previous_page": self._page_ctx.previous_page,
            "language": self._page_ctx.current_language,
            "is_online": self._is_online,
            "logged_in": profile.logged_in,
            "farmer_profile_complete": profile.profile_complete,
            "farmer_id": profile.farmer_id,
            "location": profile.location,
            "crop_type": profile.crop_type,
            "current_avatar": self._page_ctx.current_avatar,
            "current_audio": self._page_ctx.current_audio,
            "visited_pages": self._session_mem.visited_pages(),
            "completed_guides": self._session_mem.completed_guides(),
            "skipped_guides": self._session_mem.skipped_guides(),
            "last_ai_response": self._page_ctx.last_ai_response(),
        }

    def snapshot(self) -> dict[str, Any]:
        return {
            "page": self._page_ctx.snapshot(),
            "session": self._session_mem.snapshot(),
            "is_online": self._is_online,
            "session_id": self._session_id,
        }
