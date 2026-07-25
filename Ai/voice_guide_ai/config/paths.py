"""
Voice Guide AI — Centralised Path Registry.

All filesystem paths are derived from the module root (the directory
that contains this file's parent package).  Nothing outside this
module should construct paths manually.
"""

from __future__ import annotations

from pathlib import Path

from config.constants import (
    AVATAR_CONFIG_DIR,
    CONFIG_DIR,
    DIALOGUES_DIR,
    LOGS_DIR,
    TRANSLATIONS_DIR,
    VOICE_DIR,
    LOG_FILE_NAME,
    PERF_LOG_FILE_NAME,
)


def _module_root() -> Path:
    """Return the absolute path to the voice_guide_ai package root."""
    # This file lives at  voice_guide_ai/config/paths.py
    # So __file__.parent.parent  ==  voice_guide_ai/
    return Path(__file__).resolve().parent.parent


class Paths:
    """
    Immutable path registry for the Voice Guide AI module.

    All attributes are resolved absolute Path objects.
    Instantiate once and share the instance (or use the module-level
    singleton ``PATHS``).
    """

    def __init__(self) -> None:
        self._root: Path = _module_root()

    # ── Root ──────────────────────────────────────────────────────────────────

    @property
    def root(self) -> Path:
        """voice_guide_ai/ package root."""
        return self._root

    # ── Core data directories ─────────────────────────────────────────────────

    @property
    def dialogues(self) -> Path:
        return self._root / DIALOGUES_DIR

    @property
    def translations(self) -> Path:
        return self._root / TRANSLATIONS_DIR

    @property
    def config(self) -> Path:
        return self._root / CONFIG_DIR

    @property
    def avatar_config(self) -> Path:
        return self._root / AVATAR_CONFIG_DIR

    @property
    def voice(self) -> Path:
        return self._root / VOICE_DIR

    @property
    def logs(self) -> Path:
        return self._root / LOGS_DIR

    # ── Log files ─────────────────────────────────────────────────────────────

    @property
    def log_file(self) -> Path:
        return self.logs / LOG_FILE_NAME

    @property
    def perf_log_file(self) -> Path:
        return self.logs / PERF_LOG_FILE_NAME

    # ── Config JSON files ─────────────────────────────────────────────────────

    @property
    def app_config_json(self) -> Path:
        return self.config / "app_config.json"

    @property
    def language_config_json(self) -> Path:
        return self.config / "language_config.json"

    @property
    def voice_config_json(self) -> Path:
        return self.config / "voice_config.json"

    @property
    def avatar_config_json(self) -> Path:
        return self.avatar_config / "avatar.json"

    # ── Helpers ───────────────────────────────────────────────────────────────

    def dialogue_path(self, page: str, dialogue_type: str) -> Path:
        """Return the absolute path for a specific dialogue JSON file."""
        return self.dialogues / page / f"{dialogue_type}.json"

    def translation_path(self, language_code: str, page: str) -> Path:
        """Return the absolute path for a specific translation JSON file."""
        return self.translations / language_code / f"{page}.json"

    def voice_audio_path(self, language_code: str, page: str, dialogue_id: str) -> Path:
        """Return the expected audio file path for a dialogue."""
        return self.voice / "audio" / language_code / page / f"{dialogue_id}.mp3"

    def ensure_logs_dir(self) -> Path:
        """Create the logs directory if it does not exist and return its path."""
        self.logs.mkdir(parents=True, exist_ok=True)
        return self.logs

    def __repr__(self) -> str:
        return f"Paths(root={self._root!r})"


# Module-level singleton — import and use directly.
PATHS: Paths = Paths()
