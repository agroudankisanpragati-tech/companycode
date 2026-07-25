"""
Voice Guide AI — Environment Variable Manager.

Loads the .env file from the module root (if present) and exposes
typed, validated accessors.  Raises ``EnvironmentError`` for any
required variable that is absent.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from config.exceptions import EnvironmentError as VGEnvironmentError


def _load_dotenv(env_path: Path) -> None:
    """Parse a .env file and populate os.environ without overwriting existing vars."""
    if not env_path.exists():
        return
    with open(env_path, encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


class Environment:
    """
    Typed accessor for Voice Guide AI environment variables.

    Call ``Environment.load()`` once at startup.  After that, use the
    class-level properties anywhere in the module.
    """

    _loaded: bool = False

    @classmethod
    def load(cls, env_file: Optional[Path] = None) -> None:
        """Load the .env file.  Safe to call multiple times."""
        if cls._loaded:
            return
        if env_file is None:
            # voice_guide_ai/.env  (sibling of config/)
            env_file = Path(__file__).resolve().parent.parent / ".env"
        _load_dotenv(env_file)
        cls._loaded = True

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _get(key: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
        value = os.environ.get(key, default)
        if required and not value:
            raise VGEnvironmentError(key)
        return value

    @staticmethod
    def _get_bool(key: str, default: bool = False) -> bool:
        raw = os.environ.get(key, str(default)).lower()
        return raw in ("1", "true", "yes", "on")

    @staticmethod
    def _get_int(key: str, default: int = 0) -> int:
        try:
            return int(os.environ.get(key, str(default)))
        except ValueError:
            return default

    # ── Application ───────────────────────────────────────────────────────────

    @classmethod
    def app_env(cls) -> str:
        return cls._get("VOICE_GUIDE_ENV", "production") or "production"

    @classmethod
    def debug(cls) -> bool:
        return cls._get_bool("VOICE_GUIDE_DEBUG", False)

    @classmethod
    def default_language(cls) -> str:
        return cls._get("VOICE_GUIDE_DEFAULT_LANGUAGE", "hi") or "hi"

    @classmethod
    def log_level(cls) -> str:
        return cls._get("VOICE_GUIDE_LOG_LEVEL", "INFO") or "INFO"

    @classmethod
    def max_history(cls) -> int:
        return cls._get_int("VOICE_GUIDE_MAX_HISTORY", 500)

    @classmethod
    def max_replay_count(cls) -> int:
        return cls._get_int("VOICE_GUIDE_MAX_REPLAY", 10)

    @classmethod
    def offline_mode(cls) -> bool:
        return cls._get_bool("VOICE_GUIDE_OFFLINE", False)

    # ── Paths (optional overrides) ────────────────────────────────────────────

    @classmethod
    def custom_dialogues_dir(cls) -> Optional[str]:
        return cls._get("VOICE_GUIDE_DIALOGUES_DIR")

    @classmethod
    def custom_translations_dir(cls) -> Optional[str]:
        return cls._get("VOICE_GUIDE_TRANSLATIONS_DIR")

    @classmethod
    def custom_logs_dir(cls) -> Optional[str]:
        return cls._get("VOICE_GUIDE_LOGS_DIR")
