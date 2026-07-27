"""
Voice Guide AI — Audio Player.

Thread-safe MP3 playback engine supporting:
  Play, Pause, Resume, Replay, Stop, Queue, Volume, Speed, Mute, Seek

Uses pygame.mixer when available; falls back to a no-op stub so the
rest of the system never crashes on headless environments.

BLOCKING FIX
------------
The original play() held self._lock while calling:
  pygame.mixer.music.load(str(path))   ← up to 200-500 ms on slow storage
  pygame.mixer.music.play()

This caused a deadlock path:

  Thread A (_play_background):
    AudioPlayer.play() → acquires _lock → pygame.mixer.music.load() [blocks]

  Thread B (NavigationManager.open_page → _cancel_and_advance_token):
    VoiceEngine.stop() → PlaybackController.stop() → AudioPlayer.stop()
    → tries to acquire _lock → BLOCKS waiting for Thread A

  Thread B is the FastAPI BackgroundTask thread.  While it blocks,
  the HTTP response cannot be sent, causing the 504 Gateway Timeout.

Fix: A single dedicated _PlaybackWorker thread owns all pygame calls.
  * play() posts a _CMD_PLAY command to a queue and returns immediately.
  * stop() posts _CMD_STOP and returns immediately.
  * pause()/resume() post their commands and return immediately.
  * The worker thread is the ONLY thread that ever touches pygame.
  * No caller ever blocks waiting for pygame.
  * A monotonic _play_token prevents stale commands from executing.
"""

from __future__ import annotations

import queue
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
    IDLE    = auto()
    LOADING = auto()
    PLAYING = auto()
    PAUSED  = auto()
    STOPPED = auto()
    ERROR   = auto()


@dataclass
class PlaybackEvent:
    state:      PlaybackState
    path:       str = ""
    position_s: float = 0.0
    error:      Optional[str] = None


# ── Worker command types ───────────────────────────────────────────────────────

_CMD_PLAY   = "play"
_CMD_STOP   = "stop"
_CMD_PAUSE  = "pause"
_CMD_RESUME = "resume"
_CMD_SEEK   = "seek"
_CMD_VOLUME = "volume"
_CMD_QUIT   = "quit"


@dataclass
class _Command:
    kind:  str
    path:  Optional[Path] = None
    token: int = 0
    value: float = 0.0   # seek seconds or volume level


# ── Backend abstraction ────────────────────────────────────────────────────────

class _AudioBackend:
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
    """pygame.mixer based audio backend — only ever called from the worker thread."""

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


# ── Dedicated playback worker ──────────────────────────────────────────────────

