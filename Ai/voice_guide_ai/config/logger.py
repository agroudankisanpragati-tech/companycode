"""
Voice Guide AI — Production Logger.

Provides:
  • Console handler (coloured, configurable level)
  • Daily-rotating file handler  (voice_guide_ai.log)
  • Separate performance log     (performance.log)
  • ``get_logger(name)``  — standard named logger factory
  • ``perf_logger``       — dedicated performance logger
  • ``log_performance``   — decorator / context-manager for timing
"""

from __future__ import annotations

import functools
import logging
import time
from contextlib import contextmanager
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Callable, Generator, Optional

from config.constants import (
    LOG_BACKUP_COUNT,
    LOG_DATE_FORMAT,
    LOG_FORMAT,
    LOG_FILE_NAME,
    PERF_LOG_FILE_NAME,
)


# ── Internal helpers ───────────────────────────────────────────────────────────

def _resolve_logs_dir() -> Path:
    """Return the logs/ directory, creating it if necessary."""
    # config/logger.py  →  voice_guide_ai/logs/
    logs_dir = Path(__file__).resolve().parent.parent / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def _build_file_handler(log_path: Path, level: int) -> TimedRotatingFileHandler:
    handler = TimedRotatingFileHandler(
        filename=str(log_path),
        when="midnight",
        interval=1,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
        utc=False,
    )
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
    return handler


def _build_console_handler(level: int) -> logging.StreamHandler:
    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT))
    return handler


# ── Logger factory ─────────────────────────────────────────────────────────────

_initialised: bool = False
_log_level: int = logging.INFO


def setup_logging(level: str = "INFO", logs_dir: Optional[Path] = None) -> None:
    """
    Configure the root ``voice_guide_ai`` logger.

    Call once at application startup.  Subsequent calls are no-ops.
    """
    global _initialised, _log_level

    if _initialised:
        return

    numeric_level = getattr(logging, level.upper(), logging.INFO)
    _log_level = numeric_level

    resolved_dir = logs_dir or _resolve_logs_dir()

    root_logger = logging.getLogger("voice_guide_ai")
    root_logger.setLevel(numeric_level)
    root_logger.propagate = False

    if not root_logger.handlers:
        root_logger.addHandler(_build_console_handler(numeric_level))
        root_logger.addHandler(
            _build_file_handler(resolved_dir / LOG_FILE_NAME, numeric_level)
        )

    # Performance logger — always INFO level, separate file
    perf = logging.getLogger("voice_guide_ai.performance")
    perf.setLevel(logging.INFO)
    perf.propagate = False
    if not perf.handlers:
        perf.addHandler(
            _build_file_handler(resolved_dir / PERF_LOG_FILE_NAME, logging.INFO)
        )

    _initialised = True


def get_logger(name: str) -> logging.Logger:
    """
    Return a named child logger under the ``voice_guide_ai`` namespace.

    ``setup_logging()`` is called automatically with defaults if it has
    not been called yet.
    """
    if not _initialised:
        setup_logging()
    return logging.getLogger(f"voice_guide_ai.{name}")


def get_perf_logger() -> logging.Logger:
    """Return the dedicated performance logger."""
    if not _initialised:
        setup_logging()
    return logging.getLogger("voice_guide_ai.performance")


# ── Performance utilities ──────────────────────────────────────────────────────

def log_performance(label: str) -> Callable:
    """
    Decorator that logs the execution time of the wrapped function.

    Usage::

        @log_performance("dialogue_load")
        def load_dialogue(...): ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed = (time.perf_counter() - start) * 1000
                get_perf_logger().info(
                    "PERF | %s | %s | %.2f ms", label, func.__qualname__, elapsed
                )
                return result
            except Exception:
                elapsed = (time.perf_counter() - start) * 1000
                get_perf_logger().warning(
                    "PERF | %s | %s | %.2f ms | EXCEPTION", label, func.__qualname__, elapsed
                )
                raise
        return wrapper
    return decorator


@contextmanager
def perf_block(label: str) -> Generator[None, None, None]:
    """
    Context manager for timing arbitrary code blocks.

    Usage::

        with perf_block("json_load"):
            data = json.load(fh)
    """
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        get_perf_logger().info("PERF | %s | %.2f ms", label, elapsed)
