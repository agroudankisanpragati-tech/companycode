"""
Voice Guide AI — Audio Player.

Thread-safe MP3 playback engine supporting:
  Play, Pause, Resume, Replay, Stop, Queue, Volume, Speed, Mute, Seek

Uses pygame.mixer when available; falls back to a no-op stub so the
rest of the system never crashes on headless environments.

Architecture: provider-agnostic.  The player receives a file path and
plays it — it does not know or care how the MP3 was generated.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Callable, Optional

from config.logger import get_logger
from voice.utils.audio_validator import AudioValidator

_log = get_logger("voice.players.audio_player")


class PlaybackState(Enum):
    IDLE = auto()
    LOADING = auto()
    PLAYING = auto()
    PAUSED = auto()
    STOPPED = auto()
    ERROR = auto()


@dataclass
class PlaybackEvent:
    state: PlaybackState
    path: str = ""
    position_s: float = 0.0
    error: Optional[str] = None


# ── Backend abstraction ────────────────────────────────────────────────────────

class _AudioBackend:
    """Abstract audio backend interface."""

    def load(self, path: Path) -> bool: ...
    def play(self) -> None: ...
    def pause(self) -> None: ...
    def unpause(self) -> None: ...
    def stop(self) -> None: ...
    def set_volume(self, volume: float) -> None: ...
    def get_volume(self) -> float: ...
    def is_playing(self) -> bool: ...
    def is_paused(self) -> bool: ...
    def get_pos_s(self) -> float: ...
    def seek(self, seconds: float) -> None: ...
    def set_speed(self, speed: float) -> None: ...
    def available(self) -> bool: ...


class _PygameBackend(_AudioBackend):
    """pygame.mixer based audio backend."""

    def __init__(self) -> None:
        self._available = False
        self._loaded_path: Optional[Path] = None
        self._start_time: float = 0.0
        self._pause_time: float = 0.0
        self._paused: bool = False
        self._volume: float = 1.0
        try:
            import pygame
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=24000, size=-16, channels=1, buffer=512)
            self._pygame = pygame
            self._available = True
            _log.debug("pygame.mixer initialised")
        except Exception as exc:
            _log.warning("pygame unavailable: %s — audio playback disabled", exc)

    def available(self) -> bool:
        return self._available

    def load(self, path: Path) -> bool:
        if not self._available:
            return False
        try:
            self._pygame.mixer.music.load(str(path))
            self._loaded_path = path
            self._paused = False
            return True
        except Exception as exc:
            _log.error("Failed to load %s: %s", path, exc)
            return False

    def play(self) -> None:
        if not self._available:
            return
        self._pygame.mixer.music.play()
        self._start_time = time.monotonic()
        self._paused = False

    def pause(self) -> None:
        if not self._available:
            return
        self._pygame.mixer.music.pause()
        self._pause_time = time.monotonic()
        self._paused = True

    def unpause(self) -> None:
        if not self._available:
            return
        self._pygame.mixer.music.unpause()
        elapsed_paused = time.monotonic() - self._pause_time
        self._start_time += elapsed_paused
        self._paused = False

    def stop(self) -> None:
        if not self._available:
            return
        self._pygame.mixer.music.stop()
        self._paused = False

    def set_volume(self, volume: float) -> None:
        self._volume = max(0.0, min(1.0, volume))
        if self._available:
            self._pygame.mixer.music.set_volume(self._volume)

    def get_volume(self) -> float:
        return self._volume

    def is_playing(self) -> bool:
        if not self._available:
            return False
        return self._pygame.mixer.music.get_busy() and not self._paused

    def is_paused(self) -> bool:
        return self._paused

    def get_pos_s(self) -> float:
        if not self._available or self._paused:
            return 0.0
        if not self._pygame.mixer.music.get_busy():
            return 0.0
        return max(0.0, time.monotonic() - self._start_time)

    def seek(self, seconds: float) -> None:
        if not self._available or self._loaded_path is None:
            return
        try:
            self._pygame.mixer.music.play(start=max(0.0, seconds))
            self._start_time = time.monotonic() - seconds
            self._paused = False
        except Exception as exc:
            _log.warning("Seek failed: %s", exc)

    def set_speed(self, speed: float) -> None:
        # pygame does not support speed natively; log and ignore
        _log.debug("Speed control not supported by pygame backend (requested %.2f)", speed)


class _NullBackend(_AudioBackend):
    """No-op backend used when no audio library is available."""

    def available(self) -> bool: return False
    def load(self, path: Path) -> bool: return True
    def play(self) -> None: pass
    def pause(self) -> None: pass
    def unpause(self) -> None: pass
    def stop(self) -> None: pass
    def set_volume(self, volume: float) -> None: pass
    def get_volume(self) -> float: return 1.0
    def is_playing(self) -> bool: return False
    def is_paused(self) -> bool: return False
    def get_pos_s(self) -> float: return 0.0
    def seek(self, seconds: float) -> None: pass
    def set_speed(self, speed: float) -> None: pass


def _make_backend() -> _AudioBackend:
    backend = _PygameBackend()
    if backend.available():
        return backend
    return _NullBackend()


# ── Audio Player ───────────────────────────────────────────────────────────────

class AudioPlayer:
    """
    Thread-safe MP3 audio player.

    Supports: play, pause, resume, replay, stop, queue, volume,
              speed, mute, seek, state callbacks.
    """

    def __init__(self) -> None:
        self._backend: _AudioBackend = _make_backend()
        self._lock = threading.Lock()
        self._state = PlaybackState.IDLE
        self._current_path: Optional[Path] = None
        self._queue: list[Path] = []
        self._volume: float = 1.0
        self._muted: bool = False
        self._speed: float = 1.0
        self._callbacks: list[Callable[[PlaybackEvent], None]] = []
        self._monitor_thread: Optional[threading.Thread] = None
        self._monitor_active = False

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_state_change(self, callback: Callable[[PlaybackEvent], None]) -> None:
        """Register a callback invoked on every state change."""
        self._callbacks.append(callback)

    def _emit(self, state: PlaybackState, error: Optional[str] = None) -> None:
        self._state = state
        event = PlaybackEvent(
            state=state,
            path=str(self._current_path) if self._current_path else "",
            position_s=self._backend.get_pos_s(),
            error=error,
        )
        for cb in self._callbacks:
            try:
                cb(event)
            except Exception as exc:
                _log.warning("Callback error: %s", exc)

    # ── Playback controls ─────────────────────────────────────────────────────

    def play(self, path: Path) -> bool:
        """Load and play *path* immediately."""
        with self._lock:
            validation = AudioValidator.validate(path)
            if not validation.valid:
                _log.error("Cannot play invalid file %s: %s", path, validation.error)
                self._emit(PlaybackState.ERROR, validation.error)
                return False

            self._backend.stop()
            self._emit(PlaybackState.LOADING)
            if not self._backend.load(path):
                self._emit(PlaybackState.ERROR, f"Failed to load {path}")
                return False

            self._current_path = path
            self._backend.set_volume(0.0 if self._muted else self._volume)
            self._backend.play()
            self._emit(PlaybackState.PLAYING)
            self._start_monitor()
            _log.info("Playing: %s", path.name)
            return True

    def pause(self) -> None:
        with self._lock:
            if self._state == PlaybackState.PLAYING:
                self._backend.pause()
                self._emit(PlaybackState.PAUSED)
                _log.debug("Paused")

    def resume(self) -> None:
        with self._lock:
            if self._state == PlaybackState.PAUSED:
                self._backend.unpause()
                self._emit(PlaybackState.PLAYING)
                _log.debug("Resumed")

    def stop(self) -> None:
        with self._lock:
            self._backend.stop()
            self._queue.clear()
            self._emit(PlaybackState.STOPPED)
            _log.debug("Stopped")

    def replay(self) -> bool:
        """Replay the current track from the beginning."""
        with self._lock:
            if self._current_path is None:
                return False
            path = self._current_path
        return self.play(path)

    def seek(self, seconds: float) -> None:
        with self._lock:
            self._backend.seek(seconds)
            _log.debug("Seeked to %.2fs", seconds)

    def seek_forward(self, step_s: float = 5.0) -> None:
        pos = self._backend.get_pos_s()
        self.seek(pos + step_s)

    def seek_backward(self, step_s: float = 5.0) -> None:
        pos = self._backend.get_pos_s()
        self.seek(max(0.0, pos - step_s))

    # ── Volume / Speed ────────────────────────────────────────────────────────

    def set_volume(self, volume: float) -> None:
        self._volume = max(0.0, min(1.0, volume))
        if not self._muted:
            self._backend.set_volume(self._volume)

    def get_volume(self) -> float:
        return self._volume

    def mute(self) -> None:
        self._muted = True
        self._backend.set_volume(0.0)

    def unmute(self) -> None:
        self._muted = False
        self._backend.set_volume(self._volume)

    def toggle_mute(self) -> None:
        if self._muted:
            self.unmute()
        else:
            self.mute()

    def set_speed(self, speed: float) -> None:
        self._speed = max(0.5, min(2.0, speed))
        self._backend.set_speed(self._speed)

    # ── Queue ─────────────────────────────────────────────────────────────────

    def enqueue(self, path: Path) -> None:
        """Add *path* to the playback queue."""
        with self._lock:
            self._queue.append(path)
            _log.debug("Enqueued: %s (queue size=%d)", path.name, len(self._queue))
        if self._state == PlaybackState.IDLE:
            self._play_next()

    def enqueue_all(self, paths: list[Path]) -> None:
        for path in paths:
            self.enqueue(path)

    def clear_queue(self) -> None:
        with self._lock:
            self._queue.clear()

    def _play_next(self) -> None:
        with self._lock:
            if not self._queue:
                return
            next_path = self._queue.pop(0)
        self.play(next_path)

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def state(self) -> PlaybackState:
        return self._state

    @property
    def is_playing(self) -> bool:
        return self._state == PlaybackState.PLAYING

    @property
    def is_paused(self) -> bool:
        return self._state == PlaybackState.PAUSED

    @property
    def position_s(self) -> float:
        return self._backend.get_pos_s()

    @property
    def current_path(self) -> Optional[Path]:
        return self._current_path

    # ── Monitor thread ────────────────────────────────────────────────────────

    def _start_monitor(self) -> None:
        if self._monitor_active:
            return
        self._monitor_active = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop, daemon=True, name="audio-monitor"
        )
        self._monitor_thread.start()

    def _monitor_loop(self) -> None:
        """Poll playback state and advance queue when track ends."""
        while self._monitor_active:
            time.sleep(0.25)
            with self._lock:
                if self._state != PlaybackState.PLAYING:
                    continue
                if not self._backend.is_playing() and not self._backend.is_paused():
                    # Track finished
                    if self._queue:
                        next_path = self._queue.pop(0)
                        _log.debug("Queue advance: %s", next_path.name)
                        self._backend.load(next_path)
                        self._current_path = next_path
                        self._backend.play()
                        self._emit(PlaybackState.PLAYING)
                    else:
                        self._emit(PlaybackState.IDLE)
                        self._monitor_active = False

    def shutdown(self) -> None:
        self._monitor_active = False
        self._backend.stop()
