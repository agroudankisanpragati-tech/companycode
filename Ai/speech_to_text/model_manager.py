# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/model_manager.py
# Purpose: Downloads, validates, and loads Faster-Whisper models.
#          Models are stored in speech_to_text/models/faster_whisper/<size>/
#          Temporary download cache lives in speech_to_text/models/cache/
#          All paths are project-relative via STTConfig.
# =============================================================================

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from speech_to_text.config import STTConfig, get_config


# =============================================================================
# MODULE LOGGER
# =============================================================================

def _build_logger(cfg: STTConfig) -> logging.Logger:
    """
    Returns a named logger for the model manager.
    Writes to console + rotating file in the shared Ai/logs/ directory.
    Idempotent — safe to call multiple times.
    """
    logger = logging.getLogger("akp.stt.model_manager")
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    log_file = cfg.logs_dir / "stt_model_manager.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger


# =============================================================================
# MODEL MANAGER
# =============================================================================

class ModelManager:
    """
    Manages Faster-Whisper model lifecycle:
      - Validates requested model size against supported list
      - Downloads model from Hugging Face if not already cached locally
      - Loads and returns a WhisperModel instance
      - Caches loaded models in memory to avoid redundant disk I/O

    Usage:
        manager = ModelManager()
        model = manager.load("base")
        segments, info = model.transcribe("audio.wav")
    """

    def __init__(self, cfg: Optional[STTConfig] = None) -> None:
        self._cfg: STTConfig = cfg or get_config()
        self._log: logging.Logger = _build_logger(self._cfg)
        self._loaded: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def load(self, model_size: Optional[str] = None):
        """
        Returns a loaded WhisperModel for the given size.
        Downloads the model first if it is not present locally.

        Args:
            model_size: One of 'tiny', 'base', 'small', 'medium', 'large-v3'.
                        Defaults to STTConfig.default_model.

        Returns:
            WhisperModel: Ready-to-use transcription model.

        Raises:
            ValueError: If model_size is not in SUPPORTED_MODELS.
            RuntimeError: If the model fails to download or load.
        """
        size = model_size or self._cfg.default_model
        self._validate_model_size(size)

        if size in self._loaded:
            self._log.debug("Model '%s' already loaded — returning cached instance.", size)
            return self._loaded[size]

        model_path = self._cfg.model_path(size)

        if self._cfg.is_model_downloaded(size):
            self._log.info("Loading model '%s' from local path: %s", size, model_path)
        else:
            self._log.info(
                "Model '%s' not found locally. Downloading from Hugging Face...", size
            )
            self._download(size, model_path)

        model = self._load_from_disk(size, model_path)
        self._loaded[size] = model
        return model

    def is_available(self, model_size: str) -> bool:
        """Returns True if the model is downloaded and ready to load."""
        self._validate_model_size(model_size)
        return self._cfg.is_model_downloaded(model_size)

    def unload(self, model_size: str) -> None:
        """Removes a loaded model from the in-memory cache."""
        if model_size in self._loaded:
            del self._loaded[model_size]
            self._log.info("Model '%s' unloaded from memory.", model_size)

    def unload_all(self) -> None:
        """Clears all in-memory model instances."""
        self._loaded.clear()
        self._log.info("All STT models unloaded from memory.")

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _validate_model_size(self, model_size: str) -> None:
        """Raises ValueError if model_size is not in the supported list."""
        if model_size not in self._cfg.supported_models:
            raise ValueError(
                f"Unsupported model size '{model_size}'. "
                f"Choose from: {list(self._cfg.supported_models)}"
            )

    def _download(self, size: str, target_dir: Path) -> None:
        """
        Downloads the model from Hugging Face Hub into target_dir.
        Uses the cache_dir as the HF download cache to avoid re-downloads.

        Raises:
            RuntimeError: If the download fails for any reason.
        """
        try:
            from huggingface_hub import snapshot_download

            repo_id = self._cfg.model_repo_ids[size]
            self._log.info(
                "Downloading '%s' (repo: %s) → %s", size, repo_id, target_dir
            )

            target_dir.mkdir(parents=True, exist_ok=True)

            snapshot_download(
                repo_id=repo_id,
                local_dir=str(target_dir),
                cache_dir=str(self._cfg.cache_dir),
                local_dir_use_symlinks=False,
            )

            self._log.info("Model '%s' downloaded successfully.", size)

        except Exception as exc:
            raise RuntimeError(
                f"Failed to download Faster-Whisper model '{size}': {exc}"
            ) from exc

    def _load_from_disk(self, size: str, model_path: Path):
        """
        Instantiates a WhisperModel from the local model directory.

        Raises:
            RuntimeError: If the model cannot be loaded.
        """
        try:
            from faster_whisper import WhisperModel
            self._log.info(
                "Initialising WhisperModel '%s' | device=%s | compute_type=%s",
                size,
                self._cfg.device,
                self._cfg.compute_type,
            )
            model = WhisperModel(
                model_size_or_path=str(model_path),
                device=self._cfg.device,
                compute_type=self._cfg.compute_type,
            )
            self._log.info("Model '%s' loaded and ready.", size)
            return model

        except Exception as exc:
            raise RuntimeError(
                f"Failed to load Faster-Whisper model '{size}' from {model_path}: {exc}"
            ) from exc


# =============================================================================
# MODULE-LEVEL SINGLETON
# =============================================================================

_manager_instance: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """
    Returns the module-level singleton ModelManager.
    Instantiated once; reused for the lifetime of the process.

    Usage:
        from speech_to_text.model_manager import get_model_manager
        manager = get_model_manager()
        model = manager.load("base")
    """
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ModelManager()
    return _manager_instance


# =============================================================================
# SELF-TEST
# =============================================================================
if __name__ == "__main__":
    manager = get_model_manager()
    cfg = manager._cfg

    print("\n" + "=" * 60)
    print("  AKP STT — Model Manager Diagnostic")
    print("=" * 60)
    print(f"\n  Device       : {cfg.device.upper()}")
    print(f"  Compute Type : {cfg.compute_type}")
    print(f"  Models Dir   : {cfg.models_dir}")
    print(f"\n  Model Status:")
    for m in cfg.supported_models:
        status = "ready" if manager.is_available(m) else "not downloaded"
        print(f"    {m:<12} — {status}")
    print("\n" + "=" * 60 + "\n")
