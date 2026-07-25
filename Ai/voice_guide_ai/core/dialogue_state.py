"""
Voice Guide AI — Dialogue State Machine.

Defines all valid dialogue states and the legal transitions between
them.  ``DialogueStateMachine`` enforces that only valid transitions
are applied, raising ``DialogueStateError`` on illegal moves.
"""

from __future__ import annotations

from enum import Enum
from typing import FrozenSet

from config.exceptions import DialogueStateError
from config.logger import get_logger

_log = get_logger("dialogue_state")


class DialogueState(Enum):
    """All valid states for the Dialogue Engine."""

    IDLE      = "idle"
    LOADING   = "loading"
    READY     = "ready"
    PLAYING   = "playing"
    LISTENING = "listening"
    THINKING  = "thinking"
    WAITING   = "waiting"
    SUCCESS   = "success"
    WARNING   = "warning"
    ERROR     = "error"
    OFFLINE   = "offline"
    EXIT      = "exit"
    STOPPED   = "stopped"

    def __str__(self) -> str:
        return self.value


# ── Legal state transitions ────────────────────────────────────────────────────
# Maps each state to the set of states it may transition INTO.

_TRANSITIONS: dict[DialogueState, FrozenSet[DialogueState]] = {
    DialogueState.IDLE: frozenset({
        DialogueState.LOADING,
        DialogueState.OFFLINE,
        DialogueState.EXIT,
    }),
    DialogueState.LOADING: frozenset({
        DialogueState.READY,
        DialogueState.ERROR,
        DialogueState.OFFLINE,
    }),
    DialogueState.READY: frozenset({
        DialogueState.PLAYING,
        DialogueState.IDLE,
        DialogueState.ERROR,
        DialogueState.OFFLINE,
    }),
    DialogueState.PLAYING: frozenset({
        DialogueState.LISTENING,
        DialogueState.WAITING,
        DialogueState.SUCCESS,
        DialogueState.WARNING,
        DialogueState.ERROR,
        DialogueState.STOPPED,
        DialogueState.IDLE,
        DialogueState.OFFLINE,
        DialogueState.EXIT,
    }),
    DialogueState.LISTENING: frozenset({
        DialogueState.THINKING,
        DialogueState.PLAYING,
        DialogueState.IDLE,
        DialogueState.ERROR,
        DialogueState.STOPPED,
        DialogueState.OFFLINE,
    }),
    DialogueState.THINKING: frozenset({
        DialogueState.PLAYING,
        DialogueState.WAITING,
        DialogueState.SUCCESS,
        DialogueState.WARNING,
        DialogueState.ERROR,
        DialogueState.IDLE,
        DialogueState.OFFLINE,
    }),
    DialogueState.WAITING: frozenset({
        DialogueState.PLAYING,
        DialogueState.LISTENING,
        DialogueState.SUCCESS,
        DialogueState.WARNING,
        DialogueState.ERROR,
        DialogueState.IDLE,
        DialogueState.OFFLINE,
        DialogueState.STOPPED,
    }),
    DialogueState.SUCCESS: frozenset({
        DialogueState.IDLE,
        DialogueState.PLAYING,
        DialogueState.EXIT,
        DialogueState.OFFLINE,
    }),
    DialogueState.WARNING: frozenset({
        DialogueState.IDLE,
        DialogueState.PLAYING,
        DialogueState.ERROR,
        DialogueState.OFFLINE,
    }),
    DialogueState.ERROR: frozenset({
        DialogueState.IDLE,
        DialogueState.LOADING,
        DialogueState.OFFLINE,
        DialogueState.EXIT,
    }),
    DialogueState.OFFLINE: frozenset({
        DialogueState.IDLE,
        DialogueState.LOADING,
        DialogueState.EXIT,
    }),
    DialogueState.EXIT: frozenset({
        DialogueState.IDLE,
    }),
    DialogueState.STOPPED: frozenset({
        DialogueState.IDLE,
        DialogueState.LOADING,
        DialogueState.EXIT,
    }),
}


class DialogueStateMachine:
    """
    Manages the current dialogue state and enforces legal transitions.

    Usage::

        sm = DialogueStateMachine()
        sm.transition(DialogueState.LOADING)
        sm.transition(DialogueState.READY)
        sm.transition(DialogueState.PLAYING)
    """

    def __init__(self, initial: DialogueState = DialogueState.IDLE) -> None:
        self._state: DialogueState = initial
        self._previous: DialogueState | None = None

    @property
    def state(self) -> DialogueState:
        """Current state."""
        return self._state

    @property
    def previous(self) -> DialogueState | None:
        """State before the last transition."""
        return self._previous

    def can_transition(self, target: DialogueState) -> bool:
        """Return True if transitioning to *target* is legal from the current state."""
        return target in _TRANSITIONS.get(self._state, frozenset())

    def transition(self, target: DialogueState) -> DialogueState:
        """
        Transition to *target* state.

        Returns the new state.

        Raises
        ------
        DialogueStateError — transition is not permitted
        """
        if not self.can_transition(target):
            raise DialogueStateError(
                current_state=self._state.value,
                operation=f"transition to {target.value}",
            )
        _log.debug("State: %s → %s", self._state.value, target.value)
        self._previous = self._state
        self._state = target
        return self._state

    def force(self, target: DialogueState) -> DialogueState:
        """
        Force a state change without checking transition rules.

        Use only for error recovery or test scenarios.
        """
        _log.warning(
            "Forced state change: %s → %s", self._state.value, target.value
        )
        self._previous = self._state
        self._state = target
        return self._state

    def reset(self) -> None:
        """Reset to IDLE state."""
        self._previous = self._state
        self._state = DialogueState.IDLE
        _log.debug("State machine reset to IDLE.")

    def is_terminal(self) -> bool:
        """Return True if the current state has no outgoing transitions."""
        return len(_TRANSITIONS.get(self._state, frozenset())) == 0

    def __repr__(self) -> str:
        return (
            f"DialogueStateMachine(state={self._state.value!r}, "
            f"previous={self._previous.value if self._previous else None!r})"
        )
