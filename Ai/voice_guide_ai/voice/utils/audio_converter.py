"""
Voice Guide AI — Audio Converter.

Converts audio between formats using ffmpeg (when available).
Falls back gracefully if ffmpeg is not installed.

Primary use: normalise Edge-TTS output to consistent MP3 settings
(128kbps, 24kHz, mono).
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Optional

from config.logger import get_logger

_log = get_logger("voice.utils.audio_converter")

_FFMPEG = shutil.which("ffmpeg")


class AudioConverter:
    """Converts audio files using ffmpeg."""

    @staticmethod
    def is_available() -> bool:
        """Return True if ffmpeg is available on PATH."""
        return _FFMPEG is not None

    @staticmethod
    def to_mp3(
        src: Path,
        dst: Path,
        bitrate: str = "128k",
        sample_rate: int = 24000,
        channels: int = 1,
    ) -> bool:
        """
        Convert *src* to MP3 at *dst* using ffmpeg.

        Returns True on success, False if ffmpeg is unavailable or fails.
        """
        if not _FFMPEG:
            _log.debug("ffmpeg not available; skipping conversion of %s", src)
            return False

        dst.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            _FFMPEG, "-y", "-i", str(src),
            "-ar", str(sample_rate),
            "-ac", str(channels),
            "-b:a", bitrate,
            "-f", "mp3",
            str(dst),
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
            )
            if result.returncode != 0:
                _log.warning(
                    "ffmpeg conversion failed for %s: %s",
                    src, result.stderr.decode(errors="replace")[:200],
                )
                return False
            _log.debug("Converted %s -> %s", src.name, dst.name)
            return True
        except subprocess.TimeoutExpired:
            _log.error("ffmpeg timed out converting %s", src)
            return False
        except OSError as exc:
            _log.error("ffmpeg error: %s", exc)
            return False

    @staticmethod
    def normalise_mp3(path: Path, bitrate: str = "128k") -> bool:
        """
        Normalise an existing MP3 in-place to consistent settings.

        Creates a temporary file, converts, then replaces the original.
        Returns True on success.
        """
        if not _FFMPEG:
            return False

        tmp = path.with_suffix(".tmp.mp3")
        success = AudioConverter.to_mp3(path, tmp, bitrate=bitrate)
        if success and tmp.exists():
            try:
                tmp.replace(path)
                return True
            except OSError as exc:
                _log.error("Cannot replace %s with normalised version: %s", path, exc)
                tmp.unlink(missing_ok=True)
        return False
