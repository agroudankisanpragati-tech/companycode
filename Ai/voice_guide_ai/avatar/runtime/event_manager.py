"""
Avatar Runtime — Event Manager.

Typed event bus for all avatar lifecycle events.
Subscribers register per-event-type callbacks and receive
structured AvatarEvent objects.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from config.logger import get_logger

_log = get_logger("avatar.event_manager")

EventCallback = Callable[["AvatarEvent"], None]


class AvatarEventType(Enum):
    """All avatar event types."""

    AVATAR_LOADED         = "avatar_loaded"
    AVATAR_HIDDEN         = "avatar_hidden"
    ANIMATION_STARTED     = "animation_started"
    ANIMATION_FINISHED    = "animation_finished"
    EXPRESSION_CHANGED    = "expression_changed"
    LIP_SYNC_STARTED      = "lip_sync_started"
    LIP_SYNC_FINISHED     = "lip_sync_finished"
    THEME_CHANGED         = "theme_changed"
    POSITION_CHANGED      = "position_changed"
    ERROR                 = "error"

    def __str__(self) -> str:
        return self.value


@dataclass
class AvatarEvent:
    """A single avatar event with typed payload."""

    event_type:  AvatarEventType
    timestamp:   float = field(default_factory=time.monotonic)
    payload:     dict[str, Any] = field(default_factory=dict)
    source:      str = "avatar_runtime"

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "timestamp":  self.timestamp,
            "payload":    self.payload,
            "source":     self.source,
        }


class EventManager:
    """
    Avatar event bus.

    Responsibilities
    ----------------
    * Register per-type and wildcard subscribers
    * Emit typed AvatarEvent objects
    * Maintain a bounded event history
    * Log every emitted event
    """

    _MAX_HISTORY = 200

    def __init__(self) -> None:
        self._subscribers: dict[AvatarEventType, list[EventCallback]] = defaultdict(list)
        self._wildcard_subscribers: list[EventCallback] = []
        self._history: list[AvatarEvent] = []

    # ── Subscription ──────────────────────────────────────────────────────────

    def subscribe(self, event_type: AvatarEventType, callback: EventCallback) -> None:
        """Subscribe *callback* to a specific event type."""
        self._subscribers[event_type].append(callback)

    def subscribe_all(self, callback: EventCallback) -> None:
        """Subscribe *callback* to every event type."""
        self._wildcard_subscribers.append(callback)

    def unsubscribe(self, event_type: AvatarEventType, callback: EventCallback) -> bool:
        """Remove *callback* from *event_type*. Returns True if removed."""
        subs = self._subscribers.get(event_type, [])
        if callback in subs:
            subs.remove(callback)
            return True
        return False

    # ── Emission ──────────────────────────────────────────────────────────────

    def emit(
        self,
        event_type: AvatarEventType,
        payload: dict[str, Any] | None = None,
        source: str = "avatar_runtime",
    ) -> AvatarEvent:
        """
        Emit an event to all registered subscribers.

        Returns the emitted AvatarEvent.
        """
        event = AvatarEvent(
            event_type=event_type,
            payload=payload or {},
            source=source,
        )

        _log.info("Event: %s | %s", event_type.value, payload or {})

        # Append to history with cap
        self._history.append(event)
        if len(self._history) > self._MAX_HISTORY:
            self._history.pop(0)

        # Notify type-specific subscribers
        for cb in list(self._subscribers.get(event_type, [])):
            try:
                cb(event)
            except Exception as exc:
                _log.warning("Event subscriber error (%s): %s", event_type.value, exc)

        # Notify wildcard subscribers
        for cb in list(self._wildcard_subscribers):
            try:
                cb(event)
            except Exception as exc:
                _log.warning("Wildcard subscriber error: %s", exc)

        return event

    # ── Convenience emitters ──────────────────────────────────────────────────

    def emit_loaded(self, avatar_id: str) -> AvatarEvent:
        return self.emit(AvatarEventType.AVATAR_LOADED, {"avatar_id": avatar_id})

    def emit_hidden(self) -> AvatarEvent:
        return self.emit(AvatarEventType.AVATAR_HIDDEN, {})

    def emit_animation_started(self, animation_id: str) -> AvatarEvent:
        return self.emit(AvatarEventType.ANIMATION_STARTED, {"animation_id": animation_id})

    def emit_animation_finished(self, animation_id: str) -> AvatarEvent:
        return self.emit(AvatarEventType.ANIMATION_FINISHED, {"animation_id": animation_id})

    def emit_expression_changed(self, from_expr: str, to_expr: str) -> AvatarEvent:
        return self.emit(
            AvatarEventType.EXPRESSION_CHANGED,
            {"from": from_expr, "to": to_expr},
        )

    def emit_lip_sync_started(self) -> AvatarEvent:
        return self.emit(AvatarEventType.LIP_SYNC_STARTED, {})

    def emit_lip_sync_finished(self) -> AvatarEvent:
        return self.emit(AvatarEventType.LIP_SYNC_FINISHED, {})

    def emit_theme_changed(self, from_theme: str, to_theme: str) -> AvatarEvent:
        return self.emit(
            AvatarEventType.THEME_CHANGED,
            {"from": from_theme, "to": to_theme},
        )

    def emit_position_changed(self, from_pos: str, to_pos: str) -> AvatarEvent:
        return self.emit(
            AvatarEventType.POSITION_CHANGED,
            {"from": from_pos, "to": to_pos},
        )

    def emit_error(self, reason: str, context: str = "") -> AvatarEvent:
        return self.emit(
            AvatarEventType.ERROR,
            {"reason": reason, "context": context},
        )

    # ── History ───────────────────────────────────────────────────────────────

    def history(self, event_type: AvatarEventType | None = None) -> list[AvatarEvent]:
        """Return event history, optionally filtered by type."""
        if event_type is None:
            return list(self._history)
        return [e for e in self._history if e.event_type == event_type]

    def last(self, event_type: AvatarEventType | None = None) -> AvatarEvent | None:
        """Return the most recent event, optionally filtered by type."""
        filtered = self.history(event_type)
        return filtered[-1] if filtered else None

    def clear_history(self) -> None:
        self._history.clear()
