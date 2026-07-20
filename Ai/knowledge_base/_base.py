# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/_base.py
# Purpose: Shared utilities for all knowledge_base module handlers.
#          Provides MongoDB connection, response builder, and text helpers.
# =============================================================================

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Optional

# Load .env — prefer Ai/.env, fall back to backend/.env
try:
    from dotenv import load_dotenv
    _ai_env = Path(__file__).resolve().parent.parent / ".env"
    if _ai_env.exists():
        load_dotenv(_ai_env, override=False)
    else:
        _backend_env = Path(__file__).resolve().parent.parent.parent / "backend" / ".env"
        if _backend_env.exists():
            load_dotenv(_backend_env, override=False)
except ImportError:
    pass

_MONGO_URI        = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
_MONGO_DB         = os.getenv("MONGO_DB_NAME", "kisan-pragati")
_MONGO_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "5000"))

import threading as _threading
_client: Any = None
_client_lock = _threading.Lock()


def _get_db() -> Any:
    global _client
    try:
        import pymongo
        with _client_lock:
            if _client is None:
                _client = pymongo.MongoClient(
                    _MONGO_URI,
                    serverSelectionTimeoutMS=_MONGO_TIMEOUT_MS,
                    socketTimeoutMS=_MONGO_TIMEOUT_MS,
                    connectTimeoutMS=_MONGO_TIMEOUT_MS,
                    maxPoolSize=10,
                )
        return _client[_MONGO_DB]
    except Exception:
        return None


def _escape(value: str) -> str:
    return re.escape(value)


def _query_collection(
    collection_name: str,
    query: dict[str, Any],
    projection: Optional[dict[str, Any]] = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    db = _get_db()
    if db is None:
        return []
    try:
        proj = projection or {"_id": 0}
        cursor = db[collection_name].find(query, proj).limit(limit)
        return list(cursor)
    except Exception:
        return []


def _query_one(
    collection_name: str,
    query: dict[str, Any],
    projection: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    db = _get_db()
    if db is None:
        return None
    try:
        proj = projection or {"_id": 0}
        return db[collection_name].find_one(query, proj)
    except Exception:
        return None


def build_response(
    module_id:       str,
    intent:          str,
    language:        str,
    message:         str,
    data:            Optional[Any]       = None,
    suggestions:     Optional[list[str]] = None,
    fallback_reason: str                 = "",
    error:           str                 = "",
) -> dict[str, Any]:
    return {
        "status":          "success" if not error else "error",
        "module_id":       module_id,
        "intent":          intent,
        "language":        language,
        "message":         message,
        "data":            data,
        "suggestions":     suggestions or [],
        "fallback_reason": fallback_reason,
        "error":           error,
    }


def _lang(request: dict[str, Any]) -> str:
    lang = request.get("language", "latin")
    if lang in ("devanagari", "hi", "raj", "mr", "mew"):
        return "hi"
    return "en"


def _text(request: dict[str, Any]) -> str:
    return str(request.get("text", "")).strip()
