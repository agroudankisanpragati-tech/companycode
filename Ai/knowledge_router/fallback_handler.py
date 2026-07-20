# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/fallback_handler.py
# Purpose: Handles all fallback scenarios for the Knowledge Router.
#          Returns structured fallback responses for unknown intents,
#          module failures, validation errors, and empty inputs.
# =============================================================================

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from knowledge_router.config import KnowledgeRouterConfig, get_config

try:
    from knowledge_router.request_dispatcher import DispatchRequest
except ImportError:
    DispatchRequest = None  # type: ignore[assignment,misc]


def _build_logger(cfg: KnowledgeRouterConfig) -> logging.Logger:
    logger = logging.getLogger("akp.router.fallback")
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
    log_file = cfg.logs_dir / "fallback_handler.log"
    fh = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _suggestions(language: str) -> list[str]:
    if language in ("devanagari", "hi", "raj", "mr", "mew"):
        return [
            "रोग पहचान के लिए छवि अपलोड करें",
            "फसल सिफारिश लें",
            "मंडी भाव देखें",
            "मौसम जानकारी",
            "सरकारी योजनाएं",
        ]
    return [
        "Upload image for disease detection",
        "Get crop recommendation",
        "Check mandi prices",
        "Weather information",
        "Government schemes",
    ]


class FallbackHandler:
    """
    Handles all fallback scenarios for the Knowledge Router.

    Scenarios:
        - Unknown intent (low confidence)
        - Module load failure
        - Validation error
        - Empty input
    """

    def __init__(self, cfg: Optional[KnowledgeRouterConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

    def handle_unknown(self, req: Any) -> dict[str, Any]:
        """Handles unknown intent or low-confidence prediction."""
        lang = getattr(req, "language", "latin")
        if lang in ("devanagari", "hi", "raj", "mr", "mew"):
            msg = "मुझे आपका प्रश्न समझ नहीं आया। कृपया अधिक जानकारी दें।"
        else:
            msg = "I could not understand your query. Please provide more details."

        self._log.info(
            "fallback:unknown | intent=%s conf=%.4f",
            getattr(req, "intent", "?"),
            getattr(req, "confidence", 0.0),
        )
        return {
            "status":          "fallback",
            "fallback_reason": "low_confidence",
            "module_id":       self._cfg.fallback_module,
            "intent":          getattr(req, "intent", "unknown"),
            "confidence":      getattr(req, "confidence", 0.0),
            "language":        lang,
            "message":         msg,
            "suggestions":     _suggestions(lang),
            "error":           "",
            "data":            None,
            "timestamp":       _utc_now(),
        }

    def handle_module_failure(self, req: Any, error: str) -> dict[str, Any]:
        """Handles a module that raised an exception during execution."""
        lang = getattr(req, "language", "latin")
        if lang in ("devanagari", "hi", "raj", "mr", "mew"):
            msg = "सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।"
        else:
            msg = "Service temporarily unavailable. Please try again."

        self._log.warning(
            "fallback:module_failure | module=%s error=%s",
            getattr(req, "module_id", "?"), error,
        )
        return {
            "status":          "fallback",
            "fallback_reason": "module_failure",
            "module_id":       self._cfg.fallback_module,
            "intent":          getattr(req, "intent", "unknown"),
            "confidence":      getattr(req, "confidence", 0.0),
            "language":        lang,
            "message":         msg,
            "suggestions":     _suggestions(lang),
            "error":           error,
            "data":            None,
            "timestamp":       _utc_now(),
        }

    def handle_validation_error(self, error: str, language: str = "latin") -> dict[str, Any]:
        """Handles a payload validation error."""
        if language in ("devanagari", "hi", "raj", "mr", "mew"):
            msg = "अनुरोध अमान्य है। कृपया पुनः प्रयास करें।"
        else:
            msg = "Invalid request. Please try again."

        self._log.warning("fallback:validation_error | %s", error)
        return {
            "status":          "fallback",
            "fallback_reason": "validation_error",
            "module_id":       self._cfg.fallback_module,
            "intent":          "unknown",
            "confidence":      0.0,
            "language":        language,
            "message":         msg,
            "suggestions":     _suggestions(language),
            "error":           error,
            "data":            None,
            "timestamp":       _utc_now(),
        }

    def handle_empty_input(self, language: str = "latin") -> dict[str, Any]:
        """Handles empty or whitespace-only input."""
        if language in ("devanagari", "hi", "raj", "mr", "mew"):
            msg = "कृपया अपना प्रश्न लिखें।"
        else:
            msg = "Please enter your query."

        return {
            "status":          "fallback",
            "fallback_reason": "empty_input",
            "module_id":       self._cfg.fallback_module,
            "intent":          "unknown",
            "confidence":      0.0,
            "language":        language,
            "message":         msg,
            "suggestions":     _suggestions(language),
            "error":           "",
            "data":            None,
            "timestamp":       _utc_now(),
        }


_fallback_instance: Optional[FallbackHandler] = None


def get_fallback_handler(force_rebuild: bool = False) -> FallbackHandler:
    global _fallback_instance
    if _fallback_instance is None or force_rebuild:
        _fallback_instance = FallbackHandler()
    return _fallback_instance
