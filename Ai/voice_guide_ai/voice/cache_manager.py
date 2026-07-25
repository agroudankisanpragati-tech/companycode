"""
Voice Guide AI — Cache Manager (voice engine layer).

Manages the MP3 audio cache:
  * Cache-hit detection (file exists + valid + checksum matches)
  * Checksum index persistence (voice/metadata/checksum.json)
  * Cache eviction (LRU, size-based)
  * Cache statistics

Never regenerates a file that already exists and is valid.
"""

from __future__ import annotations

import datetime
import threading
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from voice.utils.audio_validator import AudioValidator
from voice.utils.checksum import ChecksumUtil
from voice.utils.file_utils import FileUtils
from voice.utils.filename_generator import FilenameGenerator

_log = get_logger("voice.cache_manager")

_CHECKSUM_FILE = Path("voice") / "metadata" / "checksum.json"
_MAX_CACHE_MB = 500


class CacheManager:
    """
    Thread-safe audio cache manager.

    Parameters
    ----------
    base_dir        : absolute path to voice_guide_ai/ package root
    max_cache_mb    : maximum cache size in megabytes before eviction
    validate_checksum : verify SHA-256 on cache hits
    """

    def __init__(
        self,
        base_dir: Path,
        max_cache_mb: int = _MAX_CACHE_MB,
        validate_checksum: bool = True,
    ) -> None:
        self._base = base_dir
        self._max_bytes = max_cache_mb * 1024 * 1024
        self._validate_checksum = validate_checksum
        self._filename = FilenameGenerator(base_dir)
        self._lock = threading.Lock()
        self._checksums: dict[str, str] = self._load_checksums()

    # ── Cache hit detection ───────────────────────────────────────────────────

    def is_cached(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        text: Optional[str] = None,
        voice_id: Optional[str] = None,
    ) -> bool:
        """
        Return True if a valid, up-to-date cached MP3 exists.

        If *text* and *voice_id* are provided, also verifies the content
        checksum to detect stale cache entries.
        """
        path = self._filename.audio_path(language, module, dialogue_id)

        if not FileUtils.is_non_empty(path):
            return False

        validation = AudioValidator.validate(path)
        if not validation.valid:
            _log.debug("Cache invalid: %s — %s", path.name, validation.error)
            return False

        if self._validate_checksum and text and voice_id:
            expected = ChecksumUtil.compute_text(text, language, voice_id)
            key = self._filename.cache_key(language, module, dialogue_id)
            stored = self._checksums.get(key)
            if stored and stored != expected:
                _log.debug("Cache stale (text changed): %s", path.name)
                return False

        return True

    def register(
        self,
        language: str,
        module: str,
        dialogue_id: str,
        path: Path,
        text: str,
        voice_id: str,
    ) -> None:
        """Record a newly generated file in the checksum index."""
        key = self._filename.cache_key(language, module, dialogue_id)
        content_hash = ChecksumUtil.compute_text(text, language, voice_id)
        with self._lock:
            self._checksums[key] = content_hash
        self._save_checksums()

    # ── Cache statistics ──────────────────────────────────────────────────────

    def stats(self) -> dict:
        """Return cache statistics."""
        audio_dir = self._base / "voice" / "audio"
        files = list(FileUtils.scan_mp3_files(audio_dir))
        total_bytes = sum(f.stat().st_size for f in files if f.is_file())
        return {
            "total_files": len(files),
            "total_size_mb": round(total_bytes / (1024 * 1024), 2),
            "max_size_mb": self._max_bytes // (1024 * 1024),
            "utilisation_pct": round(total_bytes / max(self._max_bytes, 1) * 100, 1),
            "checksum_entries": len(self._checksums),
        }

    # ── Eviction ──────────────────────────────────────────────────────────────

    def evict_if_needed(self) -> int:
        """
        Delete oldest files (by mtime) until cache is under max_cache_mb.

        Returns number of files deleted.
        """
        audio_dir = self._base / "voice" / "audio"
        files = sorted(
            FileUtils.scan_mp3_files(audio_dir),
            key=lambda f: f.stat().st_mtime,
        )
        total_bytes = sum(f.stat().st_size for f in files if f.is_file())
        deleted = 0

        while total_bytes > self._max_bytes and files:
            oldest = files.pop(0)
            size = oldest.stat().st_size if oldest.is_file() else 0
            if FileUtils.delete_file(oldest):
                total_bytes -= size
                deleted += 1
                _log.info("Evicted: %s", oldest.name)

        if deleted:
            _log.info("Cache eviction: deleted %d files", deleted)
        return deleted

    def clear_language(self, language: str) -> int:
        """Delete all cached MP3s for *language*. Returns count deleted."""
        lang_dir = self._base / "voice" / "audio" / language
        files = list(FileUtils.scan_mp3_files(lang_dir))
        deleted = sum(1 for f in files if FileUtils.delete_file(f))
        _log.info("Cleared cache for %s: %d files deleted", language, deleted)
        return deleted

    # ── Checksum persistence ──────────────────────────────────────────────────

    def _load_checksums(self) -> dict[str, str]:
        path = self._base / _CHECKSUM_FILE
        data = FileUtils.read_json(path, default={})
        return data if isinstance(data, dict) else {}

    def _save_checksums(self) -> None:
        path = self._base / _CHECKSUM_FILE
        with self._lock:
            data = dict(self._checksums)
        FileUtils.write_json(path, data)
