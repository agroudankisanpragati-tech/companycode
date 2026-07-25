"""
Voice Guide AI — Runtime Event Dispatcher.

Generates and dispatches structured runtime events to registered
listeners.  All events are logged automatically.

Supported events
----------------
page_opened, page_closed, dialogue_started, dialogue_finished,
replay_pressed, language_changed, avatar_ready, audio_ready,
offline, online
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any, Callable

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("runtime.event_dispatcher")

EventListener = Callable[[dict[str, Any]], None]

# All valid runtime event types
RUNTIME_EVENTS = frozenset({
    "page_opened",
    "page_closed",
    "dialogue_started",
    "dialogue_finished",
    "replay_pressed",
    "language_changed",
    "avatar_ready",
    "audio_ready",
    "offline",
    "online",
    "error",
    "session_started",
    "session_ended",
})


@dataclass
class RuntimeEvent:
    """A single dispatched runtime event."""

    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=Helper.current_timestamp)

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }


class EventDispatcher:
    """
    Thread-safe runtime event dispatcher.

    Listeners can be registered globally (all events) or per event type.
    """

    def __init__(self) -> None:
        self._global_listeners: list[EventListener] = []
        self._typed_listeners: dict[str, list[EventListener]] = {}
        self._lock = threading.Lock()
        self._history: list[RuntimeEvent] = []

    # ── Registration ──────────────────────────────────────────────────────────

    def on(self, event_type: str, listener: EventListener) -> None:
        """Register *listener* for a specific *event_type*."""
        with self._lock:
            self._typed_listeners.setdefault(event_type, []).append(listener)

    def on_any(self, listener: EventListener) -> None:
        """Register *listener* for every event type."""
        with self._lock:
            self._global_listeners.append(listener)

    def off(self, event_type: str, listener: EventListener) -> None:
        """Remove *listener* from *event_type*."""
        with self._lock:
            listeners = self._typed_listeners.get(event_type, [])
            if listener in listeners:
                listeners.remove(listener)

    # ── Dispatch ──────────────────────────────────────────────────────────────

    def dispatch(self, event_type: str, payload: dict[str, Any] | None = None) -> RuntimeEvent:
        """
        Build and dispatch a runtime event.

        Parameters
        ----------
        event_type : one of RUNTIME_EVENTS (unknown types are still dispatched)
        payload    : arbitrary event data

        Returns
        -------
        The RuntimeEvent that was dispatched
        """
        event = RuntimeEvent(event_type=event_type, payload=payload or {})

        with self._lock:
            self._history.append(event)
            typed = list(self._typed_listeners.get(event_type, []))
            global_ = list(self._global_listeners)

        _log.info("Event: %s | %s", event_type, payload)

        for listener in typed + global_:
            try:
                listener(event.to_dict())
            except Exception as exc:  # noqa: BLE001
                _log.warning("Event listener error [%s]: %s", event_type, exc)

        return event

    # ── Convenience dispatchers ───────────────────────────────────────────────

    def page_opened(self, page: str, language: str, is_first_visit: bool) -> RuntimeEvent:
        return self.dispatch("page_opened", {
            "page": page, "language": language, "is_first_visit": is_first_visit,
        })

    def page_closed(self, page: str, time_spent_ms: float) -> RuntimeEvent:
        return self.dispatch("page_closed", {
            "page": page, "time_spent_ms": time_spent_ms,
        })

    def dialogue_started(self, page: str, dialogue_id: str, language: str) -> RuntimeEvent:
        return self.dispatch("dialogue_started", {
            "page": page, "dialogue_id": dialogue_id, "language": language,
        })

    def dialogue_finished(self, page: str, dialogue_id: str, completed: bool) -> RuntimeEvent:
        return self.dispatch("dialogue_finished", {
            "page": page, "dialogue_id": dialogue_id, "completed": completed,
        })

    def replay_pressed(self, page: str, dialogue_id: str, replay_count: int) -> RuntimeEvent:
        return self.dispatch("replay_pressed", {
            "page": page, "dialogue_id": dialogue_id, "replay_count": replay_count,
        })

    def language_changed(self, old_language: str, new_language: str) -> RuntimeEvent:
        return self.dispatch("language_changed", {
            "old_language": old_language, "new_language": new_language,
        })

    def avatar_ready(self, page: str) -> RuntimeEvent:
        return self.dispatch("avatar_ready", {"page": page})

    def audio_ready(self, page: str, dialogue_id: str) -> RuntimeEvent:
        return self.dispatch("audio_ready", {"page": page, "dialogue_id": dialogue_id})

    def offline(self) -> RuntimeEvent:
        return self.dispatch("offline", {})

    def online(self) -> RuntimeEvent:
        return self.dispatch("online", {})

    def error(self, page: str, error_code: str, message: str) -> RuntimeEvent:
        return self.dispatch("error", {
            "page": page, "error_code": error_code, "message": message,
        })

    # ── History ───────────────────────────────────────────────────────────────

    def get_history(self, event_type: str | None = None) -> list[dict[str, Any]]:
        """Return dispatched event history, optionally filtered by type."""
        with self._lock:
            events = list(self._history)
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [e.to_dict() for e in events]

    def clear_history(self) -> None:
        with self._lock:
            self._history.clear()
