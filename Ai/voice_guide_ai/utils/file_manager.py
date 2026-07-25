"""
Voice Guide AI — File Manager.

Provides safe, typed wrappers around common filesystem operations:
create, read, write, delete, copy, move, list, and existence checks.
All methods raise typed exceptions from ``config.exceptions``.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from config.exceptions import (
    FileReadError,
    FileWriteError,
    PathNotFoundError,
)
from config.constants import DEFAULT_ENCODING
from config.logger import get_logger

_log = get_logger("file_manager")


class FileManager:
    """
    Reusable filesystem utility for the Voice Guide AI module.

    Every method is fully implemented, handles exceptions internally,
    and returns a structured result or raises a typed exception.
    """

    # ── Existence ─────────────────────────────────────────────────────────────

    def exists(self, path: str | Path) -> bool:
        """Return True if *path* exists (file or directory)."""
        return Path(path).exists()

    def is_file(self, path: str | Path) -> bool:
        return Path(path).is_file()

    def is_dir(self, path: str | Path) -> bool:
        return Path(path).is_dir()

    # ── Directory operations ──────────────────────────────────────────────────

    def create_folder(self, path: str | Path, parents: bool = True) -> Path:
        """
        Create a directory (and parents if *parents* is True).

        Returns the resolved Path.

        Raises
        ------
        FileWriteError — OS-level failure
        """
        resolved = Path(path)
        try:
            resolved.mkdir(parents=parents, exist_ok=True)
            _log.debug("Created folder: %s", resolved)
            return resolved
        except OSError as exc:
            raise FileWriteError(str(resolved), str(exc)) from exc

    def list_files(
        self,
        directory: str | Path,
        pattern: str = "*",
        recursive: bool = False,
    ) -> list[Path]:
        """
        List files in *directory* matching *pattern*.

        Parameters
        ----------
        directory : directory to search
        pattern   : glob pattern (default ``"*"``)
        recursive : if True, search recursively with ``rglob``

        Raises
        ------
        PathNotFoundError — directory does not exist
        """
        resolved = Path(directory)
        if not resolved.exists():
            raise PathNotFoundError(str(resolved))
        if recursive:
            return sorted(p for p in resolved.rglob(pattern) if p.is_file())
        return sorted(p for p in resolved.glob(pattern) if p.is_file())

    def list_dirs(self, directory: str | Path) -> list[Path]:
        """Return immediate subdirectories of *directory*."""
        resolved = Path(directory)
        if not resolved.exists():
            raise PathNotFoundError(str(resolved))
        return sorted(p for p in resolved.iterdir() if p.is_dir())

    # ── File read / write ─────────────────────────────────────────────────────

    def read_text(self, path: str | Path) -> str:
        """
        Read a text file and return its contents as a string.

        Raises
        ------
        PathNotFoundError — file does not exist
        FileReadError     — OS or encoding failure
        """
        resolved = Path(path)
        if not resolved.exists():
            raise PathNotFoundError(str(resolved))
        try:
            return resolved.read_text(encoding=DEFAULT_ENCODING)
        except OSError as exc:
            raise FileReadError(str(resolved), str(exc)) from exc

    def write_text(self, path: str | Path, content: str) -> Path:
        """
        Write *content* to *path* as UTF-8 text.

        Parent directories are created automatically.

        Raises
        ------
        FileWriteError — OS-level failure
        """
        resolved = Path(path)
        try:
            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_text(content, encoding=DEFAULT_ENCODING)
            _log.debug("Wrote text file: %s", resolved)
            return resolved
        except OSError as exc:
            raise FileWriteError(str(resolved), str(exc)) from exc

    def create_file(self, path: str | Path, content: str = "") -> Path:
        """
        Create a file at *path* with optional *content*.

        Does not overwrite an existing file.

        Raises
        ------
        FileWriteError — file already exists or OS failure
        """
        resolved = Path(path)
        if resolved.exists():
            raise FileWriteError(str(resolved), "File already exists.")
        return self.write_text(resolved, content)

    # ── Copy / Move / Delete ──────────────────────────────────────────────────

    def copy(self, src: str | Path, dst: str | Path) -> Path:
        """
        Copy *src* to *dst*.  If *dst* is a directory, the file is
        placed inside it.

        Raises
        ------
        PathNotFoundError — source does not exist
        FileWriteError    — copy failure
        """
        src_path = Path(src)
        dst_path = Path(dst)
        if not src_path.exists():
            raise PathNotFoundError(str(src_path))
        try:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            result = Path(shutil.copy2(str(src_path), str(dst_path)))
            _log.debug("Copied %s → %s", src_path, result)
            return result
        except OSError as exc:
            raise FileWriteError(str(dst_path), str(exc)) from exc

    def move(self, src: str | Path, dst: str | Path) -> Path:
        """
        Move *src* to *dst*.

        Raises
        ------
        PathNotFoundError — source does not exist
        FileWriteError    — move failure
        """
        src_path = Path(src)
        dst_path = Path(dst)
        if not src_path.exists():
            raise PathNotFoundError(str(src_path))
        try:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            result = Path(shutil.move(str(src_path), str(dst_path)))
            _log.debug("Moved %s → %s", src_path, result)
            return result
        except OSError as exc:
            raise FileWriteError(str(dst_path), str(exc)) from exc

    def delete(self, path: str | Path, missing_ok: bool = True) -> bool:
        """
        Delete a file or directory tree.

        Parameters
        ----------
        path       : target to delete
        missing_ok : if True, silently return False when path is absent

        Returns True if deleted, False if not found and missing_ok=True.

        Raises
        ------
        PathNotFoundError — path absent and missing_ok=False
        FileWriteError    — OS-level failure
        """
        resolved = Path(path)
        if not resolved.exists():
            if missing_ok:
                return False
            raise PathNotFoundError(str(resolved))
        try:
            if resolved.is_dir():
                shutil.rmtree(str(resolved))
            else:
                resolved.unlink()
            _log.debug("Deleted: %s", resolved)
            return True
        except OSError as exc:
            raise FileWriteError(str(resolved), str(exc)) from exc

    # ── Metadata ──────────────────────────────────────────────────────────────

    def size_bytes(self, path: str | Path) -> int:
        """Return file size in bytes."""
        resolved = Path(path)
        if not resolved.exists():
            raise PathNotFoundError(str(resolved))
        return resolved.stat().st_size

    def extension(self, path: str | Path) -> str:
        """Return the file extension (e.g. ``.json``)."""
        return Path(path).suffix

    def stem(self, path: str | Path) -> str:
        """Return the filename without extension."""
        return Path(path).stem

    def ensure_dir(self, path: str | Path) -> Path:
        """Ensure *path* exists as a directory; create it if needed."""
        return self.create_folder(path)

    def resolve(self, path: str | Path) -> Path:
        """Return the absolute, resolved Path."""
        return Path(path).resolve()

    def relative_to(self, path: str | Path, base: str | Path) -> Optional[Path]:
        """Return *path* relative to *base*, or None if not relative."""
        try:
            return Path(path).relative_to(Path(base))
        except ValueError:
            return None
