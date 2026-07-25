"""
Voice Guide AI — Runtime Queue Manager.

Priority-based dialogue request queue.

Features
--------
* Priority queue (lower number = higher priority)
* Enqueue, cancel, replace, drain
* Thread-safe
* Max queue size guard
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.queue_manager")

MAX_QUEUE_SIZE = 20

# Priority levels
PRIORITY_CRITICAL = 0
PRIORITY_HIGH = 1
PRIORITY_NORMAL = 2
PRIORITY_LOW = 3


@dataclass(order=True)
class DialogueRequest:
    """A queued dialogue playback request."""

    priority: int
    request_id: str = field(compare=False, default_factory=Helper.generate_short_id)
    page: str = field(compare=False, default="")
    dialogue_type: str = field(compare=False, default="welcome")
    language: Optional[str] = field(compare=False, default=None)
    context: dict[str, Any] = field(compare=False, default_factory=dict)
    enqueued_at: str = field(compare=False, default_factory=Helper.current_timestamp)
    cancelled: bool = field(compare=False, default=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "priority": self.priority,
            "page": self.page,
            "dialogue_type": self.dialogue_type,
            "language": self.language,
            "enqueued_at": self.enqueued_at,
            "cancelled": self.cancelled,
        }


class QueueManager:
    """
    Thread-safe priority dialogue queue.

    Requests are sorted by priority (ascending).  Cancelled requests
    are skipped on dequeue.
    """

    def __init__(self, max_size: int = MAX_QUEUE_SIZE) -> None:
        self._queue: list[DialogueRequest] = []
        self._max_size = max_size
        self._lock = threading.Lock()

    # ── Enqueue ───────────────────────────────────────────────────────────────

    def enqueue(
        self,
        page: str,
        dialogue_type: str = "welcome",
        language: Optional[str] = None,
        priority: int = PRIORITY_NORMAL,
        context: dict[str, Any] | None = None,
    ) -> Optional[DialogueRequest]:
        """
        Add a dialogue request to the queue.

        Returns None if the queue is full.
        """
        with self._lock:
            active = [r for r in self._queue if not r.cancelled]
            if len(active) >= self._max_size:
                _log.warning("Queue full (%d). Request dropped: page=%s", self._max_size, page)
                return None

            request = DialogueRequest(
                priority=priority,
                page=page,
                dialogue_type=dialogue_type,
                language=language,
                context=context or {},
            )
            self._queue.append(request)
            self._queue.sort()
            _log.debug(
                "Enqueued: id=%s page=%s type=%s priority=%d",
                request.request_id, page, dialogue_type, priority,
            )
            return request

    def enqueue_urgent(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
        context: dict[str, Any] | None = None,
    ) -> Optional[DialogueRequest]:
        """Enqueue with CRITICAL priority, cancelling all existing requests."""
        self.cancel_all()
        return self.enqueue(page, dialogue_type, language, PRIORITY_CRITICAL, context)

    # ── Dequeue ───────────────────────────────────────────────────────────────

    def dequeue(self) -> Optional[DialogueRequest]:
        """
        Return the next non-cancelled request, or None if queue is empty.

        Cancelled requests are discarded during dequeue.
        """
        with self._lock:
            while self._queue:
                request = self._queue.pop(0)
                if not request.cancelled:
                    _log.debug("Dequeued: id=%s page=%s", request.request_id, request.page)
                    return request
        return None

    def peek(self) -> Optional[DialogueRequest]:
        """Return the next non-cancelled request without removing it."""
        with self._lock:
            for request in self._queue:
                if not request.cancelled:
                    return request
        return None

    # ── Cancel ────────────────────────────────────────────────────────────────

    def cancel(self, request_id: str) -> bool:
        """Cancel a specific request by ID. Returns True if found."""
        with self._lock:
            for request in self._queue:
                if request.request_id == request_id:
                    request.cancelled = True
                    _log.debug("Cancelled request: id=%s", request_id)
                    return True
        return False

    def cancel_page(self, page: str) -> int:
        """Cancel all requests for *page*. Returns count cancelled."""
        count = 0
        with self._lock:
            for request in self._queue:
                if request.page == page and not request.cancelled:
                    request.cancelled = True
                    count += 1
        _log.debug("Cancelled %d requests for page=%s", count, page)
        return count

    def cancel_all(self) -> int:
        """Cancel all pending requests. Returns count cancelled."""
        count = 0
        with self._lock:
            for request in self._queue:
                if not request.cancelled:
                    request.cancelled = True
                    count += 1
        _log.debug("Cancelled all %d requests.", count)
        return count

    # ── Replace ───────────────────────────────────────────────────────────────

    def replace(
        self,
        page: str,
        dialogue_type: str,
        language: Optional[str] = None,
        priority: int = PRIORITY_NORMAL,
        context: dict[str, Any] | None = None,
    ) -> Optional[DialogueRequest]:
        """Cancel all requests for *page* and enqueue a new one."""
        self.cancel_page(page)
        return self.enqueue(page, dialogue_type, language, priority, context)

    # ── Inspection ────────────────────────────────────────────────────────────

    def size(self) -> int:
        """Return count of non-cancelled requests."""
        with self._lock:
            return sum(1 for r in self._queue if not r.cancelled)

    def is_empty(self) -> bool:
        return self.size() == 0

    def list_pending(self) -> list[dict[str, Any]]:
        with self._lock:
            return [r.to_dict() for r in self._queue if not r.cancelled]

    def clear(self) -> None:
        with self._lock:
            self._queue.clear()
        _log.debug("Queue cleared.")
