# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: logger.py
# Purpose: Provides a single, reusable logger for the entire AI module.
#          Writes colored output to the console and rotating log files.
#          Every other module calls get_logger(__name__) — nothing else.
# =============================================================================

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from constants import (
    LOG_BACKUP_COUNT,
    LOG_DATE_FORMAT,
    LOG_MAX_BYTES,
    DEFAULT_LOG_LEVEL,
)

# Resolve log directory relative to this file — no imports from config.py
# to avoid circular imports (config.py imports constants.py, logger.py
# must not import config.py).
_AI_ROOT = Path(__file__).parent.resolve()
_LOG_DIR = _AI_ROOT / "logs"


def _ensure_log_dirs() -> None:
    """Creates log subdirectories if they don't exist yet."""
    (_LOG_DIR / "training").mkdir(parents=True, exist_ok=True)
    (_LOG_DIR / "inference").mkdir(parents=True, exist_ok=True)


def get_logger(
    name: str,
    log_file: str | Path | None = None,
    level: str = DEFAULT_LOG_LEVEL,
) -> logging.Logger:
    """
    Returns a configured logger instance.

    Args:
        name:     Logger name — always pass __name__ from the calling module.
        log_file: Optional path to a .log file. If None, logs to console only.
                  Relative paths are resolved inside logs/training/.
        level:    Log level string — "DEBUG", "INFO", "WARNING", "ERROR".

    Returns:
        logging.Logger: Ready-to-use logger.

    Usage:
        from logger import get_logger
        log = get_logger(__name__)
        log.info("Training started")
        log.warning("Low disk space")
        log.error("File not found: %s", path)
    """
    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers if logger was already configured
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt=LOG_DATE_FORMAT,
    )

    # --- Console handler (always added) ---
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    # --- Rotating file handler (only if log_file is specified) ---
    if log_file is not None:
        _ensure_log_dirs()
        log_path = Path(log_file)
        if not log_path.is_absolute():
            log_path = _LOG_DIR / "training" / log_path
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = RotatingFileHandler(
            filename=log_path,
            maxBytes=LOG_MAX_BYTES,
            backupCount=LOG_BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)

    # Prevent log records from propagating to the root logger
    logger.propagate = False

    return logger


# Module-level default logger — used by scripts that don't need a named logger
log = get_logger("akp.ai")
