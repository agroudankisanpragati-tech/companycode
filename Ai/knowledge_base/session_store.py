# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/session_store.py
# Purpose: Per-session context store for the Knowledge Base layer.
#          Holds active disease, active crop, last YOLO result, last module
#          data, and pending actions so follow-up queries ("उसका इलाज",
#          "दूसरी दवा") can be resolved without asking the farmer again.
#
# Thread-safe. Singleton. In-process only (lost on restart — STM only).
# LTM persistence is handled by pragati_ai_controller.memory_manager.
# =============================================================================

from __future__ import annotations

import threading
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Optional


# ---------------------------------------------------------------------------
# SLOT KEYS — canonical names for all context slots
# ---------------------------------------------------------------------------

class Slot:
    ACTIVE_DISEASE    = "active_disease"     # str: disease/pest name
    ACTIVE_CROP       = "active_crop"        # str: crop name
    ACTIVE_INTENT     = "active_intent"      # str: last confirmed intent
    ACTIVE_MODULE     = "active_module"      # str: last module that responded
    LAST_YOLO_RESULT  = "last_yolo_result"   # dict: full YOLO prediction
    LAST_KB_DATA      = "last_kb_data"       # dict: last KB document(s)
    LAST_RESPONSE     = "last_response"      # str: last assistant message
    PENDING_ACTION    = "pending_action"     # str: e.g. "awaiting_image"
    TURN_COUNT        = "turn_count"         # int
    LANGUAGE          = "language"           # str
    LOCATION          = "location"           # dict
    FARMER_ID         = "farmer_id"          # str
    UPDATED_AT        = "updated_at"         # str ISO-8601


def _empty_session(session_id: str) -> dict[str, Any]:
    return {
        "session_id":       session_id,
        Slot.ACTIVE_DISEASE:   "",
        Slot.ACTIVE_CROP:      "",
        Slot.ACTIVE_INTENT:    "",
        Slot.ACTIVE_MODULE:    "",
        Slot.LAST_YOLO_RESULT: {},
        Slot.LAST_KB_DATA:     {},
        Slot.LAST_RESPONSE:    "",
        Slot.PENDING_ACTION:   "",
        Slot.TURN_COUNT:       0,
        Slot.LANGUAGE:         "hi",
        Slot.LOCATION:         {},
        Slot.FARMER_ID:        "",
        Slot.UPDATED_AT:       datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# SESSION STORE
# ---------------------------------------------------------------------------

class SessionStore:
    """
    Lightweight per-session context store for the Knowledge Base layer.

    All KB handlers call get() / set() / update() to share state across
    turns within the same session.

    Usage:
        store = get_session_store()
        store.set(session_id, Slot.ACTIVE_DISEASE, "Leaf Blight")
        disease = store.get(session_id, Slot.ACTIVE_DISEASE)
        store.update(session_id, {Slot.ACTIVE_CROP: "Wheat", Slot.LANGUAGE: "hi"})
    """

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._global_lock = threading.Lock()
        self._locks: dict[str, threading.RLock] = {}

    def _get_lock(self, session_id: str) -> threading.RLock:
        with self._global_lock:
            if session_id not in self._locks:
                self._locks[session_id] = threading.RLock()
            return self._locks[session_id]

    def _get_session(self, session_id: str) -> dict[str, Any]:
        if session_id not in self._sessions:
            self._sessions[session_id] = _empty_session(session_id)
        return self._sessions[session_id]

    def get(self, session_id: str, slot: str, default: Any = "") -> Any:
        """Returns the value of a context slot for a session."""
        if not session_id:
            return default
        lock = self._get_lock(session_id)
        with lock:
            return deepcopy(self._get_session(session_id).get(slot, default))

    def set(self, session_id: str, slot: str, value: Any) -> None:
        """Sets a single context slot for a session."""
        if not session_id:
            return
        lock = self._get_lock(session_id)
        with lock:
            sess = self._get_session(session_id)
            sess[slot] = value
            sess[Slot.UPDATED_AT] = datetime.now(timezone.utc).isoformat()

    def update(self, session_id: str, slots: dict[str, Any]) -> None:
        """Updates multiple context slots at once."""
        if not session_id:
            return
        lock = self._get_lock(session_id)
        with lock:
            sess = self._get_session(session_id)
            for k, v in slots.items():
                sess[k] = v
            sess[Slot.UPDATED_AT] = datetime.now(timezone.utc).isoformat()

    def get_all(self, session_id: str) -> dict[str, Any]:
        """Returns a deep copy of the full session context."""
        if not session_id:
            return {}
        lock = self._get_lock(session_id)
        with lock:
            return deepcopy(self._get_session(session_id))

    def increment_turn(self, session_id: str) -> int:
        """Increments and returns the turn counter."""
        if not session_id:
            return 0
        lock = self._get_lock(session_id)
        with lock:
            sess = self._get_session(session_id)
            sess[Slot.TURN_COUNT] = sess.get(Slot.TURN_COUNT, 0) + 1
            return sess[Slot.TURN_COUNT]

    def clear(self, session_id: str) -> None:
        """Resets all slots for a session."""
        if not session_id:
            return
        lock = self._get_lock(session_id)
        with lock:
            self._sessions[session_id] = _empty_session(session_id)

    def delete(self, session_id: str) -> None:
        """Removes a session entirely."""
        with self._global_lock:
            self._sessions.pop(session_id, None)
            self._locks.pop(session_id, None)

    def exists(self, session_id: str) -> bool:
        return session_id in self._sessions


# ---------------------------------------------------------------------------
# SINGLETON
# ---------------------------------------------------------------------------

_store_instance: Optional[SessionStore] = None
_store_lock = threading.Lock()


def get_session_store(force_rebuild: bool = False) -> SessionStore:
    """Returns the singleton SessionStore."""
    global _store_instance
    with _store_lock:
        if _store_instance is None or force_rebuild:
            _store_instance = SessionStore()
    return _store_instance
