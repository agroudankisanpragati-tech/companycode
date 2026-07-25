"""
Voice Guide AI — Runtime Settings.

``Settings`` is a frozen dataclass that merges values from:
  1. The ``app_config.json`` file (if present)
  2. Environment variables (always take precedence)

Use the module-level singleton ``SETTINGS`` after calling
``Settings.load()`` once at startup.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config.constants import (
    DEFAULT_LANGUAGE,
    FALLBACK_LANGUAGE,
    MAX_HISTORY_ENTRIES,
    MAX_REPLAY_COUNT,
)
from config.environment import Environment
from config.logger import get_logger

_log = get_logger("settings")


@dataclass
class Settings:
    """Immutable runtime configuration for the Voice Guide AI module."""

    # Application
    app_env: str = "production"
    debug: bool = False
    log_level: str = "INFO"

    # Language
    default_language: str = DEFAULT_LANGUAGE
    fallback_language: str = FALLBACK_LANGUAGE

    # Dialogue behaviour
    max_history_entries: int = MAX_HISTORY_ENTRIES
    max_replay_count: int = MAX_REPLAY_COUNT
    offline_mode: bool = False

    # Path overrides (None = use module defaults from Paths)
    custom_dialogues_dir: Optional[str] = None
    custom_translations_dir: Optional[str] = None
    custom_logs_dir: Optional[str] = None

    # Raw extras from app_config.json (non-standard keys)
    extras: dict[str, Any] = field(default_factory=dict)

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "Settings":
        """
        Build a Settings instance by merging app_config.json with env vars.

        Parameters
        ----------
        config_path:
            Explicit path to app_config.json.  Defaults to
            ``voice_guide_ai/config/app_config.json``.
        """
        Environment.load()

        raw: dict[str, Any] = {}

        if config_path is None:
            config_path = Path(__file__).resolve().parent / "app_config.json"

        if config_path.exists():
            try:
                with open(config_path, encoding="utf-8-sig") as fh:
                    raw = json.load(fh)
                _log.debug("Loaded app_config.json from %s", config_path)
            except (json.JSONDecodeError, OSError) as exc:
                _log.warning("Could not read app_config.json (%s); using defaults.", exc)

        # Environment variables always win
        instance = cls(
            app_env=Environment.app_env(),
            debug=Environment.debug(),
            log_level=Environment.log_level(),
            default_language=Environment.default_language(),
            fallback_language=raw.get("fallback_language", FALLBACK_LANGUAGE),
            max_history_entries=Environment.max_history(),
            max_replay_count=Environment.max_replay_count(),
            offline_mode=Environment.offline_mode(),
            custom_dialogues_dir=Environment.custom_dialogues_dir()
                or raw.get("dialogues_dir"),
            custom_translations_dir=Environment.custom_translations_dir()
                or raw.get("translations_dir"),
            custom_logs_dir=Environment.custom_logs_dir()
                or raw.get("logs_dir"),
            extras={
                k: v for k, v in raw.items()
                if k not in {
                    "fallback_language", "dialogues_dir",
                    "translations_dir", "logs_dir",
                }
            },
        )

        _log.info(
            "Settings loaded | env=%s debug=%s lang=%s",
            instance.app_env, instance.debug, instance.default_language,
        )
        return instance

    def is_production(self) -> bool:
        return self.app_env == "production"

    def is_development(self) -> bool:
        return self.app_env in ("development", "dev")


# Module-level singleton — populated on first import via load().
SETTINGS: Settings = Settings.load()
