"""
Voice Guide AI — Audio Validator.

Validates audio files before playback and after generation:
  * File existence
  * Non-zero size
  * Valid MP3 format
  * Checksum verification
  * Minimum duration guard
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from voice.utils.audio_utils import AudioUtils
from voice.utils.checksum import ChecksumUtil

_log = get_logger("voice.utils.audio_validator")

MIN_VALID_SIZE_BYTES = 1024   # 1 KB minimum
MIN_VALID_DURATION_S = 0.1   # 100 ms minimum


@dataclass
class ValidationResult:
    valid: bool
    path: str
    error: Optional[str] = None

    def __bool__(self) -> bool:
        return self.valid


class AudioValidator:
    """Validates MP3 audio files for playback readiness."""

    @staticmethod
    def validate(
        path: Path,
        expected_checksum: Optional[str] = None,
    ) -> ValidationResult:
        """
        Validate *path* as a playback-ready MP3 file.

        Parameters
        ----------
        path              : path to the MP3 file
        expected_checksum : if provided, verify SHA-256 matches

        Returns
        -------
        ValidationResult with valid=True or valid=False + error message
        """
        if not path.exists():
            return ValidationResult(False, str(path), "File does not exist")

        size = path.stat().st_size
        if size < MIN_VALID_SIZE_BYTES:
            return ValidationResult(
                False, str(path),
                f"File too small: {size} bytes (min {MIN_VALID_SIZE_BYTES})"
            )

        if not AudioUtils.is_valid_mp3(path):
            return ValidationResult(False, str(path), "Not a valid MP3 file")

        duration = AudioUtils.estimate_duration_seconds(path)
        if duration < MIN_VALID_DURATION_S:
            return ValidationResult(
                False, str(path),
                f"Duration too short: {duration:.2f}s (min {MIN_VALID_DURATION_S}s)"
            )

        if expected_checksum:
            if not ChecksumUtil.verify_file(path, expected_checksum):
                return ValidationResult(False, str(path), "Checksum mismatch")

        _log.debug("Audio valid: %s (%.2fs, %d bytes)", path.name, duration, size)
        return ValidationResult(True, str(path))

    @staticmethod
    def validate_or_delete(
        path: Path,
        expected_checksum: Optional[str] = None,
    ) -> ValidationResult:
        """
        Validate *path*; delete it if invalid so it can be regenerated.

        Returns ValidationResult.
        """
        result = AudioValidator.validate(path, expected_checksum)
        if not result.valid and path.exists():
            try:
                path.unlink()
                _log.warning("Deleted invalid audio file: %s (%s)", path, result.error)
            except OSError as exc:
                _log.error("Cannot delete invalid file %s: %s", path, exc)
        return result
