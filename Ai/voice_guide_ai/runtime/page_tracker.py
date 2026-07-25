"""
Voice Guide AI — Page Tracker.

Tracks navigation history:
  * Previous page
  * Current page
  * Next page (set by the caller when navigation intent is known)
  * Navigation timestamp
  * Time spent on each page
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.page_tracker")

SUPPORTED_PAGES = frozenset({
    "language_popup",
    "home",
    "login",
    "register",
    "profile",
    "weather",
    "mandi",
    "soil_health",
    "crop_recommendation",
    "disease_detection",
    "government_scheme",
    "marketplace",
    "ai_chat",
    "app_settings",
    "common",
})


@dataclass
class PageEntry:
    """A single navigation record."""

    page: str
    entered_at: str
    exited_at: Optional[str] = None
    time_spent_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "page": self.page,
            "entered_at": self.entered_at,
            "exited_at": self.exited_at,
            "time_spent_ms": self.time_spent_ms,
        }


class PageTracker:
    """
    Tracks page navigation with timing.
    Thread-safe.
    """

    def __init__(self) -> None:
        self._current_page: Optional[str] = None
        self._previous_page: Optional[str] = None
        self._next_page: Optional[str] = None
        self._page_enter_time: float = 0.0
        self._history: list[PageEntry] = []
        self._lock = threading.Lock()

    # ── Navigation ────────────────────────────────────────────────────────────

    def navigate_to(self, page: str) -> PageEntry:
        """
        Record navigation to *page*.

        Closes the previous page entry with time_spent_ms and opens a
        new entry for *page*.

        Returns
        -------
        The new PageEntry for *page*
        """
        now_ts = Helper.current_timestamp()
        now_mono = time.monotonic()

        with self._lock:
            # Close previous page
            if self._current_page and self._history:
                last = self._history[-1]
                if last.exited_at is None:
                    last.exited_at = now_ts
                    last.time_spent_ms = (now_mono - self._page_enter_time) * 1000

            self._previous_page = self._current_page
            self._current_page = page
            self._page_enter_time = now_mono

            entry = PageEntry(page=page, entered_at=now_ts)
            self._history.append(entry)

        _log.info(
            "Navigation: %s → %s",
            self._previous_page or "none", page,
        )
        return entry

    def set_next_page(self, page: str) -> None:
        """Declare the intended next page (for pre-loading)."""
        with self._lock:
            self._next_page = page

    def close_current_page(self) -> Optional[PageEntry]:
        """
        Mark the current page as exited and compute time_spent_ms.

        Returns the closed PageEntry or None if no page is open.
        """
        now_ts = Helper.current_timestamp()
        now_mono = time.monotonic()

        with self._lock:
            if not self._history:
                return None
            last = self._history[-1]
            if last.exited_at is None:
                last.exited_at = now_ts
                last.time_spent_ms = (now_mono - self._page_enter_time) * 1000
            return last

    # ── Queries ───────────────────────────────────────────────────────────────

    @property
    def current_page(self) -> Optional[str]:
        with self._lock:
            return self._current_page

    @property
    def previous_page(self) -> Optional[str]:
        with self._lock:
            return self._previous_page

    @property
    def next_page(self) -> Optional[str]:
        with self._lock:
            return self._next_page

    def time_on_current_page_ms(self) -> float:
        """Return milliseconds elapsed since the current page was opened."""
        with self._lock:
            if self._current_page is None:
                return 0.0
            return (time.monotonic() - self._page_enter_time) * 1000

    def navigation_history(self) -> list[dict[str, Any]]:
        with self._lock:
            return [e.to_dict() for e in self._history]

    def is_supported_page(self, page: str) -> bool:
        return page in SUPPORTED_PAGES

    def reset(self) -> None:
        with self._lock:
            self._current_page = None
            self._previous_page = None
            self._next_page = None
            self._page_enter_time = 0.0
            self._history.clear()
        _log.debug("PageTracker reset.")
