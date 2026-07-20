# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/config.py
# Purpose: All paths, constants, and runtime configuration for the
#          Speech-to-Text module. Every path is derived from this file's
#          location — no hardcoded absolute paths anywhere.
# =============================================================================

from __future__ import annotations

import os
import platform
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# ROOT RESOLUTION
# STT_ROOT  → Ai/speech_to_text/
# AI_ROOT   → Ai/
# ---------------------------------------------------------------------------
STT_ROOT: Path = Path(__file__).parent.resolve()
AI_ROOT: Path = STT_ROOT.parent.resolve()

# ---------------------------------------------------------------------------
# SUPPORTED FASTER-WHISPER MODEL SIZES
# ---------------------------------------------------------------------------
SUPPORTED_MODELS: tuple[str, ...] = (
    "tiny",
    "base",
    "small",
    "medium",
    "large-v3",
)

DEFAULT_MODEL: str = "base"

MODEL_REPO_IDS: dict[str, str] = {
    "tiny":     "Systran/faster-whisper-tiny",
    "base":     "Systran/faster-whisper-base",
    "small":    "Systran/faster-whisper-small",
    "medium":   "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}

# ---------------------------------------------------------------------------
# SUPPORTED AUDIO EXTENSIONS
# ---------------------------------------------------------------------------
SUPPORTED_AUDIO_EXTENSIONS: frozenset[str] = frozenset(
    {".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus"}
)

# ---------------------------------------------------------------------------
# LOGGING CONSTANTS
# ---------------------------------------------------------------------------
STT_LOG_DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"
STT_LOG_MAX_BYTES: int = 10 * 1024 * 1024
STT_LOG_BACKUP_COUNT: int = 5
DEFAULT_LOG_LEVEL: str = "INFO"


# ---------------------------------------------------------------------------
# DEVICE DETECTION
# ---------------------------------------------------------------------------
def _detect_device() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def _detect_compute_type(device: str) -> str:
    if device == "cuda":
        return "float16"
    return "int8"


# ---------------------------------------------------------------------------
# CONFIGURATION DATACLASS
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class STTConfig:
    """
    Complete runtime configuration for the Speech-to-Text module.
    All paths are absolute and derived from STT_ROOT.
    """
    stt_root: Path
    ai_root: Path
    models_dir: Path
    cache_dir: Path
    outputs_dir: Path
    logs_dir: Path
    configs_dir: Path
    device: str
    compute_type: str
    default_model: str
    supported_models: tuple[str, ...]
    model_repo_ids: dict[str, str]
    log_level: str

    def model_path(self, model_size: str) -> Path:
        return self.models_dir / model_size

    def is_model_downloaded(self, model_size: str) -> bool:
        path = self.model_path(model_size)
        return path.exists() and any(path.iterdir())


# ---------------------------------------------------------------------------
# FOLDER BOOTSTRAP
# ---------------------------------------------------------------------------
def _ensure_dirs(cfg: STTConfig) -> None:
    for directory in (
        cfg.models_dir,
        cfg.cache_dir,
        cfg.outputs_dir,
        cfg.logs_dir,
        cfg.configs_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# CONFIG FACTORY
# ---------------------------------------------------------------------------
_instance: Optional[STTConfig] = None


def get_config(force_rebuild: bool = False) -> STTConfig:
    """
    Returns the singleton STTConfig instance.
    Builds once on first call; cached for all subsequent calls.
    """
    global _instance

    if _instance is not None and not force_rebuild:
        return _instance

    device = _detect_device()
    compute_type = _detect_compute_type(device)
    models_base = STT_ROOT / "models"

    _instance = STTConfig(
        stt_root=STT_ROOT,
        ai_root=AI_ROOT,
        models_dir=models_base / "faster_whisper",
        cache_dir=models_base / "cache",
        outputs_dir=STT_ROOT / "outputs",
        logs_dir=STT_ROOT / "logs",          # Fixed: use STT's own logs dir
        configs_dir=STT_ROOT / "configs",
        device=device,
        compute_type=os.getenv("STT_COMPUTE_TYPE", compute_type),
        default_model=os.getenv("STT_DEFAULT_MODEL", DEFAULT_MODEL),
        supported_models=SUPPORTED_MODELS,
        model_repo_ids=MODEL_REPO_IDS,
        log_level=os.getenv("STT_LOG_LEVEL", DEFAULT_LOG_LEVEL),
    )

    _ensure_dirs(_instance)
    return _instance


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cfg = get_config()
    print("\n" + "=" * 60)
    print("  AKP STT Module — Configuration Diagnostic")
    print("=" * 60)
    print(f"\n  Device       : {cfg.device.upper()}")
    print(f"  Compute Type : {cfg.compute_type}")
    print(f"  Default Model: {cfg.default_model}")
    print(f"  STT Root     : {cfg.stt_root}")
    print(f"  Models Dir   : {cfg.models_dir}")
    print(f"  Cache Dir    : {cfg.cache_dir}")
    print(f"  Logs Dir     : {cfg.logs_dir}")
    print(f"\n  Supported Models:")
    for m in cfg.supported_models:
        status = "downloaded" if cfg.is_model_downloaded(m) else "not downloaded"
        print(f"    {m:<12} — {status}")
    print("\n" + "=" * 60 + "\n")
