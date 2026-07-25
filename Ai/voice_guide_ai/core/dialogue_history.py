"""
Voice Guide AI — Dialogue History.

Records every dialogue that has been played, with full metadata:
  * current_page / previous_page
  * dialogue_id
  * language
  * replay_count
  * visited_time (ISO-8601 UTC)
  * first_visit / last_visit flags
  * configurable max-entry cap
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from config.constants import MAX_HISTORY_ENTRIES
from config.exceptions import HistoryError
from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("dialogue_history")


@dataclass
class HistoryEntry:
    """A single record in the dialogue history."""

    dialogue_id:   str
    current_page:  str
    previous_page: Optional[str]
    language:      str
    replay_count:  int
    visited_time:  str          # ISO-8601 UTC
    first_visit:   bool
    last_visit:    bool         # True while this is the most recent entry

    def to_dict(self) -> dict:
        return {
            "dialogue_id":   self.dialogue_id,
            "current_page":  self.current_page,
            "previous_page": self.previous_page,
            "language":      self.language,
            "replay_count":  self.replay_count,
            "visited_time":  self.visited_time,
            "first_visit":   self.first_visit,
            "last_visit":    self.last_visit,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HistoryEntry":
        return cls(
            dialogue_id=data["dialogue_id"],
            current_page=data["current_page"],
            previous_page=data.get("previous_page"),
            language=data["language"],
            replay_count=data.get("replay_count", 0),
            visited_time=data["visited_time"],
            first_visit=data.get("first_visit", False),
            last_visit=data.get("last_visit", False),
        )


class DialogueHistory:
    """
    Append-only history store for played dialogues.

    Features
    --------
    * Tracks first-visit and last-visit flags automatically
    * Counts replays per (page, dialogue_id) pair
    * Enforces a configurable maximum entry count (FIFO eviction)
    * Provides lookup by page, dialogue_id, and language
    """

    def __init__(self, max_entries: int = MAX_HISTORY_ENTRIES) -> None:
        self._max_entries: int = max(1, max_entries)
        self._entries: deque[HistoryEntry] = deque(maxlen=self._max_entries)
        # Tracks first-visit: (page, dialogue_id) → True once seen
        self._seen: dict[tuple[str, str], bool] = {}
        # Replay counter: (page, dialogue_id) → count
        self._replay_counts: dict[tuple[str, str], int] = {}

    # ── Write ─────────────────────────────────────────────────────────────────

    def record(
        self,
        dialogue_id: str,
        current_page: str,
        language: str,
        previous_page: Optional[str] = None,
    ) -> HistoryEntry:
        """
        Record a dialogue play event.

        Parameters
        ----------
        dialogue_id   : unique ID of the dialogue
        current_page  : page where the dialogue was triggered
        language      : active language code
        previous_page : page visited before current_page (if known)

        Returns
        -------
        The newly created HistoryEntry
        """
        if not dialogue_id:
            raise HistoryError("dialogue_id must not be empty.")
        if not current_page:
            raise HistoryError("current_page must not be empty.")

        key = (current_page, dialogue_id)
        is_first = key not in self._seen
        self._seen[key] = True

        # Increment replay counter (0 on first play, 1+ on replays)
        self._replay_counts[key] = self._replay_counts.get(key, -1) + 1
        replay_count = self._replay_counts[key]

        # Mark previous last entry as no longer last
        if self._entries:
            self._entries[-1].last_visit = False

        entry = HistoryEntry(
            dialogue_id=dialogue_id,
            current_page=current_page,
            previous_page=previous_page,
            language=language,
            replay_count=replay_count,
            visited_time=Helper.current_timestamp(),
            first_visit=is_first,
            last_visit=True,
        )

        self._entries.append(entry)
        _log.debug(
            "History recorded: id=%s page=%s lang=%s replay=%d first=%s",
            dialogue_id, current_page, language, replay_count, is_first,
        )
        return entry

    # ── Read ──────────────────────────────────────────────────────────────────

    def last(self) -> Optional[HistoryEntry]:
        """Return the most recently recorded entry, or None."""
        return self._entries[-1] if self._entries else None

    def all(self) -> list[HistoryEntry]:
        """Return all entries in chronological order (oldest first)."""
        return list(self._entries)

    def by_page(self, page: str) -> list[HistoryEntry]:
        """Return all entries for *page* in chronological order."""
        return [e for e in self._entries if e.current_page == page]

    def by_dialogue_id(self, dialogue_id: str) -> list[HistoryEntry]:
        """Return all entries for *dialogue_id*."""
        return [e for e in self._entries if e.dialogue_id == dialogue_id]

    def by_language(self, language: str) -> list[HistoryEntry]:
        """Return all entries played in *language*."""
        return [e for e in self._entries if e.language == language]

    def is_first_visit(self, page: str, dialogue_id: str) -> bool:
        """Return True if this (page, dialogue_id) pair has never been recorded."""
        return (page, dialogue_id) not in self._seen

    def replay_count(self, page: str, dialogue_id: str) -> int:
        """Return how many times (page, dialogue_id) has been replayed (0 = first play)."""
        return self._replay_counts.get((page, dialogue_id), -1)

    def count(self) -> int:
        """Return the total number of history entries."""
        return len(self._entries)

    def is_empty(self) -> bool:
        return len(self._entries) == 0

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_list(self) -> list[dict]:
        """Serialise history to a list of dicts (for persistence)."""
        return [e.to_dict() for e in self._entries]

    def load_from_list(self, data: list[dict]) -> None:
        """
        Restore history from a previously serialised list.

        Existing entries are replaced.
        """
        self._entries.clear()
        self._seen.clear()
        self._replay_counts.clear()

        for item in data:
            try:
                entry = HistoryEntry.from_dict(item)
                self._entries.append(entry)
                key = (entry.current_page, entry.dialogue_id)
                self._seen[key] = True
                self._replay_counts[key] = entry.replay_count
            except (KeyError, TypeError) as exc:
                _log.warning("Skipping invalid history entry: %s — %s", item, exc)

    # ── Mutation ──────────────────────────────────────────────────────────────

    def clear(self) -> None:
        """Remove all history entries and reset counters."""
        self._entries.clear()
        self._seen.clear()
        self._replay_counts.clear()
        _log.debug("Dialogue history cleared.")

    def trim(self, keep_last: int) -> None:
        """Keep only the *keep_last* most recent entries."""
        if keep_last <= 0:
            raise HistoryError("keep_last must be a positive integer.")
        while len(self._entries) > keep_last:
            self._entries.popleft()

    def __len__(self) -> int:
        return len(self._entries)

    def __repr__(self) -> str:
        return f"DialogueHistory(entries={len(self._entries)}, max={self._max_entries})"
