# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/router.py
# Purpose: Central orchestrator of the Knowledge Router.
#          Accepts intent payloads from the Intent Engine, resolves the
#          correct AI module, executes it, and returns a unified response.
#          Continues gracefully on any module failure.
# =============================================================================

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from typing import Any, Optional

from knowledge_router.config import KnowledgeRouterConfig, get_config
from knowledge_router.fallback_handler import FallbackHandler, get_fallback_handler
from knowledge_router.module_manager import ModuleManager, get_module_manager
from knowledge_router.request_dispatcher import (
    DispatchRequest,
    DispatchValidationError,
    RequestDispatcher,
    get_dispatcher,
)
from knowledge_router.response_formatter import ResponseFormatter, get_formatter

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: KnowledgeRouterConfig) -> logging.Logger:
    logger = logging.getLogger("akp.router.core")
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

    log_file = cfg.logs_dir / "router.log"
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
# KNOWLEDGE ROUTER
# ---------------------------------------------------------------------------

class KnowledgeRouter:
    """
    Central orchestrator for the Pragati AI Knowledge Router.

    Pipeline:
        1. Validate & enrich payload  → RequestDispatcher
        2. Resolve target module      → ModuleManager
        3. Execute module handler     → module.handle(request)
        4. Handle failures/fallbacks  → FallbackHandler
        5. Format unified response    → ResponseFormatter

    Supported modules:
        disease_ai, crop_ai, soil_analysis, weather, market,
        government_schemes, fertilizer, irrigation, seed,
        machinery, general_ai

    Usage:
        router = KnowledgeRouter()
        result = router.route(intent_payload)

        # With optional caller context
        result = router.route(
            payload    = intent_payload,
            session_id = "sess_abc",
            farmer_id  = "farmer_123",
            location   = {"state": "Rajasthan", "district": "Jaipur"},
        )
    """

    def __init__(
        self,
        cfg:        Optional[KnowledgeRouterConfig] = None,
        dispatcher: Optional[RequestDispatcher]     = None,
        manager:    Optional[ModuleManager]         = None,
        fallback:   Optional[FallbackHandler]       = None,
        formatter:  Optional[ResponseFormatter]     = None,
    ) -> None:
        self._cfg       = cfg       or get_config()
        self._log       = _build_logger(self._cfg)
        self._dispatcher = dispatcher or get_dispatcher()
        self._manager    = manager    or get_module_manager()
        self._fallback   = fallback   or get_fallback_handler()
        self._formatter  = formatter  or get_formatter()

        self._log.info(
            "KnowledgeRouter initialised — version=%s  modules=%d",
            self._cfg.router_version,
            len(self._manager.list_modules()),
        )

    # ------------------------------------------------------------------
    # PRIMARY ENTRY POINT
    # ------------------------------------------------------------------

    def route(
        self,
        payload:    dict[str, Any],
        session_id: str                        = "",
        farmer_id:  str                        = "",
        location:   Optional[dict[str, Any]]   = None,
        extra:      Optional[dict[str, Any]]   = None,
    ) -> dict[str, Any]:
        """
        Routes an Intent Engine payload to the correct AI module.

        Args:
            payload:    Dict from PredictionResult.to_router_payload().
            session_id: Optional caller session identifier.
            farmer_id:  Optional farmer identifier for personalisation.
            location:   Optional location context dict.
            extra:      Optional additional metadata.

        Returns:
            Unified response envelope dict (always — never raises).

        Response envelope keys:
            status, router_version, intent, confidence, module_id,
            language, session_id, farmer_id, data, message,
            suggestions, fallback_reason, error, routed_at, responded_at
        """
        req: Optional[DispatchRequest] = None

        try:
            # ── Step 1: Validate & enrich ──────────────────────────────
            req = self._dispatcher.dispatch(
                payload    = payload,
                session_id = session_id,
                farmer_id  = farmer_id,
                location   = location,
                extra      = extra,
            )

            # ── Step 2: Fallback path ──────────────────────────────────
            if req.use_fallback:
                fallback_result = self._fallback.handle_unknown(req)
                return self._formatter.format_fallback(fallback_result)

            # ── Step 3: Resolve & execute module ──────────────────────
            handler       = self._manager.get_handler(req.module_id)
            module_request = req.to_module_request()

            try:
                module_result = handler(module_request)
            except Exception as module_exc:
                self._log.error(
                    "Module '%s' raised an exception: %s",
                    req.module_id, module_exc, exc_info=True,
                )
                fallback_result = self._fallback.handle_module_failure(
                    req   = req,
                    error = f"{type(module_exc).__name__}: {module_exc}",
                )
                return self._formatter.format_fallback(fallback_result)

            # ── Step 4: Format success ─────────────────────────────────
            return self._formatter.format_success(req, module_result)

        except DispatchValidationError as val_exc:
            language = str(payload.get("language", "latin")) if isinstance(payload, dict) else "latin"
            fallback_result = self._fallback.handle_validation_error(
                error    = str(val_exc),
                language = language,
            )
            return self._formatter.format_fallback(fallback_result)

        except Exception as exc:
            self._log.critical(
                "Unhandled router exception: %s", exc, exc_info=True
            )
            return self._formatter.format_error(req, exc)

    # ------------------------------------------------------------------
    # CONVENIENCE METHODS
    # ------------------------------------------------------------------

    def route_from_text(
        self,
        text:       str,
        session_id: str                        = "",
        farmer_id:  str                        = "",
        location:   Optional[dict[str, Any]]   = None,
    ) -> dict[str, Any]:
        """
        Routes a raw text string by running it through the Intent Engine
        predictor first, then routing the result.

        Args:
            text:       Raw input text (Hindi, English, or mixed).
            session_id: Optional caller session identifier.
            farmer_id:  Optional farmer identifier.
            location:   Optional location context dict.

        Returns:
            Unified response envelope dict.
        """
        if not text or not text.strip():
            fallback_result = self._fallback.handle_empty_input()
            return self._formatter.format_fallback(fallback_result)

        try:
            # Import here to avoid circular dependency at module load time
            import sys as _sys
            ai_root_str = str(self._cfg.ai_root)
            if ai_root_str not in _sys.path:
                _sys.path.insert(0, ai_root_str)

            from intent_engine.predictor import get_predictor
            predictor = get_predictor()
            prediction = predictor.predict(text, metadata={"session_id": session_id})
            payload    = prediction.to_router_payload()

        except Exception as exc:
            self._log.error("Intent Engine error: %s", exc, exc_info=True)
            # Build a minimal unknown payload and let the fallback handle it
            payload = {
                "intent":     "general",
                "confidence": 0.0,
                "is_unknown": True,
                "text":       text.strip(),
                "language":   "latin",
                "timestamp":  "",
                "top":        [],
            }

        return self.route(
            payload    = payload,
            session_id = session_id,
            farmer_id  = farmer_id,
            location   = location,
        )

    def health_check(self) -> dict[str, Any]:
        """
        Returns the health status of the router and all registered modules.

        Returns:
            Dict with router version, module statuses, and loaded count.
        """
        modules      = self._manager.list_modules()
        loaded_count = sum(1 for m in modules if m["is_loaded"])
        return {
            "router_version": self._cfg.router_version,
            "status":         "healthy" if loaded_count > 0 else "degraded",
            "modules_total":  len(modules),
            "modules_loaded": loaded_count,
            "modules":        modules,
        }


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_router_instance: Optional[KnowledgeRouter] = None


