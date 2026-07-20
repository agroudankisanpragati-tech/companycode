# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/config.py
# Purpose: All paths, constants, and runtime configuration for the
#          Pragati AI Controller. Every path is derived from this file's
#          location — no hardcoded absolute paths anywhere.
# =============================================================================

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# ROOT RESOLUTION
# PAC_ROOT → Ai/pragati_ai_controller/
# AI_ROOT  → Ai/
# ---------------------------------------------------------------------------
PAC_ROOT: Path = Path(__file__).parent.resolve()
AI_ROOT:  Path = PAC_ROOT.parent.resolve()

# ---------------------------------------------------------------------------
# CONTROLLER VERSION
# ---------------------------------------------------------------------------
CONTROLLER_VERSION: str = "1.0.0"

# ---------------------------------------------------------------------------
# INPUT TYPE CONSTANTS
# ---------------------------------------------------------------------------
INPUT_TYPE_TEXT:  str = "text"
INPUT_TYPE_VOICE: str = "voice"
INPUT_TYPE_IMAGE: str = "image"

SUPPORTED_INPUT_TYPES: frozenset[str] = frozenset(
    {INPUT_TYPE_TEXT, INPUT_TYPE_VOICE, INPUT_TYPE_IMAGE}
)

# ---------------------------------------------------------------------------
# SUPPORTED AUDIO EXTENSIONS (mirrors speech_to_text)
# ---------------------------------------------------------------------------
SUPPORTED_AUDIO_EXTENSIONS: frozenset[str] = frozenset(
    {".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus"}
)

# ---------------------------------------------------------------------------
# SUPPORTED IMAGE EXTENSIONS
# ---------------------------------------------------------------------------
SUPPORTED_IMAGE_EXTENSIONS: frozenset[str] = frozenset(
    {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}
)

# ---------------------------------------------------------------------------
# LANGUAGE CONSTANTS
# ---------------------------------------------------------------------------
LANG_HINDI:   str = "hi"
LANG_ENGLISH: str = "en"
DEFAULT_LANGUAGE: str = LANG_HINDI

SUPPORTED_LANGUAGES: tuple[str, ...] = (
    "hi",   # Hindi
    "en",   # English
    "raj",  # Rajasthani (future)
    "mr",   # Marwari (future)
    "mew",  # Mewari (future)
)

# Script hint → BCP-47 language code mapping
SCRIPT_LANGUAGE_MAP: dict[str, str] = {
    "devanagari": "hi",
    "latin":      "en",
    "mixed":      "hi",   # default mixed to Hindi
}

# ---------------------------------------------------------------------------
# MEMORY CONSTANTS
# ---------------------------------------------------------------------------
SHORT_TERM_MEMORY_LIMIT: int  = 20    # max turns kept in short-term memory
LONG_TERM_MEMORY_LIMIT:  int  = 200   # max turns persisted per session
SESSION_TIMEOUT_SECONDS: int  = 1800  # 30 minutes idle → new session

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
DEFAULT_LOG_LEVEL:  str = "INFO"
LOG_MAX_BYTES:      int = 10 * 1024 * 1024   # 10 MB
LOG_BACKUP_COUNT:   int = 5

# ---------------------------------------------------------------------------
# PERFORMANCE
# ---------------------------------------------------------------------------
MAX_RESPONSE_WAIT_SECONDS: float = 30.0   # hard timeout per pipeline call


# ---------------------------------------------------------------------------
# CONFIGURATION DATACLASS
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class PragatiAIConfig:
    """
    Immutable runtime configuration for the Pragati AI Controller.

    All paths are absolute and derived from PAC_ROOT.
    Env-var overrides are applied at construction time.

    Usage:
        from pragati_ai_controller.config import get_config
        cfg = get_config()
    """
    pac_root: Path
    ai_root:  Path

    logs_dir:    Path
    outputs_dir: Path
    configs_dir: Path
    memory_dir:  Path   # persistent long-term memory storage

    # Versioning
    controller_version: str

    # Input handling
    supported_input_types:      frozenset[str]
    supported_audio_extensions: frozenset[str]
    supported_image_extensions: frozenset[str]

    # Language
    default_language:    str
    supported_languages: tuple[str, ...]
    script_language_map: dict[str, str]

    # Memory
    short_term_memory_limit: int
    long_term_memory_limit:  int
    session_timeout_seconds: int

    # Performance
    max_response_wait_seconds: float

    # Logging
    log_level: str


