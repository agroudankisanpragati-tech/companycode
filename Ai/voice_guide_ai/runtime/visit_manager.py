"""
Voice Guide AI — Visit Manager.

Tracks visit history per page across four dimensions:
  * First Visit   — has the user ever visited this page?
  * Session Visit — visited in the current runtime session?
  * Daily Visit   — visited today (local date)?
  * Permanent     — persistent across sessions (in-memory for this runtime)

All state is in-memory.  Persistence across app restarts is handled
by the caller serialising/restoring via ``to_dict`` / ``load_dict``.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.visit_manager")


@dataclass
class PageVisitRecord:
    """Visit record for a single page."""

    page: str
    first_visit_time: str = ""
    last_visit_time: str = ""
    total_visits: int = 0
    session_visits: int = 0
    daily_visits: int = 0
    last_visit_date: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "page": self.page,
            "first_visit_time": self.first_visit_time,
            "last_visit_time": self.last_visit_time,
            "total_visits": self.total_visits,
            "session_visits": self.session_visits,
            "daily_visits": self.daily_visits,
            "last_visit_date": self.last_visit_date,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PageVisitRecord":
        return cls(
            page=data["page"],
            first_visit_time=data.get("first_visit_time", ""),
            last_visit_time=data.get("last_visit_time", ""),
            total_visits=data.get("total_visits", 0),
            session_visits=data.get("session_visits", 0),
            daily_visits=data.get("daily_visits", 0),
            last_visit_date=data.get("last_visit_date", ""),
        )


class VisitManager:
    """
    Tracks page visit history across first/session/daily/permanent dimensions.
    Thread-safe.
    """

    def __init__(self) -> None:
        self._records: dict[str, PageVisitRecord] = {}
        self._lock = threading.Lock()

    # ── Record a visit ────────────────────────────────────────────────────────

    def record_visit(self, page: str) -> PageVisitRecord:
        """
        Record a visit to *page* and return the updated record.

        Updates all four visit counters atomically.
        """
        now = Helper.current_timestamp()
        today = Helper.current_date()

        with self._lock:
            record = self._records.get(page)

            if record is None:
                record = PageVisitRecord(
                    page=page,
                    first_visit_time=now,
                    last_visit_time=now,
                    total_visits=1,
                    session_visits=1,
                    daily_visits=1,
                    last_visit_date=today,
                )
                self._records[page] = record
                _log.info("First visit recorded: page=%s", page)
            else:
                record.last_visit_time = now
                record.total_visits += 1
                record.session_visits += 1

                if record.last_visit_date != today:
                    record.daily_visits = 1
                    record.last_visit_date = today
                else:
                    record.daily_visits += 1

                _log.debug(
                    "Visit recorded: page=%s total=%d session=%d daily=%d",
                    page, record.total_visits, record.session_visits, record.daily_visits,
                )

        return record

    # ── Queries ───────────────────────────────────────────────────────────────

    def is_first_visit(self, page: str) -> bool:
        """Return True if *page* has never been visited."""
        with self._lock:
            return page not in self._records

    def is_session_visit(self, page: str) -> bool:
        """Return True if *page* has been visited in the current session."""
        with self._lock:
            record = self._records.get(page)
            return record is not None and record.session_visits > 0

    def is_daily_visit(self, page: str) -> bool:
        """Return True if *page* has been visited today."""
        with self._lock:
            record = self._records.get(page)
            if record is None:
                return False
            return record.last_visit_date == Helper.current_date() and record.daily_visits > 0

    def get_record(self, page: str) -> PageVisitRecord | None:
        with self._lock:
            return self._records.get(page)

    def total_visits(self, page: str) -> int:
        with self._lock:
            record = self._records.get(page)
            return record.total_visits if record else 0

    def all_visited_pages(self) -> list[str]:
        with self._lock:
            return list(self._records.keys())

    # ── Session reset ─────────────────────────────────────────────────────────

    def reset_session_counts(self) -> None:
        """Reset session_visits to 0 for all pages (call on new session start)."""
        with self._lock:
            for record in self._records.values():
                record.session_visits = 0
        _log.debug("Session visit counts reset.")

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        with self._lock:
            return {page: record.to_dict() for page, record in self._records.items()}

    def load_dict(self, data: dict[str, Any]) -> None:
        """Restore visit records from a previously serialised dict."""
        with self._lock:
            self._records.clear()
            for page, record_data in data.items():
                try:
                    self._records[page] = PageVisitRecord.from_dict(record_data)
                except (KeyError, TypeError) as exc:
                    _log.warning("Skipping invalid visit record for page=%s: %s", page, exc)
        _log.debug("Visit records loaded: %d pages", len(self._records))
