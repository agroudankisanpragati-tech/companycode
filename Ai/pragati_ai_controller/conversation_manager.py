# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/conversation_manager.py
# Purpose: Manages complete conversation state for the Pragati AI Controller.
#          Orchestrates MemoryManager and ContextManager to maintain
#          per-session conversation history, build context windows for
#          prompt injection, and track session lifecycle.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from pragati_ai_controller.config import PragatiAIConfig, get_config
from pragati_ai_controller.context_manager import ContextManager, get_context_manager
from pragati_ai_controller.memory_manager import MemoryManager, get_memory_manager

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.conversation")
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
        filename=cfg.logs_dir / "conversation_manager.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# CONVERSATION MANAGER
# ---------------------------------------------------------------------------

class ConversationManager:
    """
    Manages complete conversation state for the Pragati AI Controller.

    Responsibilities:
        - Start and resume sessions.
        - Record user and assistant turns.
        - Build context windows for prompt injection.
        - Flush memory to disk at session end.
        - Expose conversation history for downstream modules.

    Delegates storage to MemoryManager and session state to ContextManager.

    Thread-safe via MemoryManager and ContextManager internal locks.

    Usage:
        cm = ConversationManager()
        cm.start_session("sess_001", farmer_id="f_123", language="hi")
        cm.record_user_turn("sess_001", "मेरी फसल में बीमारी है", intent="disease")
        cm.record_assistant_turn("sess_001", "यह झुलसा रोग है।", module_id="disease_ai")
        window = cm.get_context_window("sess_001")
        cm.end_session("sess_001")
    """

    def __init__(
        self,
        cfg:     Optional[PragatiAIConfig] = None,
        memory:  Optional[MemoryManager]   = None,
        context: Optional[ContextManager]  = None,
    ) -> None:
        self._cfg     = cfg     or get_config()
        self._log     = _build_logger(self._cfg)
        self._memory  = memory  or get_memory_manager()
        self._context = context or get_context_manager()

    # ------------------------------------------------------------------
    # SESSION LIFECYCLE
    # ------------------------------------------------------------------

    def start_session(
        self,
        session_id:  str,
        farmer_id:   str = "",
        farmer_name: str = "",
        language:    str = "",
        location:    Optional[dict[str, Any]] = None,
        restore_ltm: bool = True,
    ) -> dict[str, Any]:
        """
        Starts or resumes a conversation session.

        Args:
            session_id:  Unique session identifier.
            farmer_id:   Optional farmer identifier.
            farmer_name: Optional farmer display name.
            language:    Optional preferred language code.
            location:    Optional location context dict.
            restore_ltm: If True, restores recent LTM turns into STM.

        Returns:
            Session context dict.
        """
        ctx = self._context.init_session(
            session_id  = session_id,
            farmer_id   = farmer_id,
            farmer_name = farmer_name,
            language    = language,
            location    = location,
        )

        if restore_ltm and not self._memory.session_exists(session_id):
            self._memory.restore_to_short_term(session_id, last_n=10)

        self._log.info(
            "Session started | session=%s farmer=%s lang=%s",
            session_id, farmer_id, ctx.get("language", ""),
        )
        return ctx

    def end_session(self, session_id: str, flush_memory: bool = True) -> None:
        """
        Ends a conversation session, optionally flushing memory to disk.

        Args:
            session_id:   Unique session identifier.
            flush_memory: If True, persists STM to LTM before clearing.
        """
        if flush_memory:
            self._memory.flush_to_long_term(session_id)
        self._log.info("Session ended | session=%s flush=%s", session_id, flush_memory)

    # ------------------------------------------------------------------
    # TURN RECORDING
    # ------------------------------------------------------------------

    def record_user_turn(
        self,
        session_id: str,
        text:       str,
        intent:     str = "",
        language:   str = "",
        extra:      Optional[dict[str, Any]] = None,
    ) -> int:
        """
        Records a user turn and increments the session turn counter.

        Args:
            session_id: Unique session identifier.
            text:       User's input text.
            intent:     Predicted intent label.
            language:   Detected language code.
            extra:      Optional additional metadata.

        Returns:
            Updated turn count.
        """
        self._memory.add_turn(
            session_id = session_id,
            role       = "user",
            content    = text,
            intent     = intent,
            language   = language,
            extra      = extra,
        )
        if intent:
            self._context.set_last_intent(session_id, intent)
        if language:
            self._context.set_language(session_id, language)

        turn_count = self._context.increment_turn(session_id)
        self._log.debug(
            "User turn | session=%s intent=%s turn=%d",
            session_id, intent, turn_count,
        )
        return turn_count

    def record_assistant_turn(
        self,
        session_id: str,
        text:       str,
        module_id:  str = "",
        language:   str = "",
        extra:      Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Records an assistant response turn.

        Args:
            session_id: Unique session identifier.
            text:       Assistant's response text.
            module_id:  Module that generated the response.
            language:   Response language code.
            extra:      Optional additional metadata.
        """
        self._memory.add_turn(
            session_id = session_id,
            role       = "assistant",
            content    = text,
            module_id  = module_id,
            language   = language,
            extra      = extra,
        )
        if module_id:
            self._context.update(session_id, last_module=module_id)
        self._log.debug(
            "Assistant turn | session=%s module=%s",
            session_id, module_id,
        )

    # ------------------------------------------------------------------
    # CONTEXT WINDOW
    # ------------------------------------------------------------------

    def get_context_window(
        self,
        session_id: str,
        max_turns:  int = 6,
    ) -> list[dict[str, Any]]:
        """
        Returns the most recent conversation turns for context injection.

        Args:
            session_id: Unique session identifier.
            max_turns:  Maximum number of turns to include.

        Returns:
            List of turn dicts, oldest first.
        """
        return self._memory.get_context_window(session_id, max_turns=max_turns)

    def get_context_as_text(
        self,
        session_id: str,
        max_turns:  int = 6,
    ) -> str:
        """
        Returns the context window as a formatted text string for prompt injection.

        Format:
            User: <text>
            Assistant: <text>
            ...

        Args:
            session_id: Unique session identifier.
            max_turns:  Maximum number of turns to include.

        Returns:
            Formatted conversation string.
        """
        turns = self.get_context_window(session_id, max_turns=max_turns)
        lines = []
        for turn in turns:
            role    = "User" if turn["role"] == "user" else "Assistant"
            content = turn.get("content", "").strip()
            if content:
                lines.append(f"{role}: {content}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # HISTORY ACCESS
    # ------------------------------------------------------------------

    def get_history(self, session_id: str) -> list[dict[str, Any]]:
        """
        Returns the full short-term memory history for a session.

        Args:
            session_id: Unique session identifier.

        Returns:
            List of turn dicts, oldest first.
        """
        return self._memory.get_short_term(session_id)

    def get_full_history(self, session_id: str) -> list[dict[str, Any]]:
        """
        Returns the complete conversation history (LTM + STM).

        Args:
            session_id: Unique session identifier.

        Returns:
            Merged list of turn dicts, oldest first.
        """
        return self._memory.get_full_history(session_id)

    def get_session_context(self, session_id: str) -> dict[str, Any]:
        """
        Returns the current session context dict.

        Args:
            session_id: Unique session identifier.

        Returns:
            Session context dict.
        """
        return self._context.get(session_id)

    def get_last_intent(self, session_id: str) -> str:
        """Returns the last predicted intent for a session."""
        return self._context.get(session_id).get("last_intent", "")

    def get_language(self, session_id: str) -> str:
        """Returns the current language preference for a session."""
        return self._context.get(session_id).get("language", self._cfg.default_language)

    def clear_session(self, session_id: str) -> None:
        """
        Clears all in-memory state for a session without touching LTM.

        Args:
            session_id: Unique session identifier.
        """
        self._memory.clear_short_term(session_id)
        self._context.delete_session(session_id)
        self._log.info("Session cleared | session=%s", session_id)


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_conv_instance: Optional[ConversationManager] = None
_conv_lock = threading.Lock()


def get_conversation_manager(force_rebuild: bool = False) -> ConversationManager:
    """
    Returns the singleton ConversationManager.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        ConversationManager
    """
    global _conv_instance
    with _conv_lock:
        if _conv_instance is None or force_rebuild:
            _conv_instance = ConversationManager()
    return _conv_instance
