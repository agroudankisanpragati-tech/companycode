# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/routing_logger.py
# Purpose: Centralized routing audit logger for all knowledge_base handlers.
#          Logs every routing decision with structured fields:
#            - Detected Intent
#            - Selected Module
#            - Knowledge Base Hit / Miss
#            - YOLO Used
#            - Weather Used
#            - Government Used
#            - Mandi Used
#            - Fallback Used
# =============================================================================

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

_AI_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# LOGGER SETUP
# ---------------------------------------------------------------------------

def _build_routing_logger() -> logging.Logger:
    logger = logging.getLogger("akp.routing_audit")
    if logger.handlers:
        return logger

    level = getattr(logging, os.getenv("KB_LOG_LEVEL", "INFO").upper(), logging.INFO)
    logger.setLevel(level)

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    log_dir = _AI_ROOT / "knowledge_base" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_dir / "routing_audit.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


_routing_log = _build_routing_logger()


# ---------------------------------------------------------------------------
# ROUTING AUDIT
# ---------------------------------------------------------------------------

def log_routing(
    intent:          str,
    module:          str,
    kb_hit:          bool,
    kb_collection:   str  = "",
    yolo_used:       bool = False,
    weather_used:    bool = False,
    government_used: bool = False,
    mandi_used:      bool = False,
    fallback_used:   bool = False,
    session_id:      str  = "",
    text_snippet:    str  = "",
    extra:           str  = "",
    response_ms:     float = 0.0,
) -> None:
    """
    Logs a structured routing audit entry.

    Called by every knowledge_base handler after resolving a response.
    Provides full observability into the routing layer.

    Args:
        intent:          Detected intent label.
        module:          Selected module ID.
        kb_hit:          True if a knowledge base record was found.
        kb_collection:   Name of the MongoDB collection that was hit.
        yolo_used:       True if YOLO inference was involved.
        weather_used:    True if weather service was used.
        government_used: True if government scheme DB was queried.
        mandi_used:      True if mandi price DB was queried.
        fallback_used:   True if a fallback response was returned.
        session_id:      Optional session identifier.
        text_snippet:    First 60 chars of input text.
        extra:           Any additional context string.
        response_ms:     Handler response time in milliseconds.
    """
    _routing_log.info(
        "AUDIT | intent=%-12s | module=%-20s | kb_hit=%-5s | collection=%-25s | "
        "yolo=%-5s | weather=%-5s | govt=%-5s | mandi=%-5s | fallback=%-5s | "
        "session=%-20s | ms=%-8.1f | text='%s'%s",
        intent,
        module,
        "HIT" if kb_hit else "MISS",
        kb_collection or "—",
        "YES" if yolo_used else "NO",
        "YES" if weather_used else "NO",
        "YES" if government_used else "NO",
        "YES" if mandi_used else "NO",
        "YES" if fallback_used else "NO",
        session_id or "—",
        response_ms,
        text_snippet[:60],
        f" | {extra}" if extra else "",
    )
