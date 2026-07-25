"""
Voice Guide AI — Production Runtime Connector.

Single entry point used by the FastAPI bridge and any external caller
to interact with the Voice Guide AI system. Handles:
  * Singleton RuntimeManager lifecycle
  * Thread-safe access
  * Auto-recovery on crash
  * Full page/dialogue/language/replay/offline API
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from config.logger import get_logger, setup_logging
from config.settings import SETTINGS

_log = get_logger("runtime_connector")

_runtime = None
_lock = threading.Lock()


def _get_runtime():
    global _runtime
    with _lock:
        if _runtime is None:
            from runtime.runtime_manager import RuntimeManager
            setup_logging(level=SETTINGS.log_level)
            _runtime = RuntimeManager()
            _runtime.start()
            _log.info("RuntimeManager started via connector.")
    return _runtime


def _safe(fn, *args, fallback=None, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        _log.error("Connector error: %s", exc, exc_info=True)
        return fallback if fallback is not None else {"success": False, "error": str(exc)}


# ── Public API ────────────────────────────────────────────────────────────────

def open_page(page: str, language: Optional[str] = None) -> dict[str, Any]:
    return _safe(_get_runtime().open_page, page, language)


def play(page: str, dialogue_type: str = "welcome",
         language: Optional[str] = None,
         priority: int = 2,
         context: Optional[dict] = None) -> dict[str, Any]:
    return _safe(_get_runtime().play, page, dialogue_type, language, priority, context)


def replay(dialogue_id: Optional[str] = None) -> dict[str, Any]:
    return _safe(_get_runtime().replay, dialogue_id)


def set_language(language: str) -> dict[str, Any]:
    return _safe(_get_runtime().set_language, language)


def set_online(online: bool) -> None:
    _safe(_get_runtime().set_online, online)


def update_conditions(data: dict[str, Any]) -> None:
    _safe(_get_runtime().update_conditions, data)


def get_status() -> dict[str, Any]:
    return _safe(_get_runtime().get_status)


def stop() -> None:
    global _runtime
    with _lock:
        if _runtime is not None:
            try:
                _runtime.stop()
            except Exception as exc:
                _log.warning("Stop error: %s", exc)
            _runtime = None


def restart() -> None:
    stop()
    _get_runtime()
