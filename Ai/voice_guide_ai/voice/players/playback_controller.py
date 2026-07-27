"""
Voice Guide AI — Playback Controller.

Orchestrates AudioPlayer and SubtitlePlayer together.
Resolves audio file paths from language/module/dialogue_id triples.
Provides a single high-level API for the rest of the system.

BLOCKING FIX
------------
The original play() called:
  path.is_file()                 ← stat() syscall on caller thread
  self._subtitle.load()          ← string processing on caller thread
  self._subtitle.start()         ← spawns thread (fast, but still on caller)
  self._player.play(path)        ← previously blocked on pygame.mixer.music.load()

With the new AudioPlayer, self._player.play() posts a command to the
worker queue and returns immediately.  PlaybackController.play() is
therefore fully non-blocking.

The path existence check is kept but moved to a non-locking stat() call
that is acceptable since it is a single syscall (< 1 ms on local storage).
If the file is absent, we return False immediately without touching pygame.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable, Optional

from config.logger import get_logger
from voice.players.audio_player import AudioPlayer, PlaybackEvent, PlaybackState
from voice.players.subtitle_player import SubtitlePlayer, SubtitleFrame
from voice.utils.filename_generator import FilenameGenerator

_log = get_logger("voice.players.playback_controller")


class PlaybackController:
    """
    High-level playback controller.

    Resolves audio paths, plays MP3s, and synchronises subtitles.

    All methods return immediately — no caller ever blocks on pygame I/O.

    Parameters
    ----------
    base_dir : absolute path to voice_guide_ai/ package root
    """

    def __init__(self, base_dir: Path) -> None:
        self._filename = FilenameGenerator(base_dir)
        self._player   = AudioPlayer()
        self._subtitle = SubtitlePlayer()
        self._lock     = threading.Lock()
        self._current_language:    str = "hi"
        self._current_module:      str = ""
        self._current_dialogue_id: str = ""

        self._player.on_state_change(self._on_audio_state)

    # ── Playback ──────────────────────────────────────────────────────────────

    def play(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: Optional[str] = None,
        rtl: bool = False,
        duration_s: Optional[float] = None,
    ) -> bool:
        """
        Schedule playback of the MP3 for language/module/dialogue_id.

        Returns immediately after posting the play command to the
        AudioPlayer worker queue.  Never blocks on pygame I/O.

        Parameters
        ----------
        language     : language code, e.g. "hi", "rj/marwari"
        module       : page/module name, e.g. "login"
        dialogue_id  : dialogue identifier, e.g. "login_welcome_001"
        text         : subtitle text; if provided, subtitles are shown
        rtl          : right-to-left subtitle flag
        duration_s   : audio duration hint for subtitle timing
        """
        path = self._filename.audio_path(language, module, dialogue_id)

        # Single stat() call — fast, acceptable on any thread
        if not path.is_file():
            _log.warning("Audio file not found: %s", path)
            return False

        with self._lock:
            self._current_language    = language
            self._current_module      = module
            self._current_dialogue_id = dialogue_id

        # Subtitle setup is pure CPU (string splitting) — fast
        if text:
            self._subtitle.load(
                text=text, language=language, rtl=rtl, duration_s=duration_s
            )
            self._subtitle.start(position_getter=lambda: self._player.position_s)

        # AudioPlayer.play() posts to worker queue and returns immediately
        success = self._player.play(path)
        if not success:
            self._subtitle.stop()
        return success

    def pause(self) -> None:
        self._player.pause()

    def resume(self) -> None:
        self._player.resume()

    def stop(self) -> None:
        """
        Signal stop and return immediately.

        BLOCKING FIX: AudioPlayer.stop() no longer acquires a lock or
        waits for pygame — it posts _CMD_STOP to the worker queue.
        """
        self._player.stop()
        self._subtitle.stop()

    def replay(self) -> bool:
        self._subtitle.reset()
        return self._player.replay()

    def seek(self, seconds: float) -> None:
        self._player.seek(seconds)

    def seek_forward(self, step_s: float = 5.0) -> None:
        self._player.seek_forward(step_s)

    def seek_backward(self, step_s: float = 5.0) -> None:
        self._player.seek_backward(step_s)

    # ── Queue ─────────────────────────────────────────────────────────────────

    def enqueue(self, language: str, module: str, dialogue_id: str) -> None:
        path = self._filename.audio_path(language, module, dialogue_id)
        if path.is_file():
            self._player.enqueue(path)
        else:
            _log.warning("Cannot enqueue missing file: %s", path)

    def clear_queue(self) -> None:
        self._player.clear_queue()

    # ── Volume / Speed ────────────────────────────────────────────────────────

    def set_volume(self, volume: float) -> None:
        self._player.set_volume(volume)

    def get_volume(self) -> float:
        return self._player.get_volume()

    def mute(self) -> None:
        self._player.mute()

    def unmute(self) -> None:
        self._player.unmute()

    def toggle_mute(self) -> None:
        self._player.toggle_mute()

    def set_speed(self, speed: float) -> None:
        self._player.set_speed(speed)

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def on_playback_event(self, callback: Callable[[PlaybackEvent], None]) -> None:
        self._player.on_state_change(callback)

    def on_subtitle_update(self, callback: Callable[[SubtitleFrame], None]) -> None:
        self._subtitle.on_update(callback)

    # ── State ─────────────────────────────────────────────────────────────────

    @property
    def state(self) -> PlaybackState:
        return self._player.state

    @property
    def is_playing(self) -> bool:
        return self._player.is_playing

    @property
    def position_s(self) -> float:
        return self._player.position_s

    # ── Internal ──────────────────────────────────────────────────────────────

    def _on_audio_state(self, event: PlaybackEvent) -> None:
        # Stop subtitles whenever audio is no longer playing — including
        # ERROR state (e.g. file validation failed after subtitle already started).
        if event.state in (PlaybackState.IDLE, PlaybackState.STOPPED, PlaybackState.ERROR):
            self._subtitle.stop()

    def shutdown(self) -> None:
        self._player.shutdown()
        self._subtitle.stop()
