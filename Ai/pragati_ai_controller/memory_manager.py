# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/memory_manager.py
# Purpose: Manages short-term (in-process) and long-term (disk-persisted)
#          conversation memory for the Pragati AI Controller.
#          Thread-safe. Supports per-session and per-farmer memory.
# =============================================================================

from __future__ import annotations

import json
import logging
import sys
import threading
from collections import deque
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from pragati_ai_controller.config import PragatiAIConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.memory")
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
        filename=cfg.logs_dir / "memory_manager.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# TURN DATACLASS (plain dict for JSON compatibility)
# ---------------------------------------------------------------------------

def _make_turn(
    role:      str,
    content:   str,
    intent:    str = "",
    language:  str = "",
    module_id: str = "",
    extra:     Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return {
        "role":      role,        # "user" | "assistant"
        "content":   content,
        "intent":    intent,
        "language":  language,
        "module_id": module_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "extra":     extra or {},
    }


# ---------------------------------------------------------------------------
# MEMORY MANAGER
# ---------------------------------------------------------------------------

class MemoryManager:
    """
    Manages conversation memory at two levels:

    Short-term memory (STM):
        - In-process deque, capped at cfg.short_term_memory_limit turns.
        - Keyed by session_id.
        - Lost when the process restarts.
        - Used for immediate context injection into prompts.

    Long-term memory (LTM):
        - JSON files on disk, one per session_id.
        - Capped at cfg.long_term_memory_limit turns per session.
        - Persists across restarts.
        - Stored in cfg.memory_dir / <session_id>.json

    Thread-safe via per-session RLocks.

    Usage:
        mm = MemoryManager()
        mm.add_turn(session_id, "user",      "मेरी फसल में बीमारी है", intent="disease")
        mm.add_turn(session_id, "assistant", "यह झुलसा रोग है।")
        history = mm.get_short_term(session_id)
        mm.flush_to_long_term(session_id)
    """

    def __init__(self, cfg: Optional[PragatiAIConfig] = None) -> None:
        self._cfg  = cfg or get_config()
        self._log  = _build_logger(self._cfg)

        # session_id → deque[turn_dict]
        self._stm:   dict[str, deque[dict[str, Any]]] = {}
        # session_id → RLock
        self._locks: dict[str, threading.RLock]       = {}
        self._global_lock = threading.Lock()

    # ------------------------------------------------------------------
    # TURN MANAGEMENT
    # ------------------------------------------------------------------

    def add_turn(
        self,
        session_id: str,
        role:       str,
        content:    str,
        intent:     str = "",
        language:   str = "",
        module_id:  str = "",
        extra:      Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Appends a conversation turn to short-term memory.

        Args:
            session_id: Unique session identifier.
            role:       "user" or "assistant".
            content:    Text content of the turn.
            intent:     Predicted intent label (optional).
            language:   Language code (optional).
            module_id:  Module that handled the turn (optional).
            extra:      Additional metadata (optional).
        """
        turn = _make_turn(role, content, intent, language, module_id, extra)
        lock = self._get_lock(session_id)
        with lock:
            stm = self._get_stm(session_id)
            stm.append(turn)
            self._log.debug(
                "STM add | session=%s role=%s intent=%s len=%d",
                session_id, role, intent, len(stm),
            )

    def get_short_term(
        self,
        session_id: str,
        last_n:     Optional[int] = None,
    ) -> list[dict[str, Any]]:
        """
        Returns the short-term memory turns for a session.

        Args:
            session_id: Unique session identifier.
            last_n:     If set, returns only the last N turns.

        Returns:
            List of turn dicts, oldest first.
        """
        lock = self._get_lock(session_id)
        with lock:
            stm = self._get_stm(session_id)
            turns = list(stm)
        if last_n is not None:
            turns = turns[-last_n:]
        return turns

    def get_context_window(
        self,
        session_id: str,
        max_turns:  int = 6,
    ) -> list[dict[str, Any]]:
        """
        Returns the most recent turns suitable for context injection.

        Args:
            session_id: Unique session identifier.
            max_turns:  Maximum number of turns to return.

        Returns:
            List of turn dicts, oldest first.
        """
        return self.get_short_term(session_id, last_n=max_turns)

    def clear_short_term(self, session_id: str) -> None:
        """Clears the short-term memory for a session."""
        lock = self._get_lock(session_id)
        with lock:
            stm = self._get_stm(session_id)
            stm.clear()
            self._log.info("STM cleared | session=%s", session_id)

    # ------------------------------------------------------------------
    # LONG-TERM PERSISTENCE
    # ------------------------------------------------------------------

    def flush_to_long_term(self, session_id: str) -> None:
        """
        Persists the current short-term memory to disk (long-term memory).
        Merges with any existing LTM for the session and trims to limit.

        Args:
            session_id: Unique session identifier.
        """
        lock = self._get_lock(session_id)
        with lock:
            stm_turns = list(self._get_stm(session_id))
            if not stm_turns:
                return

            ltm_path  = self._ltm_path(session_id)
            existing  = self._load_ltm(ltm_path)
            merged    = existing + stm_turns
            limit     = self._cfg.long_term_memory_limit
            if len(merged) > limit:
                merged = merged[-limit:]

            self._save_ltm(ltm_path, merged)
            self._log.info(
                "LTM flush | session=%s turns_added=%d total=%d",
                session_id, len(stm_turns), len(merged),
            )

    def load_long_term(self, session_id: str) -> list[dict[str, Any]]:
        """
        Loads persisted long-term memory for a session from disk.

        Args:
            session_id: Unique session identifier.

        Returns:
            List of turn dicts, oldest first.
        """
        ltm_path = self._ltm_path(session_id)
        turns    = self._load_ltm(ltm_path)
        self._log.debug("LTM load | session=%s turns=%d", session_id, len(turns))
        return turns

    def restore_to_short_term(self, session_id: str, last_n: int = 10) -> None:
        """
        Restores the last N turns from long-term memory into short-term memory.
        Useful for resuming a session after a restart.

        Args:
            session_id: Unique session identifier.
            last_n:     Number of recent turns to restore.
        """
        ltm_turns = self.load_long_term(session_id)
        if not ltm_turns:
            return
        recent = ltm_turns[-last_n:]
        lock   = self._get_lock(session_id)
        with lock:
            stm = self._get_stm(session_id)
            stm.clear()
            stm.extend(recent)
            self._log.info(
                "STM restored from LTM | session=%s turns=%d",
                session_id, len(recent),
            )

    def get_full_history(self, session_id: str) -> list[dict[str, Any]]:
        """
        Returns the complete conversation history (LTM + current STM),
        deduplicated by timestamp.

        Args:
            session_id: Unique session identifier.

        Returns:
            Merged list of turn dicts, oldest first.
        """
        ltm   = self.load_long_term(session_id)
        stm   = self.get_short_term(session_id)
        seen  = {t["timestamp"] for t in ltm}
        extra = [t for t in stm if t["timestamp"] not in seen]
        return ltm + extra

    def delete_session(self, session_id: str) -> None:
        """
        Removes all memory (STM + LTM) for a session.

        Args:
            session_id: Unique session identifier.
        """
        lock = self._get_lock(session_id)
        with lock:
            self._stm.pop(session_id, None)
            ltm_path = self._ltm_path(session_id)
            if ltm_path.exists():
                ltm_path.unlink()
            self._log.info("Session deleted | session=%s", session_id)

    def session_exists(self, session_id: str) -> bool:
        """Returns True if any memory exists for the session."""
        in_stm = session_id in self._stm and len(self._stm[session_id]) > 0
        in_ltm = self._ltm_path(session_id).exists()
        return in_stm or in_ltm

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _get_lock(self, session_id: str) -> threading.RLock:
        with self._global_lock:
            if session_id not in self._locks:
                self._locks[session_id] = threading.RLock()
            return self._locks[session_id]

    def _get_stm(self, session_id: str) -> deque[dict[str, Any]]:
        if session_id not in self._stm:
            self._stm[session_id] = deque(
                maxlen=self._cfg.short_term_memory_limit
            )
        return self._stm[session_id]

    def _ltm_path(self, session_id: str) -> Path:
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
        return self._cfg.memory_dir / f"{safe_id}.json"

    def _load_ltm(self, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception as exc:
            self._log.warning("LTM load error '%s': %s", path.name, exc)
            return []

    def _save_ltm(self, path: Path, turns: list[dict[str, Any]]) -> None:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(turns, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            self._log.error("LTM save error '%s': %s", path.name, exc)


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_mm_instance: Optional[MemoryManager] = None
_mm_lock = threading.Lock()


def get_memory_manager(force_rebuild: bool = False) -> MemoryManager:
    """
    Returns the singleton MemoryManager.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        MemoryManager
    """
    global _mm_instance
    with _mm_lock:
        if _mm_instance is None or force_rebuild:
            _mm_instance = MemoryManager()
    return _mm_instance
