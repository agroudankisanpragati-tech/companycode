"""
Voice Guide AI — Audio Compressor.

Reduces MP3 file sizes for storage and bandwidth optimisation.
Uses ffmpeg when available; no-ops gracefully when not installed.
"""

from __future__ import annotations

from pathlib import Path

from config.logger import get_logger
from voice.utils.audio_converter import AudioConverter

_log = get_logger("voice.utils.audio_compressor")

# Target bitrate for compressed voice-guide audio
_VOICE_BITRATE = "64k"


class AudioCompressor:
    """Compresses MP3 files to reduce storage footprint."""

    @staticmethod
    def compress(src: Path, dst: Path) -> bool:
        """
        Compress *src* MP3 to *dst* at voice-optimised bitrate.

        Returns True on success.
        """
        if not AudioConverter.is_available():
            _log.debug("ffmpeg unavailable; skipping compression of %s", src)
            return False

        success = AudioConverter.to_mp3(
            src, dst,
            bitrate=_VOICE_BITRATE,
            sample_rate=22050,
            channels=1,
        )
        if success:
            src_size = src.stat().st_size if src.exists() else 0
            dst_size = dst.stat().st_size if dst.exists() else 0
            _log.debug(
                "Compressed %s: %d -> %d bytes (%.0f%%)",
                src.name, src_size, dst_size,
                (1 - dst_size / max(src_size, 1)) * 100,
            )
        return success

    @staticmethod
    def compress_inplace(path: Path) -> bool:
        """
        Compress *path* in-place.

        Returns True on success.
        """
        tmp = path.with_suffix(".compressed.mp3")
        if AudioCompressor.compress(path, tmp):
            try:
                tmp.replace(path)
                return True
            except OSError as exc:
                _log.error("Cannot replace %s: %s", path, exc)
                tmp.unlink(missing_ok=True)
        return False