class _PlaybackWorker:
    """
    Single background thread that owns all pygame calls.

    All public methods post a command to a queue and return immediately.
    The worker thread is the only thread that ever calls pygame.mixer.*,
    so no caller can ever block waiting for pygame I/O.

    Cancellation: every play() call increments _token.  The worker
    checks the token after load() completes — if it changed, the
    command is stale and is discarded without calling play().
    """

    def __init__(
        self,
        backend: _AudioBackend,
        on_state: Callable[[PlaybackState, Optional[str]], None],
    ) -> None:
        self._backend  = backend
        self._on_state = on_state
        self._queue: queue.Queue[_Command] = queue.Queue()
        self._token    = 0
        self._lock     = threading.Lock()   # protects _token only
        self._thread   = threading.Thread(
            target=self._loop, daemon=True, name="audio-worker"
        )
        self._thread.start()

    def post_play(self, path: Path, token: int) -> None:
        self._queue.put(_Command(kind=_CMD_PLAY, path=path, token=token))

    def post_stop(self) -> None:
        self._queue.put(_Command(kind=_CMD_STOP))

    def post_pause(self) -> None:
        self._queue.put(_Command(kind=_CMD_PAUSE))

    def post_resume(self) -> None:
        self._queue.put(_Command(kind=_CMD_RESUME))

    def post_seek(self, seconds: float) -> None:
        self._queue.put(_Command(kind=_CMD_SEEK, value=seconds))

    def post_volume(self, volume: float) -> None:
        self._queue.put(_Command(kind=_CMD_VOLUME, value=volume))

    def post_quit(self) -> None:
        self._queue.put(_Command(kind=_CMD_QUIT))

    def current_token(self) -> int:
        with self._lock:
            return self._token

    def next_token(self) -> int:
        with self._lock:
            self._token += 1
            return self._token

    def _loop(self) -> None:
        """Worker loop — runs entirely on the dedicated audio thread."""
        monitor_active = False
        current_path: Optional[Path] = None

        while True:
            # Use a short timeout so the monitor poll still runs
            try:
                cmd = self._queue.get(timeout=0.25)
            except queue.Empty:
                # Monitor: check if track finished naturally
                if monitor_active and self._backend.is_playing() is False \
                        and not self._backend.is_paused():
                    monitor_active = False
                    self._on_state(PlaybackState.IDLE, None)
                continue

            if cmd.kind == _CMD_QUIT:
                self._backend.stop()
                break

            elif cmd.kind == _CMD_PLAY:
                # Validate file before touching pygame
                validation = AudioValidator.validate(cmd.path)
                if not validation.valid:
                    _log.error("Cannot play invalid file %s: %s", cmd.path, validation.error)
                    self._on_state(PlaybackState.ERROR, validation.error)
                    continue

                self._on_state(PlaybackState.LOADING, None)

                # Stop any current playback first
                self._backend.stop()

                # Check token — if a newer play() was posted, skip this one
                with self._lock:
                    if cmd.token != self._token:
                        _log.debug(
                            "Stale play command discarded: token=%d current=%d",
                            cmd.token, self._token,
                        )
                        continue

                # Load — this is the blocking pygame call, but it runs on
                # the worker thread, never on the HTTP or background task thread
                if not self._backend.load(cmd.path):
                    self._on_state(PlaybackState.ERROR, f"Failed to load {cmd.path}")
                    continue

                # Final token check after load (load itself can take time)
                with self._lock:
                    if cmd.token != self._token:
                        _log.debug("Stale play command discarded after load: token=%d", cmd.token)
                        self._backend.stop()
                        continue

                current_path = cmd.path
                self._backend.play()
                self._on_state(PlaybackState.PLAYING, None)
                monitor_active = True
                _log.info("Playing: %s", cmd.path.name)

            elif cmd.kind == _CMD_STOP:
                self._backend.stop()
                monitor_active = False
                self._on_state(PlaybackState.STOPPED, None)
                _log.debug("Stopped")

            elif cmd.kind == _CMD_PAUSE:
                if self._backend.is_playing():
                    self._backend.pause()
                    self._on_state(PlaybackState.PAUSED, None)
                    _log.debug("Paused")

            elif cmd.kind == _CMD_RESUME:
                if self._backend.is_paused():
                    self._backend.unpause()
                    self._on_state(PlaybackState.PLAYING, None)
                    _log.debug("Resumed")

            elif cmd.kind == _CMD_SEEK:
                self._backend.seek(cmd.value)
                _log.debug("Seeked to %.2fs", cmd.value)

            elif cmd.kind == _CMD_VOLUME:
                self._backend.set_volume(cmd.value)


# ── Audio Player ───────────────────────────────────────────────────────────────

