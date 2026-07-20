# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/request_dispatcher.py
# Purpose: Validates, normalises, and enriches incoming intent payloads
#          from the Intent Engine before they are handed to the router.
#          Produces a canonical DispatchRequest consumed by router.py.
# =============================================================================

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from knowledge_router.config import KnowledgeRouterConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: KnowledgeRouterConfig) -> logging.Logger:
    logger = logging.getLogger("akp.router.dispatcher")
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

    log_file = cfg.logs_dir / "request_dispatcher.log"
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
# DISPATCH REQUEST
# ---------------------------------------------------------------------------

@dataclass
class DispatchRequest:
    """
    Canonical request object passed from the dispatcher to the router.

    Attributes:
        intent:           Resolved intent label (never empty).
        confidence:       Prediction confidence (0.0 – 1.0).
        is_unknown:       True when confidence < threshold or intent unknown.
        text:             Normalised input text.
        raw_text:         Original un-normalised input.
        language:         Script hint: "latin" | "devanagari" | "mixed".
        top_predictions:  Full ranked list from the Intent Engine.
        module_id:        Resolved target module identifier.
        use_fallback:     True when the request must be handled by fallback.
        timestamp:        UTC ISO-8601 dispatch timestamp.
        session_id:       Optional caller session identifier.
        farmer_id:        Optional farmer identifier for personalisation.
        location:         Optional location context dict.
        extra:            Pass-through metadata from the Intent Engine.
    """
    intent:          str
    confidence:      float
    is_unknown:      bool
    text:            str
    raw_text:        str
    language:        str
    top_predictions: list[dict[str, Any]]
    module_id:       str
    use_fallback:    bool
    timestamp:       str
    session_id:      str                  = ""
    farmer_id:       str                  = ""
    location:        dict[str, Any]       = field(default_factory=dict)
    extra:           dict[str, Any]       = field(default_factory=dict)

    def to_module_request(self) -> dict[str, Any]:
        """
        Returns the dict passed directly to a module's handle() function.
        """
        return {
            "intent":     self.intent,
            "confidence": self.confidence,
            "text":       self.text,
            "raw_text":   self.raw_text,
            "language":   self.language,
            "session_id": self.session_id,
            "farmer_id":  self.farmer_id,
            "location":   self.location,
            "timestamp":  self.timestamp,
            "extra":      self.extra,
        }


# ---------------------------------------------------------------------------
# VALIDATION ERROR
# ---------------------------------------------------------------------------

class DispatchValidationError(ValueError):
    """Raised when an incoming payload cannot be normalised into a DispatchRequest."""


# ---------------------------------------------------------------------------
# REQUEST DISPATCHER
# ---------------------------------------------------------------------------

class RequestDispatcher:
    """
    Validates and enriches raw Intent Engine payloads into DispatchRequest
    objects ready for the router.

    Accepted payload schema (from PredictionResult.to_router_payload()):
        {
            "intent":      str,
            "confidence":  float,
            "is_unknown":  bool,
            "text":        str,
            "language":    str,
            "timestamp":   str,
            "top":         [{"intent": str, "confidence": float}, ...]
        }

    Optional caller-supplied fields (merged at dispatch time):
        session_id, farmer_id, location, extra

    Usage:
        dispatcher = RequestDispatcher()
        req = dispatcher.dispatch(router_payload, session_id="abc123")
    """

    def __init__(self, cfg: Optional[KnowledgeRouterConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def dispatch(
        self,
        payload:    dict[str, Any],
        session_id: str                        = "",
        farmer_id:  str                        = "",
        location:   Optional[dict[str, Any]]   = None,
        extra:      Optional[dict[str, Any]]   = None,
    ) -> DispatchRequest:
        """
        Validates and enriches a raw Intent Engine payload.

        Args:
            payload:    Dict from PredictionResult.to_router_payload().
            session_id: Optional caller session identifier.
            farmer_id:  Optional farmer identifier.
            location:   Optional location context dict.
            extra:      Optional additional metadata.

        Returns:
            DispatchRequest: Fully resolved, ready for the router.

        Raises:
            DispatchValidationError: If the payload is structurally invalid.
        """
        self._validate(payload)

        intent     = self._resolve_intent(payload)
        confidence = float(payload.get("confidence", 0.0))
        is_unknown = bool(payload.get("is_unknown", False))
        text       = str(payload.get("text", "")).strip()
        raw_text   = str(payload.get("raw_text", text)).strip()
        language   = str(payload.get("language", "latin")).strip() or "latin"
        top        = list(payload.get("top", []))
        timestamp  = str(payload.get("timestamp", self._utc_now()))

        # use_fallback only when intent has NO mapped module AND is truly unknown.
        # A known intent (disease, crop, weather, etc.) ALWAYS routes locally
        # regardless of confidence — never falls back.
        # "unknown" intent now maps to general_ai via INTENT_MODULE_MAP safety net.
        has_module   = intent in self._cfg.intent_module_map
        # Only use fallback if intent is completely unmapped AND is_unknown
        use_fallback = not has_module and is_unknown
        module_id    = self._resolve_module(intent, use_fallback)

        req = DispatchRequest(
            intent          = intent,
            confidence      = confidence,
            is_unknown      = is_unknown,
            text            = text,
            raw_text        = raw_text,
            language        = language,
            top_predictions = top,
            module_id       = module_id,
            use_fallback    = use_fallback,
            timestamp       = timestamp,
            session_id      = session_id,
            farmer_id       = farmer_id,
            location        = location or {},
            extra           = extra or {},
        )

        self._log.info(
            "dispatch | intent=%-15s conf=%.4f module=%-20s fallback=%s raw='%s'",
            req.intent, req.confidence, req.module_id, req.use_fallback,
            raw_text[:50],
        )

        # ── CRITICAL: warn if a known intent falls back ────────────────
        if use_fallback and intent in self._cfg.intent_module_map:
            self._log.error(
                "DISPATCH_BUG | intent='%s' IS in intent_module_map but use_fallback=True! "
                "module_id='%s' — this is a routing bug.",
                intent, module_id,
            )

        return req

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _validate(self, payload: dict[str, Any]) -> None:
        if not isinstance(payload, dict):
            raise DispatchValidationError(
                f"Payload must be a dict, got {type(payload).__name__}"
            )
        if "intent" not in payload:
            raise DispatchValidationError("Payload missing required field: 'intent'")
        if "confidence" not in payload:
            raise DispatchValidationError("Payload missing required field: 'confidence'")

    def _resolve_intent(self, payload: dict[str, Any]) -> str:
        intent = str(payload.get("intent", "")).strip().lower()
        return intent if intent else "general"

    def _resolve_module(self, intent: str, use_fallback: bool) -> str:
        if use_fallback:
            return self._cfg.fallback_module
        return self._cfg.intent_module_map.get(intent, self._cfg.fallback_module)

    def _is_known_intent(self, intent: str) -> bool:
        return intent in self._cfg.intent_module_map

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_dispatcher_instance: Optional[RequestDispatcher] = None


def get_dispatcher(force_rebuild: bool = False) -> RequestDispatcher:
    """
    Returns the singleton RequestDispatcher.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        RequestDispatcher
    """
    global _dispatcher_instance
    if _dispatcher_instance is None or force_rebuild:
        _dispatcher_instance = RequestDispatcher()
    return _dispatcher_instance