# ---------------------------------------------------------------------------
# DIRECTORY BOOTSTRAP
# ---------------------------------------------------------------------------
def _ensure_dirs(cfg: PragatiAIConfig) -> None:
    for directory in (
        cfg.logs_dir,
        cfg.outputs_dir,
        cfg.configs_dir,
        cfg.memory_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# CONFIG FACTORY
# ---------------------------------------------------------------------------
_instance: Optional[PragatiAIConfig] = None


def get_config(force_rebuild: bool = False) -> PragatiAIConfig:
    """
    Returns the singleton PragatiAIConfig.
    Builds once on first call; cached for all subsequent calls.
    Auto-creates all required directories on first build.

    Args:
        force_rebuild: Rebuild from scratch (useful in tests).

    Returns:
        PragatiAIConfig: Immutable runtime configuration object.
    """
    global _instance

    if _instance is not None and not force_rebuild:
        return _instance

    _instance = PragatiAIConfig(
        pac_root = PAC_ROOT,
        ai_root  = AI_ROOT,
        logs_dir    = PAC_ROOT / "logs",
        outputs_dir = PAC_ROOT / "outputs",
        configs_dir = PAC_ROOT / "configs",
        memory_dir  = PAC_ROOT / "outputs" / "memory",
        controller_version       = CONTROLLER_VERSION,
        supported_input_types    = SUPPORTED_INPUT_TYPES,
        supported_audio_extensions = SUPPORTED_AUDIO_EXTENSIONS,
        supported_image_extensions = SUPPORTED_IMAGE_EXTENSIONS,
        default_language         = os.getenv("PAC_DEFAULT_LANGUAGE", DEFAULT_LANGUAGE),
        supported_languages      = SUPPORTED_LANGUAGES,
        script_language_map      = SCRIPT_LANGUAGE_MAP,
        short_term_memory_limit  = int(os.getenv("PAC_STM_LIMIT",  SHORT_TERM_MEMORY_LIMIT)),
        long_term_memory_limit   = int(os.getenv("PAC_LTM_LIMIT",  LONG_TERM_MEMORY_LIMIT)),
        session_timeout_seconds  = int(os.getenv("PAC_SESSION_TIMEOUT", SESSION_TIMEOUT_SECONDS)),
        max_response_wait_seconds = float(os.getenv("PAC_MAX_WAIT", MAX_RESPONSE_WAIT_SECONDS)),
        log_level = os.getenv("PAC_LOG_LEVEL", DEFAULT_LOG_LEVEL),
    )

    _ensure_dirs(_instance)
    return _instance


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cfg = get_config()
    print("\n" + "=" * 60)
    print("  AKP Pragati AI Controller — Configuration Diagnostic")
    print("=" * 60)
    print(f"\n  PAC Root     : {cfg.pac_root}")
    print(f"  AI Root      : {cfg.ai_root}")
    print(f"  Logs Dir     : {cfg.logs_dir}")
    print(f"  Memory Dir   : {cfg.memory_dir}")
    print(f"\n  Version      : {cfg.controller_version}")
    print(f"  Default Lang : {cfg.default_language}")
    print(f"  STM Limit    : {cfg.short_term_memory_limit}")
    print(f"  LTM Limit    : {cfg.long_term_memory_limit}")
    print(f"  Session TTL  : {cfg.session_timeout_seconds}s")
    print("\n" + "=" * 60 + "\n")