class AudioPlayer:
    """
    Thread-safe MP3 audio player.

    All public methods return immediately — no caller ever blocks on
    pygame I/O.  All pygame calls run on the dedicated _PlaybackWorker
    thread.

    Supports: play, pause, resume, replay, stop, queue, volume,
              speed, mute, seek, state callbacks.
    """

    def __init__(self) -> None:
        self._backend: _AudioBackend = _make_backend()
        self._state    = PlaybackState.IDLE
        self._state_lock = threading.Lock()
        self._current_path: Optional[Path] = None
        self._queue: list[Path] = []
        self._queue_lock = threading.Lock()
        self._volume: float = 1.0
        self._muted:  bool = False
        self._speed:  float = 1.0
        self._callbacks: list[Callable[[PlaybackEvent], None]] = []

        self._worker = _PlaybackWorker(
            backend=self._backend,
            on_state=self._on_worker_state,
        )

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_state_change(self, callback: Callable[[PlaybackEvent], None]) -> None:
        """Register a callback invoked on every state change."""
        self._callbacks.append(callback)

    def _emit(self, state: PlaybackState, error: Optional[str] = None) -> None:
        with self._state_lock:
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

    def _on_worker_state(self, state: PlaybackState, error: Optional[str]) -> None:
        """Called by the worker thread on every state transition."""
        self._emit(state, error)
        # Auto-advance queue when a track finishes naturally
        if state == PlaybackState.IDLE:
            with self._queue_lock:
                if self._queue:
                    next_path = self._queue.pop(0)
                else:
                    next_path = None
            if next_path:
                self.play(next_path)

    # ── Playback controls ─────────────────────────────────────────────────────

    def play(self, path: Path) -> bool:
        """
        Schedule *path* for playback and return immediately.

        BLOCKING FIX: This method no longer holds any lock while calling
        pygame.  It posts a _CMD_PLAY command to the worker queue and
        returns True.  The worker thread performs the actual load/play.
        """
        self._current_path = path
        token = self._worker.next_token()
        self._worker.post_play(path, token)
        return True

    def pause(self) -> None:
        self._worker.post_pause()

    def resume(self) -> None:
        self._worker.post_resume()

    def stop(self) -> None:
        """
        Signal the worker to stop and return immediately.

        BLOCKING FIX: No longer acquires _lock or waits for pygame.
        """
        # Advance token so any in-flight play command is discarded
        self._worker.next_token()
        self._worker.post_stop()
        with self._queue_lock:
            self._queue.clear()

    def replay(self) -> bool:
        """Replay the current track from the beginning."""
        if self._current_path is None:
            return False
        return self.play(self._current_path)

    def seek(self, seconds: float) -> None:
        self._worker.post_seek(seconds)

    def seek_forward(self, step_s: float = 5.0) -> None:
        pos = self._backend.get_pos_s()
        self._worker.post_seek(pos + step_s)

    def seek_backward(self, step_s: float = 5.0) -> None:
        pos = self._backend.get_pos_s()
        self._worker.post_seek(max(0.0, pos - step_s))

    # ── Volume / Speed ────────────────────────────────────────────────────────

    def set_volume(self, volume: float) -> None:
        self._volume = max(0.0, min(1.0, volume))
        if not self._muted:
            self._worker.post_volume(self._volume)

    def get_volume(self) -> float:
        return self._volume

    def mute(self) -> None:
        self._muted = True
        self._worker.post_volume(0.0)

    def unmute(self) -> None:
        self._muted = False
        self._worker.post_volume(self._volume)

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
        with self._queue_lock:
            self._queue.append(path)
            _log.debug("Enqueued: %s (queue size=%d)", path.name, len(self._queue))
        with self._state_lock:
            idle = self._state == PlaybackState.IDLE
        if idle:
            self._play_next()

    def enqueue_all(self, paths: list[Path]) -> None:
        for path in paths:
            self.enqueue(path)

    def clear_queue(self) -> None:
        with self._queue_lock:
            self._queue.clear()

    def _play_next(self) -> None:
        with self._queue_lock:
            if not self._queue:
                return
            next_path = self._queue.pop(0)
        self.play(next_path)

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def state(self) -> PlaybackState:
        with self._state_lock:
            return self._state

    @property
    def is_playing(self) -> bool:
        with self._state_lock:
            return self._state == PlaybackState.PLAYING

    @property
    def is_paused(self) -> bool:
        with self._state_lock:
            return self._state == PlaybackState.PAUSED

    @property
    def position_s(self) -> float:
        return self._backend.get_pos_s()

    @property
    def current_path(self) -> Optional[Path]:
        return self._current_path

    def shutdown(self) -> None:
        self._worker.post_quit()
