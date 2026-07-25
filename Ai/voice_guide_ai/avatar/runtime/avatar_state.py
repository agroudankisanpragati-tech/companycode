"""
Avatar Runtime — Avatar State Machine.

Defines all valid avatar states and enforces legal transitions.
"""

from __future__ import annotations

from enum import Enum
from typing import FrozenSet

from config.exceptions import VoiceGuideError
from config.logger import get_logger

_log = get_logger("avatar.state")


class AvatarError(VoiceGuideError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="AVATAR_ERROR")


class AvatarStateError(AvatarError):
    def __init__(self, current: str, operation: str) -> None:
        super().__init__(f"Cannot '{operation}' from state '{current}'.")
        self.current = current
        self.operation = operation


class AvatarState(Enum):
    """All valid states for the Avatar runtime."""

    UNLOADED   = "unloaded"
    LOADING    = "loading"
    READY      = "ready"
    IDLE       = "idle"
    SPEAKING   = "speaking"
    LISTENING  = "listening"
    THINKING   = "thinking"
    ANIMATING  = "animating"
    HIDDEN     = "hidden"
    ERROR      = "error"

    def __str__(self) -> str:
        return self.value


_TRANSITIONS: dict[AvatarState, FrozenSet[AvatarState]] = {
    AvatarState.UNLOADED:  frozenset({AvatarState.LOADING, AvatarState.ERROR}),
    AvatarState.LOADING:   frozenset({AvatarState.READY, AvatarState.ERROR}),
    AvatarState.READY:     frozenset({AvatarState.IDLE, AvatarState.HIDDEN, AvatarState.ERROR}),
    AvatarState.IDLE:      frozenset({
        AvatarState.SPEAKING, AvatarState.LISTENING, AvatarState.THINKING,
        AvatarState.ANIMATING, AvatarState.HIDDEN, AvatarState.ERROR,
    }),
    AvatarState.SPEAKING:  frozenset({
        AvatarState.IDLE, AvatarState.LISTENING, AvatarState.ANIMATING,
        AvatarState.HIDDEN, AvatarState.ERROR,
    }),
    AvatarState.LISTENING: frozenset({
        AvatarState.IDLE, AvatarState.THINKING, AvatarState.SPEAKING,
        AvatarState.ANIMATING, AvatarState.ERROR,
    }),
    AvatarState.THINKING:  frozenset({
        AvatarState.IDLE, AvatarState.SPEAKING, AvatarState.ANIMATING, AvatarState.ERROR,
    }),
    AvatarState.ANIMATING: frozenset({
        AvatarState.IDLE, AvatarState.SPEAKING, AvatarState.LISTENING,
        AvatarState.THINKING, AvatarState.HIDDEN, AvatarState.ERROR,
    }),
    AvatarState.HIDDEN:    frozenset({AvatarState.IDLE, AvatarState.UNLOADED}),
    AvatarState.ERROR:     frozenset({AvatarState.IDLE, AvatarState.UNLOADED, AvatarState.LOADING}),
}


class AvatarStateMachine:
    """Manages avatar state with enforced legal transitions."""

    def __init__(self, initial: AvatarState = AvatarState.UNLOADED) -> None:
        self._state: AvatarState = initial
        self._previous: AvatarState | None = None

    @property
    def state(self) -> AvatarState:
        return self._state

    @property
    def previous(self) -> AvatarState | None:
        return self._previous

    def can_transition(self, target: AvatarState) -> bool:
        return target in _TRANSITIONS.get(self._state, frozenset())

    def transition(self, target: AvatarState) -> AvatarState:
        if not self.can_transition(target):
            raise AvatarStateError(self._state.value, f"transition to {target.value}")
        _log.debug("Avatar state: %s → %s", self._state.value, target.value)
        self._previous = self._state
        self._state = target
        return self._state

    def force(self, target: AvatarState) -> AvatarState:
        _log.warning("Avatar forced state: %s → %s", self._state.value, target.value)
        self._previous = self._state
        self._state = target
        return self._state

    def reset(self) -> None:
        self._previous = self._state
        self._state = AvatarState.IDLE

    def __repr__(self) -> str:
        return f"AvatarStateMachine(state={self._state.value!r})"