def get_router(force_rebuild: bool = False) -> KnowledgeRouter:
    """
    Returns the singleton KnowledgeRouter.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        KnowledgeRouter: Ready-to-use.
    """
    global _router_instance
    if _router_instance is None or force_rebuild:
        _router_instance = KnowledgeRouter()
    return _router_instance


# ---------------------------------------------------------------------------
# CONVENIENCE FUNCTION
# ---------------------------------------------------------------------------

def route_intent(
    payload:    dict[str, Any],
    session_id: str                        = "",
    farmer_id:  str                        = "",
    location:   Optional[dict[str, Any]]   = None,
) -> dict[str, Any]:
    """
    One-call routing from an Intent Engine payload.

    Args:
        payload:    Dict from PredictionResult.to_router_payload().
        session_id: Optional caller session identifier.
        farmer_id:  Optional farmer identifier.
        location:   Optional location context dict.

    Returns:
        Unified response envelope dict.

    Usage:
        from knowledge_router.router import route_intent
        result = route_intent(prediction.to_router_payload())
    """
    return get_router().route(
        payload    = payload,
        session_id = session_id,
        farmer_id  = farmer_id,
        location   = location,
    )


# ---------------------------------------------------------------------------
# CLI ENTRY POINT
# ---------------------------------------------------------------------------

def _cli() -> None:
    import argparse
    import json

    parser = argparse.ArgumentParser(
        prog="python -m knowledge_router.router",
        description="AKP Knowledge Router — Route intent payloads to AI modules",
    )
    subparsers = parser.add_subparsers(dest="command")

    # --- route ---
    p_route = subparsers.add_parser("route", help="Route a text query")
    p_route.add_argument("text", help="Input text to route")
    p_route.add_argument("--session", default="", dest="session_id")
    p_route.add_argument("--farmer",  default="", dest="farmer_id")

    # --- health ---
    subparsers.add_parser("health", help="Show router health status")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    router = KnowledgeRouter()

    if args.command == "health":
        print(json.dumps(router.health_check(), indent=2, ensure_ascii=False))
        return

    if args.command == "route":
        result = router.route_from_text(
            text       = args.text,
            session_id = args.session_id,
            farmer_id  = args.farmer_id,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _cli()
