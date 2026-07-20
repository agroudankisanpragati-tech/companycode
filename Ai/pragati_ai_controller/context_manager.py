# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/context_manager.py
# Purpose: Maintains per-session user context for the Pragati AI Controller.
#          Stores farmer profile, location, active crop, language preference,
#          and arbitrary key-value context. Thread-safe. Singleton.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
from copy import deepcopy
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from pragati_ai_controller.config import PragatiAIConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.context")
    if logger.handlers:
        return logger
    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    fh = RotatingFileHandler(
        filename=cfg.logs_dir / "context_manager.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# SESSION CONTEXT
# ---------------------------------------------------------------------------

def _empty_context(session_id: str) -> dict[str, Any]:
    return {
        "session_id":   session_id,
        "farmer_id":    "",
        "farmer_name":  "",
        "language":     "",
        "location": {
            "state":    "",
            "district": "",
            "village":  "",
            "lat":      None,
            "lon":      None,
        },
        "active_crop":  "",
        "last_intent":  "",
        "last_module":  "",
        "turn_count":   0,
        "created_at":   datetime.now(timezone.utc).isoformat(),
        "updated_at":   datetime.now(timezone.utc).isoformat(),
        "extra":        {},
    }


# ---------------------------------------------------------------------------
# CONTEXT MANAGER
# ---------------------------------------------------------------------------

class ContextManager:
    """
    Maintains per-session user context for the Pragati AI Controller.

    Context is stored in-memory (keyed by session_id) and is lost when
    the process restarts. For persistence, flush to MemoryManager.

    Thread-safe via per-session RLocks.

    Usage:
        cm = ContextManager()
        cm.init_session("sess_001", farmer_id="f_123", language="hi")
        cm.update(session_id, location={"state": "Rajasthan"})
        ctx = cm.get(session_id)
        cm.set_last_intent(session_id, "disease", "disease_ai")
    """

    def __init__(self, cfg: Optional[PragatiAIConfig] = None) -> None:
        self._cfg         = cfg or get_config()
        self._log         = _build_logger(self._cfg)
        self._contexts:   dict[str, dict[str, Any]] = {}
        self._locks:      dict[str, threading.RLock] = {}
        self._global_lock = threading.Lock()

    # ------------------------------------------------------------------
    # SESSION LIFECYCLE
    # ------------------------------------------------------------------

    def init_session(
        self,
        session_id:  str,
        farmer_id:   str = "",
        farmer_name: str = "",
        language:    str = "",
        location:    Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Initialises a new session context or returns the existing one.

        Args:
            session_id:  Unique session identifier.
            farmer_id:   Optional farmer identifier.
            farmer_name: Optional farmer display name.
            language:    Optional preferred language code.
            location:    Optional location dict.

        Returns:
            The session context dict (deep copy).
        """
        lock = self._get_lock(session_id)
        with lock:
            if session_id not in self._contexts:
                ctx = _empty_context(session_id)
                ctx["farmer_id"]   = farmer_id
                ctx["farmer_name"] = farmer_name
                ctx["language"]    = language or self._cfg.default_language
                if location:
                    ctx["location"].update(location)
                self._contexts[session_id] = ctx
                self._log.info(
                    "Session init | session=%s farmer=%s lang=%s",
                    session_id, farmer_id, ctx["language"],
                )
            return deepcopy(self._contexts[session_id])

    def get(self, session_id: str) -> dict[str, Any]:
        """
        Returns a deep copy of the session context.
        Auto-initialises if the session does not exist.

        Args:
            session_id: Unique session identifier.

        Returns:
            Session context dict.
        """
        lock = self._get_lock(session_id)
        with lock:
            if session_id not in self._contexts:
                self._contexts[session_id] = _empty_context(session_id)
            return deepcopy(self._contexts[session_id])

    def update(
        self,
        session_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Updates top-level context fields for a session.

        Supported kwargs: farmer_id, farmer_name, language, active_crop,
                          last_intent, last_module, location (dict), extra (dict).

        Args:
            session_id: Unique session identifier.
            **kwargs:   Fields to update.
        """
        lock = self._get_lock(session_id)
        with lock:
            ctx = self._contexts.setdefault(session_id, _empty_context(session_id))
            for key, value in kwargs.items():
                if key == "location" and isinstance(value, dict):
                    ctx["location"].update(value)
                elif key == "extra" and isinstance(value, dict):
                    ctx["extra"].update(value)
                elif key in ctx:
                    ctx[key] = value
            ctx["updated_at"] = datetime.now(timezone.utc).isoformat()

    def increment_turn(self, session_id: str) -> int:
        """
        Increments the turn counter for a session.

        Args:
            session_id: Unique session identifier.

        Returns:
            New turn count.
        """
        lock = self._get_lock(session_id)
        with lock:
            ctx = self._contexts.setdefault(session_id, _empty_context(session_id))
            ctx["turn_count"] += 1
            ctx["updated_at"]  = datetime.now(timezone.utc).isoformat()
            return ctx["turn_count"]

    def set_last_intent(
        self,
        session_id: str,
        intent:     str,
        module_id:  str = "",
    ) -> None:
        """
        Records the last predicted intent and module for a session.

        Args:
            session_id: Unique session identifier.
            intent:     Intent label string.
            module_id:  Module identifier string.
        """
        self.update(session_id, last_intent=intent, last_module=module_id)

    def set_language(self, session_id: str, language: str) -> None:
        """
        Updates the preferred language for a session.

        Args:
            session_id: Unique session identifier.
            language:   BCP-47 language code.
        """
        self.update(session_id, language=language)

    def set_location(self, session_id: str, location: dict[str, Any]) -> None:
        """
        Updates the location context for a session.

        Args:
            session_id: Unique session identifier.
            location:   Dict with keys: state, district, village, lat, lon.
        """
        self.update(session_id, location=location)

    def set_active_crop(self, session_id: str, crop: str) -> None:
        """
        Sets the currently active crop for a session.

        Args:
            session_id: Unique session identifier.
            crop:       Crop name string.
        """
        self.update(session_id, active_crop=crop)

    def delete_session(self, session_id: str) -> None:
        """
        Removes the context for a session.

        Args:
            session_id: Unique session identifier.
        """
        with self._global_lock:
            self._contexts.pop(session_id, None)
            self._locks.pop(session_id, None)
            self._log.info("Session context deleted | session=%s", session_id)

    def list_sessions(self) -> list[str]:
        """Returns a list of all active session IDs."""
        with self._global_lock:
            return list(self._contexts.keys())

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    def _get_lock(self, session_id: str) -> threading.RLock:
        with self._global_lock:
            if session_id not in self._locks:
                self._locks[session_id] = threading.RLock()
            return self._locks[session_id]


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_cm_instance: Optional[ContextManager] = None
_cm_lock = threading.Lock()


def get_context_manager(force_rebuild: bool = False) -> ContextManager:
    """
    Returns the singleton ContextManager.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        ContextManager
    """
    global _cm_instance
    with _cm_lock:
        if _cm_instance is None or force_rebuild:
            _cm_instance = ContextManager()
    return _cm_instance
