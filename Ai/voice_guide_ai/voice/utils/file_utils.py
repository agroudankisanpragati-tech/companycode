"""
Voice Guide AI — Voice Engine File Utilities.

Filesystem helpers for the voice engine:
  * Path resolution for audio files
  * Directory creation
  * Safe file read / write
  * File existence and size checks
  * Atomic write (write-then-rename)
  * Directory scanning for audio files
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Iterator

from config.logger import get_logger

_log = get_logger("voice.utils.file_utils")


class FileUtils:
    """Stateless filesystem utility helpers for the voice engine."""

    @staticmethod
    def ensure_dir(path: Path) -> Path:
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def ensure_parent(path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def exists(path: Path) -> bool:
        return path.is_file()

    @staticmethod
    def file_size(path: Path) -> int:
        try:
            return path.stat().st_size
        except OSError:
            return 0

    @staticmethod
    def is_non_empty(path: Path) -> bool:
        return FileUtils.exists(path) and FileUtils.file_size(path) > 0

    @staticmethod
    def read_json(path: Path, default: Any = None) -> Any:
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except FileNotFoundError:
            _log.debug("JSON file not found: %s", path)
            return default
        except json.JSONDecodeError as exc:
            _log.warning("JSON parse error in %s: %s", path, exc)
            return default
        except OSError as exc:
            _log.warning("Cannot read %s: %s", path, exc)
            return default

    @staticmethod
    def write_json(path: Path, data: Any, indent: int = 2) -> bool:
        FileUtils.ensure_parent(path)
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=path.parent, prefix=".tmp_", suffix=".json"
            )
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=indent)
                shutil.move(tmp_path, str(path))
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
            return True
        except OSError as exc:
            _log.error("Cannot write JSON to %s: %s", path, exc)
            return False

    @staticmethod
    def read_bytes(path: Path) -> bytes | None:
        try:
            return path.read_bytes()
        except OSError as exc:
            _log.warning("Cannot read bytes from %s: %s", path, exc)
            return None

    @staticmethod
    def write_bytes(path: Path, data: bytes) -> bool:
        FileUtils.ensure_parent(path)
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=path.parent, prefix=".tmp_", suffix=".bin"
            )
            try:
                with os.fdopen(fd, "wb") as fh:
                    fh.write(data)
                shutil.move(tmp_path, str(path))
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
            return True
        except OSError as exc:
            _log.error("Cannot write bytes to %s: %s", path, exc)
            return False

    @staticmethod
    def scan_mp3_files(directory: Path) -> Iterator[Path]:
        if not directory.is_dir():
            return
        yield from directory.rglob("*.mp3")

    @staticmethod
    def list_audio_files(directory: Path) -> list[Path]:
        return sorted(FileUtils.scan_mp3_files(directory))

    @staticmethod
    def delete_file(path: Path) -> bool:
        try:
            path.unlink(missing_ok=True)
            return True
        except OSError as exc:
            _log.warning("Cannot delete %s: %s", path, exc)
            return False

    @staticmethod
    def copy_file(src: Path, dst: Path) -> bool:
        FileUtils.ensure_parent(dst)
        try:
            shutil.copy2(str(src), str(dst))
            return True
        except OSError as exc:
            _log.warning("Cannot copy %s -> %s: %s", src, dst, exc)
            return False
