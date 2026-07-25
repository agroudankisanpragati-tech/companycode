"""
Voice Guide AI — Volume Controller.

Manages volume level, mute state, and fade in/out transitions.
Decoupled from the audio backend — applies values via a setter callback.
"""

from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from config.logger import get_logger

_log = get_logger("voice.players.volume_controller")

_DEFAULT_VOLUME = 1.0
_MIN_VOLUME = 0.0
_MAX_VOLUME = 1.0
_FADE_STEPS = 20
_FADE_INTERVAL_S = 0.05


class VolumeController:
    """
    Manages volume with mute and fade support.

    Parameters
    ----------
    setter : callable that applies a float volume [0.0, 1.0] to the backend
    """

    def __init__(self, setter: Callable[[float], None]) -> None:
        self._setter = setter
        self._volume: float = _DEFAULT_VOLUME
        self._muted: bool = False
        self._lock = threading.Lock()
        self._fade_thread: Optional[threading.Thread] = None

    # ── Volume ────────────────────────────────────────────────────────────────

    def set(self, volume: float) -> None:
        with self._lock:
            self._volume = max(_MIN_VOLUME, min(_MAX_VOLUME, volume))
            if not self._muted:
                self._apply(self._volume)

    def get(self) -> float:
        return self._volume

    def increase(self, step: float = 0.1) -> None:
        self.set(self._volume + step)

    def decrease(self, step: float = 0.1) -> None:
        self.set(self._volume - step)

    # ── Mute ──────────────────────────────────────────────────────────────────

    def mute(self) -> None:
        with self._lock:
            self._muted = True
            self._apply(0.0)

    def unmute(self) -> None:
        with self._lock:
            self._muted = False
            self._apply(self._volume)

    def toggle_mute(self) -> None:
        if self._muted:
            self.unmute()
        else:
            self.mute()

    @property
    def is_muted(self) -> bool:
        return self._muted

    # ── Fade ──────────────────────────────────────────────────────────────────

    def fade_in(self, duration_s: float = 1.0, target: Optional[float] = None) -> None:
        """Fade volume from 0 to *target* (or current volume) over *duration_s*."""
        end_vol = target if target is not None else self._volume
        self._start_fade(0.0, end_vol, duration_s)

    def fade_out(self, duration_s: float = 1.0) -> None:
        """Fade volume from current level to 0 over *duration_s*."""
        self._start_fade(self._volume, 0.0, duration_s)

    def _start_fade(self, start: float, end: float, duration_s: float) -> None:
        if self._fade_thread and self._fade_thread.is_alive():
            return  # Don't interrupt an active fade
        self._fade_thread = threading.Thread(
            target=self._fade_loop,
            args=(start, end, duration_s),
            daemon=True,
            name="volume-fade",
        )
        self._fade_thread.start()

    def _fade_loop(self, start: float, end: float, duration_s: float) -> None:
        step_size = (end - start) / _FADE_STEPS
        interval = duration_s / _FADE_STEPS
        current = start
        for _ in range(_FADE_STEPS):
            current = max(_MIN_VOLUME, min(_MAX_VOLUME, current + step_size))
            with self._lock:
                if not self._muted:
                    self._apply(current)
            time.sleep(interval)
        with self._lock:
            if not self._muted:
                self._apply(end)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _apply(self, volume: float) -> None:
        try:
            self._setter(volume)
        except Exception as exc:
            _log.warning("Volume setter error: %s", exc)
