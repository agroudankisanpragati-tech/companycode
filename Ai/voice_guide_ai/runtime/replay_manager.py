"""
Voice Guide AI — Replay Manager.

Records every played dialogue and provides retrieval for:
  * Replay last dialogue
  * Replay specific dialogue by ID
  * Replay page guidance (last dialogue for a given page)
  * Replay count per dialogue

Thread-safe.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.replay_manager")

MAX_REPLAY_HISTORY = 200


@dataclass
class ReplayRecord:
    """A single replay-eligible dialogue record."""

    dialogue_id: str
    page: str
    dialogue_type: str
    language: str
    played_at: str = field(default_factory=Helper.current_timestamp)
    replay_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "dialogue_id": self.dialogue_id,
            "page": self.page,
            "dialogue_type": self.dialogue_type,
            "language": self.language,
            "played_at": self.played_at,
            "replay_count": self.replay_count,
        }


class ReplayManager:
    """
    Maintains a bounded history of played dialogues for replay.

    Supports:
      * record(page, dialogue_type, language)
      * last()                  → most recent ReplayRecord
      * get(dialogue_id)        → specific ReplayRecord
      * last_for_page(page)     → most recent record for a page
      * increment_replay(id)    → increment replay counter
    """

    def __init__(self, max_history: int = MAX_REPLAY_HISTORY) -> None:
        self._records: list[ReplayRecord] = []
        self._index: dict[str, ReplayRecord] = {}
        self._max_history = max_history
        self._lock = threading.Lock()

    # ── Write ─────────────────────────────────────────────────────────────────

    def record(
        self,
        page: str,
        dialogue_type: str,
        language: str,
        dialogue_id: Optional[str] = None,
    ) -> ReplayRecord:
        """
        Record a played dialogue.

        Parameters
        ----------
        page          : page identifier
        dialogue_type : dialogue type (welcome, help, error, etc.)
        language      : active language code
        dialogue_id   : explicit ID; auto-generated if None

        Returns
        -------
        The created ReplayRecord
        """
        did = dialogue_id or Helper.generate_deterministic_id(f"{page}_{dialogue_type}_{language}")
        rec = ReplayRecord(
            dialogue_id=did,
            page=page,
            dialogue_type=dialogue_type,
            language=language,
        )

        with self._lock:
            self._records.append(rec)
            self._index[did] = rec
            if len(self._records) > self._max_history:
                evicted = self._records.pop(0)
                self._index.pop(evicted.dialogue_id, None)

        _log.debug(
            "Replay recorded: id=%s page=%s type=%s lang=%s",
            did, page, dialogue_type, language,
        )
        return rec

    def increment_replay(self, dialogue_id: str) -> int:
        """Increment replay counter for *dialogue_id*. Returns new count."""
        with self._lock:
            rec = self._index.get(dialogue_id)
            if rec:
                rec.replay_count += 1
                return rec.replay_count
        return 0

    # ── Read ──────────────────────────────────────────────────────────────────

    def last(self) -> Optional[ReplayRecord]:
        """Return the most recently played dialogue record."""
        with self._lock:
            return self._records[-1] if self._records else None

    def get(self, dialogue_id: str) -> Optional[ReplayRecord]:
        """Return the record for *dialogue_id*, or None."""
        with self._lock:
            return self._index.get(dialogue_id)

    def last_for_page(self, page: str) -> Optional[ReplayRecord]:
        """Return the most recent record for *page*, or None."""
        with self._lock:
            for rec in reversed(self._records):
                if rec.page == page:
                    return rec
        return None

    def all_for_page(self, page: str) -> list[ReplayRecord]:
        """Return all records for *page* in chronological order."""
        with self._lock:
            return [r for r in self._records if r.page == page]

    def history(self) -> list[dict[str, Any]]:
        """Return full replay history as list of dicts."""
        with self._lock:
            return [r.to_dict() for r in self._records]

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._index.clear()
        _log.debug("Replay history cleared.")
