"""
Voice Guide AI — Checksum Utility.

SHA-256 based checksum generation and validation for audio cache integrity.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

from config.logger import get_logger

_log = get_logger("voice.utils.checksum")

CHUNK_SIZE = 65536  # 64 KB


class ChecksumUtil:
    """SHA-256 checksum generation and validation."""

    @staticmethod
    def compute_file(path: Path) -> Optional[str]:
        """
        Compute SHA-256 hex digest of *path*.

        Returns None if the file cannot be read.
        """
        try:
            h = hashlib.sha256()
            with open(path, "rb") as fh:
                while chunk := fh.read(CHUNK_SIZE):
                    h.update(chunk)
            return h.hexdigest()
        except OSError as exc:
            _log.warning("Cannot checksum %s: %s", path, exc)
            return None

    @staticmethod
    def compute_bytes(data: bytes) -> str:
        """Compute SHA-256 hex digest of raw *data*."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def compute_text(text: str, language: str, voice_id: str) -> str:
        """
        Compute a deterministic cache key from text + language + voice_id.

        Used to detect whether a cached file is still valid for the
        current text/voice combination.
        """
        payload = f"{language}|{voice_id}|{text}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def verify_file(path: Path, expected: str) -> bool:
        """
        Return True if the SHA-256 of *path* matches *expected*.

        Returns False if the file is missing or the digest differs.
        """
        actual = ChecksumUtil.compute_file(path)
        if actual is None:
            return False
        match = actual == expected
        if not match:
            _log.warning(
                "Checksum mismatch for %s: expected=%s actual=%s",
                path, expected[:12], actual[:12],
            )
        return match
