"""
Voice Guide AI — Session Memory.

Per-session in-memory store for the intelligence layer.
Tracks visited pages, replay history, language preference,
completed/skipped guides, and farmer behaviour signals.
Thread-safe.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("intelligence.session_memory")

_MAX_BEHAVIOUR_EVENTS = 200


@dataclass
class BehaviourEvent:
    event_type: str
    page: str
    detail: dict[str, Any]
    timestamp: str = field(default_factory=Helper.current_timestamp)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "page": self.page,
            "detail": self.detail,
            "timestamp": self.timestamp,
        }


class SessionMemory:
    """
    Stores all intelligence-layer memory for one session.
    Thread-safe.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._visited_pages: list[str] = []
        self._replay_history: list[dict[str, Any]] = []
        self._language_preference: Optional[str] = None
        self._completed_guides: set[str] = set()
        self._skipped_guides: set[str] = set()
        self._behaviour_events: list[BehaviourEvent] = []
        self._last_ai_response: Optional[dict[str, Any]] = None
        self._extra: dict[str, Any] = {}

    # ── Visited pages ─────────────────────────────────────────────────────────

    def record_page_visit(self, page: str) -> None:
        with self._lock:
            self._visited_pages.append(page)
        _log.debug("Session memory: page visited = %s", page)

    def visited_pages(self) -> list[str]:
        with self._lock:
            return list(self._visited_pages)

    def has_visited(self, page: str) -> bool:
        with self._lock:
            return page in self._visited_pages

    # ── Replay history ────────────────────────────────────────────────────────

    def record_replay(self, page: str, dialogue_id: str, language: str) -> None:
        with self._lock:
            self._replay_history.append({
                "page": page,
                "dialogue_id": dialogue_id,
                "language": language,
                "timestamp": Helper.current_timestamp(),
            })

    def replay_history(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._replay_history)

    # ── Language preference ───────────────────────────────────────────────────

    def set_language_preference(self, language: str) -> None:
        with self._lock:
            self._language_preference = language

    def language_preference(self) -> Optional[str]:
        with self._lock:
            return self._language_preference

    # ── Guide completion ──────────────────────────────────────────────────────

    def mark_guide_completed(self, guide_id: str) -> None:
        with self._lock:
            self._completed_guides.add(guide_id)
            self._skipped_guides.discard(guide_id)

    def mark_guide_skipped(self, guide_id: str) -> None:
        with self._lock:
            self._skipped_guides.add(guide_id)

    def is_guide_completed(self, guide_id: str) -> bool:
        with self._lock:
            return guide_id in self._completed_guides

    def is_guide_skipped(self, guide_id: str) -> bool:
        with self._lock:
            return guide_id in self._skipped_guides

    def completed_guides(self) -> list[str]:
        with self._lock:
            return list(self._completed_guides)

    def skipped_guides(self) -> list[str]:
        with self._lock:
            return list(self._skipped_guides)

    # ── Behaviour events ──────────────────────────────────────────────────────

    def record_behaviour(self, event_type: str, page: str, detail: dict[str, Any]) -> None:
        with self._lock:
            self._behaviour_events.append(BehaviourEvent(event_type, page, detail))
            if len(self._behaviour_events) > _MAX_BEHAVIOUR_EVENTS:
                self._behaviour_events.pop(0)

    def behaviour_events(self, event_type: Optional[str] = None) -> list[dict[str, Any]]:
        with self._lock:
            events = list(self._behaviour_events)
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [e.to_dict() for e in events]

    # ── Last AI response ──────────────────────────────────────────────────────

    def set_last_ai_response(self, response: dict[str, Any]) -> None:
        with self._lock:
            self._last_ai_response = response

    def last_ai_response(self) -> Optional[dict[str, Any]]:
        with self._lock:
            return self._last_ai_response

    # ── Extra key-value store ─────────────────────────────────────────────────

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._extra[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._extra.get(key, default)

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "visited_pages": list(self._visited_pages),
                "replay_count": len(self._replay_history),
                "language_preference": self._language_preference,
                "completed_guides": list(self._completed_guides),
                "skipped_guides": list(self._skipped_guides),
                "behaviour_event_count": len(self._behaviour_events),
                "has_ai_response": self._last_ai_response is not None,
            }

    def clear(self) -> None:
        with self._lock:
            self._visited_pages.clear()
            self._replay_history.clear()
            self._language_preference = None
            self._completed_guides.clear()
            self._skipped_guides.clear()
            self._behaviour_events.clear()
            self._last_ai_response = None
            self._extra.clear()
        _log.debug("Session memory cleared.")
