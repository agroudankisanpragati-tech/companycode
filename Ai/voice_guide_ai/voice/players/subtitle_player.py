"""
Voice Guide AI — Subtitle Player.

Displays and synchronises subtitles with audio playback.

Features
--------
* Sync subtitle display to audio position
* Highlight current sentence
* Multiline support with configurable max chars per line
* Language switching (RTL-aware)
* Callback-based rendering (UI-agnostic)
* Thread-safe
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

from config.logger import get_logger

_log = get_logger("voice.players.subtitle_player")

_DEFAULT_MAX_CHARS = 60
_DEFAULT_SYNC_OFFSET_MS = 0
_POLL_INTERVAL_S = 0.05


@dataclass
class SubtitleLine:
    index: int
    text: str
    start_s: float
    end_s: float
    is_current: bool = False


@dataclass
class SubtitleFrame:
    """Snapshot of subtitle state delivered to render callbacks."""
    lines: list[SubtitleLine]
    current_index: int
    language: str
    rtl: bool
    position_s: float


SubtitleCallback = Callable[[SubtitleFrame], None]


class SubtitlePlayer:
    """
    Synchronises subtitle text with audio playback position.

    Usage
    -----
    player = SubtitlePlayer()
    player.on_update(my_render_callback)
    player.load(text="...", language="hi", rtl=False)
    player.start(position_getter=audio_player.position_s)
    # ... audio plays ...
    player.stop()
    """

    def __init__(
        self,
        max_chars_per_line: int = _DEFAULT_MAX_CHARS,
        sync_offset_ms: int = _DEFAULT_SYNC_OFFSET_MS,
    ) -> None:
        self._max_chars = max_chars_per_line
        self._sync_offset_s = sync_offset_ms / 1000.0
        self._lock = threading.Lock()
        self._lines: list[SubtitleLine] = []
        self._language: str = "hi"
        self._rtl: bool = False
        self._current_index: int = -1
        self._callbacks: list[SubtitleCallback] = []
        self._active: bool = False
        self._thread: Optional[threading.Thread] = None
        self._position_getter: Optional[Callable[[], float]] = None

    # ── Configuration ─────────────────────────────────────────────────────────

    def on_update(self, callback: SubtitleCallback) -> None:
        """Register a callback invoked whenever the subtitle state changes."""
        self._callbacks.append(callback)

    def set_language(self, language: str, rtl: bool = False) -> None:
        with self._lock:
            self._language = language
            self._rtl = rtl

    # ── Load ──────────────────────────────────────────────────────────────────

    def load(
        self,
        text: str,
        language: str,
        rtl: bool = False,
        duration_s: Optional[float] = None,
    ) -> None:
        """
        Load *text* as subtitle content.

        Splits text into sentences, wraps long lines, and assigns
        proportional time windows based on character count.

        Parameters
        ----------
        text       : full subtitle text
        language   : language code
        rtl        : right-to-left flag
        duration_s : total audio duration; used for time assignment
        """
        sentences = self._split_sentences(text)
        wrapped = [self._wrap(s) for s in sentences if s.strip()]
        total_chars = sum(len(s) for s in wrapped) or 1
        total_dur = duration_s or max(len(text) * 0.06, 3.0)

        lines: list[SubtitleLine] = []
        cursor = 0.0
        for i, sentence in enumerate(wrapped):
            proportion = len(sentence) / total_chars
            dur = total_dur * proportion
            lines.append(SubtitleLine(
                index=i,
                text=sentence,
                start_s=cursor,
                end_s=cursor + dur,
                is_current=False,
            ))
            cursor += dur

        with self._lock:
            self._lines = lines
            self._language = language
            self._rtl = rtl
            self._current_index = -1

        _log.debug("Subtitle loaded: %d lines, lang=%s, dur=%.1fs", len(lines), language, total_dur)

    def load_timed(
        self,
        entries: list[dict],
        language: str,
        rtl: bool = False,
    ) -> None:
        """
        Load pre-timed subtitle entries.

        Each entry: {"text": str, "start_s": float, "end_s": float}
        """
        lines = [
            SubtitleLine(
                index=i,
                text=self._wrap(e["text"]),
                start_s=float(e["start_s"]),
                end_s=float(e["end_s"]),
            )
            for i, e in enumerate(entries)
            if e.get("text", "").strip()
        ]
        with self._lock:
            self._lines = lines
            self._language = language
            self._rtl = rtl
            self._current_index = -1

    # ── Playback sync ─────────────────────────────────────────────────────────

    def start(self, position_getter: Callable[[], float]) -> None:
        """
        Start the subtitle sync loop.

        Parameters
        ----------
        position_getter : callable returning current audio position in seconds
        """
        self._position_getter = position_getter
        self._active = True
        self._thread = threading.Thread(
            target=self._sync_loop, daemon=True, name="subtitle-sync"
        )
        self._thread.start()
        _log.debug("Subtitle sync started")

    def stop(self) -> None:
        self._active = False
        _log.debug("Subtitle sync stopped")

    def reset(self) -> None:
        with self._lock:
            self._current_index = -1
            for line in self._lines:
                line.is_current = False

    # ── Internal ──────────────────────────────────────────────────────────────

    def _sync_loop(self) -> None:
        last_index = -1
        while self._active:
            time.sleep(_POLL_INTERVAL_S)
            if self._position_getter is None:
                continue
            try:
                pos = self._position_getter() + self._sync_offset_s
            except Exception:
                continue

            with self._lock:
                new_index = self._find_line_index(pos)
                if new_index == last_index:
                    continue
                for line in self._lines:
                    line.is_current = (line.index == new_index)
                self._current_index = new_index
                frame = SubtitleFrame(
                    lines=list(self._lines),
                    current_index=new_index,
                    language=self._language,
                    rtl=self._rtl,
                    position_s=pos,
                )
            last_index = new_index
            self._emit(frame)

    def _find_line_index(self, pos: float) -> int:
        for line in self._lines:
            if line.start_s <= pos < line.end_s:
                return line.index
        return -1

    def _emit(self, frame: SubtitleFrame) -> None:
        for cb in self._callbacks:
            try:
                cb(frame)
            except Exception as exc:
                _log.warning("Subtitle callback error: %s", exc)

    # ── Text processing ───────────────────────────────────────────────────────

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        """Split text into sentences on punctuation boundaries."""
        parts = re.split(r'(?<=[।.!?])\s+', text.strip())
        return [p.strip() for p in parts if p.strip()]

    def _wrap(self, text: str) -> str:
        """Wrap *text* to max_chars_per_line using newlines."""
        if len(text) <= self._max_chars:
            return text
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            if current and len(current) + 1 + len(word) > self._max_chars:
                lines.append(current)
                current = word
            else:
                current = f"{current} {word}".strip()
        if current:
            lines.append(current)
        return "\n".join(lines)

    # ── State accessors ───────────────────────────────────────────────────────

    @property
    def current_line(self) -> Optional[SubtitleLine]:
        with self._lock:
            if 0 <= self._current_index < len(self._lines):
                return self._lines[self._current_index]
        return None

    @property
    def all_lines(self) -> list[SubtitleLine]:
        with self._lock:
            return list(self._lines)

    @property
    def language(self) -> str:
        return self._language
