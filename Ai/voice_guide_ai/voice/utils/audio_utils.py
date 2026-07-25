"""
Voice Guide AI — Audio Utilities.

Helpers for:
  * MP3 duration estimation (header-based, no heavy deps)
  * Audio file format validation
  * Sample rate / bitrate extraction from MP3 frames
  * Silence detection (byte-level heuristic)
  * Audio metadata building
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Optional

from config.logger import get_logger

_log = get_logger("voice.utils.audio_utils")

# MP3 frame sync word
_MP3_SYNC = 0xFFE0

# MPEG version bits → sample rate table
_SAMPLE_RATES: dict[int, dict[int, int]] = {
    0b11: {0: 44100, 1: 48000, 2: 32000},  # MPEG 1
    0b10: {0: 22050, 1: 24000, 2: 16000},  # MPEG 2
    0b00: {0: 11025, 1: 12000, 2:  8000},  # MPEG 2.5
}

# MPEG 1 Layer 3 bitrate table (kbps)
_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]


class AudioUtils:
    """Stateless audio file utilities."""

    # ── Duration ──────────────────────────────────────────────────────────────

    @staticmethod
    def estimate_duration_seconds(path: Path) -> float:
        """
        Estimate MP3 duration in seconds from the first valid frame header.

        Uses CBR estimation: file_size / (bitrate_bps / 8).
        Returns 0.0 on any error.
        """
        try:
            data = path.read_bytes()
            header = AudioUtils._find_first_frame(data)
            if header is None:
                return 0.0

            bitrate_kbps = header.get("bitrate_kbps", 128)
            if bitrate_kbps <= 0:
                bitrate_kbps = 128

            # Skip ID3 tag if present
            offset = AudioUtils._id3_size(data)
            audio_bytes = len(data) - offset
            duration = (audio_bytes * 8) / (bitrate_kbps * 1000)
            return round(max(0.0, duration), 2)
        except Exception as exc:
            _log.debug("Duration estimation failed for %s: %s", path, exc)
            return 0.0

    @staticmethod
    def _id3_size(data: bytes) -> int:
        """Return the size of an ID3v2 tag at the start of *data*, or 0."""
        if len(data) < 10 or data[:3] != b"ID3":
            return 0
        # ID3v2 size is encoded as 4 syncsafe bytes
        size = (
            (data[6] & 0x7F) << 21
            | (data[7] & 0x7F) << 14
            | (data[8] & 0x7F) << 7
            | (data[9] & 0x7F)
        )
        return size + 10

    @staticmethod
    def _find_first_frame(data: bytes) -> Optional[dict]:
        """Scan *data* for the first valid MP3 frame header and parse it."""
        for i in range(min(len(data) - 4, 8192)):
            word = struct.unpack_from(">H", data, i)[0]
            if (word & _MP3_SYNC) != _MP3_SYNC:
                continue
            header_int = struct.unpack_from(">I", data, i)[0]
            parsed = AudioUtils._parse_frame_header(header_int)
            if parsed:
                return parsed
        return None

    @staticmethod
    def _parse_frame_header(h: int) -> Optional[dict]:
        """Parse a 4-byte MP3 frame header integer. Returns None if invalid."""
        sync        = (h >> 21) & 0x7FF
        mpeg_ver    = (h >> 19) & 0x03
        layer       = (h >> 17) & 0x03
        bitrate_idx = (h >> 12) & 0x0F
        sr_idx      = (h >> 10) & 0x03
        channel     = (h >>  6) & 0x03

        if sync != 0x7FF:
            return None
        if layer != 0x01:  # Layer 3
            return None
        if mpeg_ver == 0b01:  # reserved
            return None
        if bitrate_idx in (0, 15) or sr_idx == 3:
            return None

        bitrate_kbps = _BITRATES_V1_L3[bitrate_idx]
        sample_rate  = _SAMPLE_RATES.get(mpeg_ver, {}).get(sr_idx, 44100)

        return {
            "bitrate_kbps": bitrate_kbps,
            "sample_rate":  sample_rate,
            "channels":     1 if channel == 3 else 2,
        }

    # ── Validation ────────────────────────────────────────────────────────────

    @staticmethod
    def is_valid_mp3(path: Path) -> bool:
        """
        Return True if *path* is a non-empty file that starts with a valid
        MP3 sync word or ID3 tag.
        """
        try:
            if not path.is_file() or path.stat().st_size < 4:
                return False
            data = path.read_bytes()
            # Accept ID3 tag or raw MP3 sync
            if data[:3] == b"ID3":
                return True
            word = struct.unpack_from(">H", data, 0)[0]
            return (word & _MP3_SYNC) == _MP3_SYNC
        except OSError:
            return False

    # ── Metadata ──────────────────────────────────────────────────────────────

    @staticmethod
    def build_metadata(
        path: Path,
        language: str,
        module: str,
        dialogue_id: str,
        text: str,
        voice_id: str,
        checksum: str,
    ) -> dict:
        """Build a metadata dict for an audio file entry."""
        size = path.stat().st_size if path.is_file() else 0
        duration = AudioUtils.estimate_duration_seconds(path)
        return {
            "dialogue_id": dialogue_id,
            "language":    language,
            "module":      module,
            "voice_id":    voice_id,
            "path":        path.as_posix(),
            "size_bytes":  size,
            "duration_s":  duration,
            "checksum":    checksum,
            "text_length": len(text),
        }
