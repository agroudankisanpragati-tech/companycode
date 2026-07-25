"""
Voice Guide AI — Intelligence State Manager.

Maintains the canonical state machine for the intelligence layer.
States: idle, loading, listening, thinking, processing,
        success, failure, warning, offline, exit.
Thread-safe.
"""

from __future__ import annotations

import threading
from enum import Enum
from typing import Optional

from config.logger import get_logger
from utils.helper import Helper

_log = get_logger("intelligence.state_manager")


class IntelligenceState(Enum):
    IDLE       = "idle"
    LOADING    = "loading"
    LISTENING  = "listening"
    THINKING   = "thinking"
    PROCESSING = "processing"
    SUCCESS    = "success"
    FAILURE    = "failure"
    WARNING    = "warning"
    OFFLINE    = "offline"
    EXIT       = "exit"


# Legal transitions: state → set of reachable states
_TRANSITIONS: dict[IntelligenceState, frozenset[IntelligenceState]] = {
    IntelligenceState.IDLE: frozenset({
        IntelligenceState.LOADING,
        IntelligenceState.LISTENING,
        IntelligenceState.OFFLINE,
        IntelligenceState.EXIT,
    }),
    IntelligenceState.LOADING: frozenset({
        IntelligenceState.THINKING,
        IntelligenceState.PROCESSING,
        IntelligenceState.FAILURE,
        IntelligenceState.OFFLINE,
        IntelligenceState.IDLE,
    }),
    IntelligenceState.LISTENING: frozenset({
        IntelligenceState.THINKING,
        IntelligenceState.IDLE,
        IntelligenceState.FAILURE,
        IntelligenceState.OFFLINE,
    }),
    IntelligenceState.THINKING: frozenset({
        IntelligenceState.PROCESSING,
        IntelligenceState.SUCCESS,
        IntelligenceState.FAILURE,
        IntelligenceState.WARNING,
        IntelligenceState.OFFLINE,
        IntelligenceState.IDLE,
    }),
    IntelligenceState.PROCESSING: frozenset({
        IntelligenceState.SUCCESS,
        IntelligenceState.FAILURE,
        IntelligenceState.WARNING,
        IntelligenceState.OFFLINE,
        IntelligenceState.IDLE,
    }),
    IntelligenceState.SUCCESS: frozenset({
        IntelligenceState.IDLE,
        IntelligenceState.LOADING,
        IntelligenceState.EXIT,
    }),
    IntelligenceState.FAILURE: frozenset({
        IntelligenceState.IDLE,
        IntelligenceState.LOADING,
        IntelligenceState.OFFLINE,
        IntelligenceState.EXIT,
    }),
    IntelligenceState.WARNING: frozenset({
        IntelligenceState.IDLE,
        IntelligenceState.PROCESSING,
        IntelligenceState.FAILURE,
    }),
    IntelligenceState.OFFLINE: frozenset({
        IntelligenceState.IDLE,
        IntelligenceState.EXIT,
    }),
    IntelligenceState.EXIT: frozenset({
        IntelligenceState.IDLE,
    }),
}


class StateManager:
    """
    Thread-safe intelligence state machine.

    Enforces legal transitions; provides force() for error recovery.
    """

    def __init__(self) -> None:
        self._state = IntelligenceState.IDLE
        self._previous: Optional[IntelligenceState] = None
        self._changed_at: str = Helper.current_timestamp()
        self._lock = threading.Lock()

    @property
    def state(self) -> IntelligenceState:
        with self._lock:
            return self._state

    @property
    def previous(self) -> Optional[IntelligenceState]:
        with self._lock:
            return self._previous

    def can_transition(self, target: IntelligenceState) -> bool:
        with self._lock:
            return target in _TRANSITIONS.get(self._state, frozenset())

    def transition(self, target: IntelligenceState) -> IntelligenceState:
        with self._lock:
            allowed = _TRANSITIONS.get(self._state, frozenset())
            if target not in allowed:
                _log.warning(
                    "Illegal transition %s → %s; forcing.",
                    self._state.value, target.value,
                )
            self._previous = self._state
            self._state = target
            self._changed_at = Helper.current_timestamp()
        _log.debug("State: %s → %s", self._previous.value if self._previous else "none", target.value)
        return target

    def force(self, target: IntelligenceState) -> IntelligenceState:
        with self._lock:
            self._previous = self._state
            self._state = target
            self._changed_at = Helper.current_timestamp()
        _log.warning("Forced state → %s", target.value)
        return target

    def reset(self) -> None:
        self.force(IntelligenceState.IDLE)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "state": self._state.value,
                "previous": self._previous.value if self._previous else None,
                "changed_at": self._changed_at,
            }
