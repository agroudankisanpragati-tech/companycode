"""
Voice Guide AI — JSON Manager.

Responsibilities
----------------
* Load / write JSON files with UTF-8 enforcement
* Validate required keys
* Detect duplicate dialogue IDs across a directory tree
* Batch-load all JSON files under dialogues/, translations/,
  config/, and avatar/config/
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from config.constants import (
    DIALOGUE_REQUIRED_KEYS,
    TRANSLATION_REQUIRED_KEYS,
    DEFAULT_ENCODING,
)
from config.exceptions import (
    DuplicateIDError,
    FileReadError,
    FileWriteError,
    JSONParseError,
    JSONValidationError,
    PathNotFoundError,
)
from config.logger import get_logger, perf_block
from config.paths import PATHS

_log = get_logger("json_manager")


class JSONManager:
    """
    Thread-safe JSON file manager for the Voice Guide AI module.

    All public methods return structured results and raise typed
    exceptions on failure — never bare built-in exceptions.
    """

    # ── Read ──────────────────────────────────────────────────────────────────

    def read(self, file_path: str | Path) -> dict[str, Any]:
        """
        Read and decode a JSON file.

        Raises
        ------
        PathNotFoundError   — file does not exist
        JSONParseError      — file is not valid JSON or not UTF-8
        FileReadError       — OS-level read failure
        """
        path = Path(file_path)
        if not path.exists():
            raise PathNotFoundError(str(path))

        try:
            with perf_block(f"json_read:{path.name}"):
                # utf-8-sig silently strips the UTF-8 BOM (\xef\xbb\xbf) that
                # Windows editors (Notepad, VS Code "Save with BOM") prepend.
                # Plain UTF-8 files are read identically.
                with open(path, encoding="utf-8-sig", errors="strict") as fh:
                    data: dict[str, Any] = json.load(fh)
            _log.debug("Read JSON: %s", path)
            return data
        except json.JSONDecodeError as exc:
            raise JSONParseError(str(path), str(exc)) from exc
        except UnicodeDecodeError as exc:
            raise JSONParseError(str(path), f"Not valid UTF-8: {exc}") from exc
        except OSError as exc:
            raise FileReadError(str(path), str(exc)) from exc

    def read_safe(self, file_path: str | Path) -> Optional[dict[str, Any]]:
        """Read a JSON file; return None instead of raising on any error."""
        try:
            return self.read(file_path)
        except Exception as exc:  # noqa: BLE001
            _log.warning("read_safe failed for %s: %s", file_path, exc)
            return None

    # ── Write ─────────────────────────────────────────────────────────────────

    def write(self, file_path: str | Path, data: dict[str, Any]) -> None:
        """
        Serialise *data* to *file_path* as pretty-printed UTF-8 JSON.

        Parent directories are created automatically.

        Raises
        ------
        FileWriteError — OS-level write failure
        """
        path = Path(file_path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding=DEFAULT_ENCODING) as fh:
                json.dump(data, fh, indent=4, ensure_ascii=False)
            _log.debug("Wrote JSON: %s", path)
        except OSError as exc:
            raise FileWriteError(str(path), str(exc)) from exc

    # ── Existence ─────────────────────────────────────────────────────────────

    def exists(self, file_path: str | Path) -> bool:
        """Return True if the file exists on disk."""
        return Path(file_path).exists()

    # ── Validation ────────────────────────────────────────────────────────────

    def validate_dialogue(self, data: dict[str, Any], path: str = "") -> bool:
        """
        Validate that *data* contains all required dialogue keys.

        Raises
        ------
        JSONValidationError — one or more required keys are missing
        """
        missing = [k for k in DIALOGUE_REQUIRED_KEYS if k not in data]
        if missing:
            raise JSONValidationError(path, missing)
        return True

    def validate_translation(self, data: dict[str, Any], path: str = "") -> bool:
        """
        Validate that *data* contains all required translation keys.

        Raises
        ------
        JSONValidationError — one or more required keys are missing
        """
        missing = [k for k in TRANSLATION_REQUIRED_KEYS if k not in data]
        if missing:
            raise JSONValidationError(path, missing)
        return True

    def validate_required_keys(
        self,
        data: dict[str, Any],
        required_keys: list[str],
        path: str = "",
    ) -> bool:
        """Generic key-presence validator."""
        missing = [k for k in required_keys if k not in data]
        if missing:
            raise JSONValidationError(path, missing)
        return True

    # ── Duplicate ID detection ────────────────────────────────────────────────

    def find_duplicate_ids(self, directory: str | Path) -> list[str]:
        """
        Scan all JSON files under *directory* and return a list of
        duplicate ``id`` values.

        Raises
        ------
        DuplicateIDError — on the first duplicate found (also logged)
        """
        directory = Path(directory)
        seen: dict[str, str] = {}   # id → first file path
        duplicates: list[str] = []

        for json_file in sorted(directory.rglob("*.json")):
            data = self.read_safe(json_file)
            if data is None:
                continue
            dialogue_id = data.get("id")
            if not dialogue_id:
                continue
            if dialogue_id in seen:
                _log.error(
                    "Duplicate ID '%s' in '%s' (first seen in '%s')",
                    dialogue_id, json_file, seen[dialogue_id],
                )
                duplicates.append(dialogue_id)
                raise DuplicateIDError(dialogue_id, str(json_file))
            seen[dialogue_id] = str(json_file)

        return duplicates

    # ── Batch loaders ─────────────────────────────────────────────────────────

    def load_all_dialogues(self) -> dict[str, dict[str, Any]]:
        """
        Load every JSON file under ``dialogues/``.

        Returns
        -------
        dict mapping  ``"page/dialogue_type"``  →  parsed JSON dict
        """
        return self._load_directory(PATHS.dialogues, validate_fn=None)

    def load_all_translations(self) -> dict[str, dict[str, Any]]:
        """
        Load every JSON file under ``translations/``.

        Returns
        -------
        dict mapping  ``"lang_code/page"``  →  parsed JSON dict
        """
        return self._load_directory(PATHS.translations, validate_fn=None)

    def load_all_configs(self) -> dict[str, dict[str, Any]]:
        """Load every JSON file under ``config/``."""
        return self._load_directory(PATHS.config, validate_fn=None)

    def load_avatar_configs(self) -> dict[str, dict[str, Any]]:
        """Load every JSON file under ``avatar/config/``."""
        return self._load_directory(PATHS.avatar_config, validate_fn=None)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load_directory(
        self,
        directory: Path,
        validate_fn: Any = None,
    ) -> dict[str, dict[str, Any]]:
        """
        Recursively load all ``*.json`` files under *directory*.

        Keys are relative paths without the ``.json`` suffix, using
        forward slashes regardless of OS.
        """
        result: dict[str, dict[str, Any]] = {}

        if not directory.exists():
            _log.warning("Directory does not exist, skipping load: %s", directory)
            return result

        for json_file in sorted(directory.rglob("*.json")):
            relative = json_file.relative_to(directory)
            key = str(relative.with_suffix("")).replace("\\", "/")
            data = self.read_safe(json_file)
            if data is None:
                continue
            if validate_fn is not None:
                try:
                    validate_fn(data, str(json_file))
                except JSONValidationError as exc:
                    _log.warning("Skipping invalid JSON %s: %s", json_file, exc)
                    continue
            result[key] = data

        _log.info("Loaded %d JSON files from %s", len(result), directory)
        return result
