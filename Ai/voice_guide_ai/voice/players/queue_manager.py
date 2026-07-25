"""
Voice Guide AI — Playback Queue Manager.

Thread-safe ordered queue for audio playback items.
Supports priority insertion, peek, drain, and history tracking.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config.logger import get_logger

_log = get_logger("voice.players.queue_manager")

_MAX_HISTORY = 50


@dataclass
class QueueItem:
    language: str
    module: str
    dialogue_id: str
    path: Path
    priority: int = 0  # lower = higher priority

    def __lt__(self, other: "QueueItem") -> bool:
        return self.priority < other.priority


class QueueManager:
    """
    Thread-safe audio playback queue.

    Items are dequeued in FIFO order within the same priority level.
    Priority 0 = normal, negative = high priority (plays sooner).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: list[QueueItem] = []
        self._history: list[QueueItem] = []

    # ── Enqueue ───────────────────────────────────────────────────────────────

    def push(self, item: QueueItem) -> None:
        with self._lock:
            self._items.append(item)
            self._items.sort(key=lambda x: x.priority)
            _log.debug("Enqueued %s/%s/%s (priority=%d, size=%d)",
                       item.language, item.module, item.dialogue_id,
                       item.priority, len(self._items))

    def push_front(self, item: QueueItem) -> None:
        """Insert *item* at the front regardless of priority."""
        with self._lock:
            self._items.insert(0, item)

    # ── Dequeue ───────────────────────────────────────────────────────────────

    def pop(self) -> Optional[QueueItem]:
        with self._lock:
            if not self._items:
                return None
            item = self._items.pop(0)
            self._history.append(item)
            if len(self._history) > _MAX_HISTORY:
                self._history = self._history[-_MAX_HISTORY:]
            return item

    def peek(self) -> Optional[QueueItem]:
        with self._lock:
            return self._items[0] if self._items else None

    # ── State ─────────────────────────────────────────────────────────────────

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._items)

    @property
    def is_empty(self) -> bool:
        return self.size == 0

    @property
    def history(self) -> list[QueueItem]:
        with self._lock:
            return list(self._history)

    def all_items(self) -> list[QueueItem]:
        with self._lock:
            return list(self._items)
