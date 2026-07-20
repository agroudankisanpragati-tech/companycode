# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/response_formatter.py
# Purpose: Normalises all module outputs and fallback responses into a
#          single, consistent production envelope consumed by the API layer.
#          Handles success, fallback, and error states uniformly.
# =============================================================================

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from knowledge_router.config import KnowledgeRouterConfig, ROUTER_VERSION, get_config
from knowledge_router.request_dispatcher import DispatchRequest

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: KnowledgeRouterConfig) -> logging.Logger:
    logger = logging.getLogger("akp.router.formatter")
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

    log_file = cfg.logs_dir / "response_formatter.log"
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


# ---------------------------------------------------------------------------
# RESPONSE STATUS CONSTANTS
# ---------------------------------------------------------------------------

class ResponseStatus:
    SUCCESS   = "success"
    FALLBACK  = "fallback"
    ERROR     = "error"


# ---------------------------------------------------------------------------
# RESPONSE FORMATTER
# ---------------------------------------------------------------------------

class ResponseFormatter:
    """
    Converts raw module results and fallback dicts into a unified
    production-ready response envelope.

    Envelope schema:
        {
            "status":         "success" | "fallback" | "error",
            "router_version": str,
            "intent":         str,
            "confidence":     float,
            "module_id":      str,
            "language":       str,
            "session_id":     str,
            "farmer_id":      str,
            "data":           Any,
            "message":        str,
            "suggestions":    list[str],
            "fallback_reason": str,
            "error":          str,
            "routed_at":      str,
            "responded_at":   str,
        }

    Usage:
        formatter = ResponseFormatter()
        envelope  = formatter.format_success(req, module_result)
        envelope  = formatter.format_fallback(fallback_result)
        envelope  = formatter.format_error(req, exception)
    """

    def __init__(self, cfg: Optional[KnowledgeRouterConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def format_success(
        self,
        req:           DispatchRequest,
        module_result: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Formats a successful module response into the unified envelope.

        Args:
            req:           The DispatchRequest that was processed.
            module_result: Raw dict returned by the module's handle() function.

        Returns:
            Unified response envelope dict.
        """
        data    = module_result.get("data")
        message = str(module_result.get("message", ""))
        status  = str(module_result.get("status", ResponseStatus.SUCCESS))

        # If the module itself reported unavailability, treat as fallback
        if status == "module_unavailable":
            return self.format_fallback({
                "status":          ResponseStatus.FALLBACK,
                "fallback_reason": "module_unavailable",
                "module_id":       req.module_id,
                "intent":          req.intent,
                "confidence":      req.confidence,
                "language":        req.language,
                "message":         module_result.get("error", "Module unavailable"),
                "suggestions":     [],
                "error":           module_result.get("error", ""),
                "data":            None,
                "timestamp":       self._utc_now(),
            })

        envelope = self._base_envelope(req)
        envelope.update({
            "status":          ResponseStatus.SUCCESS,
            "data":            data,
            "message":         message,
            "suggestions":     list(module_result.get("suggestions", [])),
            "fallback_reason": "",
            "error":           "",
            "responded_at":    self._utc_now(),
        })

        self._log.info(
            "format_success | intent=%-15s module=%-20s session=%s",
            req.intent, req.module_id, req.session_id,
        )
        return envelope

    def format_fallback(self, fallback_result: dict[str, Any]) -> dict[str, Any]:
        """
        Formats a fallback handler response into the unified envelope.

        Args:
            fallback_result: Dict returned by FallbackHandler methods.

        Returns:
            Unified response envelope dict.
        """
        envelope = {
            "status":          ResponseStatus.FALLBACK,
            "router_version":  ROUTER_VERSION,
            "intent":          str(fallback_result.get("intent", "unknown")),
            "confidence":      float(fallback_result.get("confidence", 0.0)),
            "module_id":       str(fallback_result.get("module_id", self._cfg.fallback_module)),
            "language":        str(fallback_result.get("language", "latin")),
            "session_id":      "",
            "farmer_id":       "",
            "data":            None,
            "message":         str(fallback_result.get("message", "")),
            "suggestions":     list(fallback_result.get("suggestions", [])),
            "fallback_reason": str(fallback_result.get("fallback_reason", "unknown")),
            "error":           str(fallback_result.get("error", "")),
            "routed_at":       str(fallback_result.get("timestamp", self._utc_now())),
            "responded_at":    self._utc_now(),
        }

        self._log.info(
            "format_fallback | reason=%-20s intent=%-15s",
            envelope["fallback_reason"], envelope["intent"],
        )
        return envelope

    def format_error(
        self,
        req:   Optional[DispatchRequest],
        error: Exception,
    ) -> dict[str, Any]:
        """
        Formats an unexpected router-level exception into the unified envelope.

        Args:
            req:   The DispatchRequest being processed when the error occurred
                   (may be None if the error occurred before dispatch).
            error: The exception that was raised.

        Returns:
            Unified response envelope dict.
        """
        error_str = f"{type(error).__name__}: {error}"
        self._log.error(
            "format_error | module=%-20s error=%s",
            req.module_id if req else "unknown",
            error_str,
        )

        envelope: dict[str, Any] = {
            "status":          ResponseStatus.ERROR,
            "router_version":  ROUTER_VERSION,
            "intent":          req.intent     if req else "unknown",
            "confidence":      req.confidence if req else 0.0,
            "module_id":       req.module_id  if req else "unknown",
            "language":        req.language   if req else "latin",
            "session_id":      req.session_id if req else "",
            "farmer_id":       req.farmer_id  if req else "",
            "data":            None,
            "message":         "An unexpected error occurred. Please try again.",
            "suggestions":     [],
            "fallback_reason": "",
            "error":           error_str,
            "routed_at":       req.timestamp  if req else self._utc_now(),
            "responded_at":    self._utc_now(),
        }
        return envelope

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _base_envelope(self, req: DispatchRequest) -> dict[str, Any]:
        return {
            "router_version": ROUTER_VERSION,
            "intent":         req.intent,
            "confidence":     req.confidence,
            "module_id":      req.module_id,
            "language":       req.language,
            "session_id":     req.session_id,
            "farmer_id":      req.farmer_id,
            "routed_at":      req.timestamp,
        }

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_formatter_instance: Optional[ResponseFormatter] = None


def get_formatter(force_rebuild: bool = False) -> ResponseFormatter:
    """
    Returns the singleton ResponseFormatter.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        ResponseFormatter
    """
    global _formatter_instance
    if _formatter_instance is None or force_rebuild:
        _formatter_instance = ResponseFormatter()
    return _formatter_instance
