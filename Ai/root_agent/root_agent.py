# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: root_agent/root_agent.py
# Purpose: ROOT AGENT — Primary decision engine for the Pragati AI system.
#
# ARCHITECTURE:
#   User Message
#       ↓
#   Root Agent  ← THIS FILE (primary entry point)
#       ↓
#   Intent Engine (Local, trained model)
#       ↓
#   Intent Routing
#       ↓
#   Correct Local Module
#       ↓
#   Response
#
# RULES:
#   1. Intent Engine is ALWAYS called first — no exceptions.
#   2. OpenAI is NEVER the primary engine.
#   3. OpenAI may ONLY be used as optional fallback when:
#      - intent confidence is extremely low (< OPENAI_FALLBACK_THRESHOLD)
#      - AND no local module can handle the request
#      - AND OPENAI_FALLBACK_ENABLED env var is explicitly set to "true"
#   4. Greeting and Emergency intents are handled locally — OpenAI never called.
#   5. Every decision is logged: intent, confidence, route, module, fallback_used.
#
# PERFORMANCE:
#   Intent prediction target: < 100 ms
# =============================================================================

from __future__ import annotations

import logging
import os
import sys
import threading
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# PATH BOOTSTRAP
# ---------------------------------------------------------------------------
_AGENT_DIR = Path(__file__).resolve().parent   # root_agent/
_AI_ROOT   = _AGENT_DIR.parent                 # Ai/

for _p in (str(_AI_ROOT),):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

# Intents that MUST NEVER fall back to OpenAI — always handled locally
_LOCAL_ONLY_INTENTS = frozenset({
    "greeting",
    "emergency",
    "general",
    "crop",
    "disease",
    "pest",
    "soil",
    "fertilizer",
    "weather",
    "irrigation",
    "government",
    "market",
    "seed",
    "machinery",
})

# Confidence below this → consider fallback (but only if OpenAI fallback enabled)
_OPENAI_FALLBACK_THRESHOLD: float = float(
    os.getenv("ROOT_AGENT_OPENAI_THRESHOLD", "0.10")
)

# OpenAI fallback is DISABLED by default — must be explicitly opted in
_OPENAI_FALLBACK_ENABLED: bool = (
    os.getenv("OPENAI_FALLBACK_ENABLED", "false").lower() == "true"
)

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger() -> logging.Logger:
    logger = logging.getLogger("akp.root_agent")
    if logger.handlers:
        return logger

    level = getattr(logging, os.getenv("ROOT_AGENT_LOG_LEVEL", "INFO").upper(), logging.INFO)
    logger.setLevel(level)

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    log_dir = _AI_ROOT / "root_agent" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_dir / "root_agent.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


_log = _build_logger()

# ---------------------------------------------------------------------------
# ROOT AGENT
# ---------------------------------------------------------------------------

class RootAgent:
    """
    Primary decision engine for the Pragati AI system.

    Every user message MUST pass through this agent before any response
    is generated. The Root Agent:

      1. Receives the user message.
      2. Predicts intent using the trained local Intent Engine.
      3. Detects confidence score.
      4. If confidence is high → routes to the correct local module.
      5. If confidence is extremely low AND OpenAI fallback is explicitly
         enabled → uses OpenAI as last resort (never as primary).
      6. Greeting and Emergency intents are ALWAYS handled locally.

    Logs for every request:
      - Intent detected
      - Confidence score
      - Selected route
      - Selected module
      - Fallback used (Yes/No)

    Usage:
        agent = RootAgent()
        result = agent.process(
            text="मेरी फसल में बीमारी है",
            session_id="sess_001",
            farmer_id="f_123",
        )
    """

    def __init__(self) -> None:
        self._predictor: Any = None
        self._router:    Any = None
        self._predictor_lock = threading.Lock()
        self._router_lock    = threading.Lock()
        self._log = _log

    # ------------------------------------------------------------------
    # PRIMARY ENTRY POINT
    # ------------------------------------------------------------------

    def process(
        self,
        text:       str,
        session_id: str                        = "",
        farmer_id:  str                        = "",
        language:   Optional[str]              = None,
        location:   Optional[dict[str, Any]]   = None,
        extra:      Optional[dict[str, Any]]   = None,
    ) -> dict[str, Any]:
        """
        Processes a user text message through the full local AI pipeline.

        Flow:
            text → Intent Engine → Root Agent routing → Local Module → Response

        Args:
            text:       User input text (any language).
            session_id: Optional session identifier.
            farmer_id:  Optional farmer identifier.
            language:   Optional explicit language override.
            location:   Optional location context.
            extra:      Optional extra metadata.

        Returns:
            Unified response dict with routing metadata.
        """
        t_start = time.perf_counter()

        if not text or not text.strip():
            return self._empty_input_response(session_id, farmer_id)

        # ── Inject session context into extra payload ─────────────────
        try:
            from knowledge_base.session_store import get_session_store, Slot
            _store = get_session_store()
            _store.increment_turn(session_id)
            if location:
                _store.set(session_id, Slot.LOCATION, location)
            if farmer_id:
                _store.set(session_id, Slot.FARMER_ID, farmer_id)
            _session_ctx = {
                "active_disease": _store.get(session_id, Slot.ACTIVE_DISEASE),
                "active_crop":    _store.get(session_id, Slot.ACTIVE_CROP),
                "last_yolo":      _store.get(session_id, Slot.LAST_YOLO_RESULT),
                "turn_count":     _store.get(session_id, Slot.TURN_COUNT),
            }
            extra = {**(extra or {}), "session_context": _session_ctx}
        except Exception:
            pass

        # ── Step 1: Intent Engine (LOCAL — always first) ──────────────
        t_intent = time.perf_counter()
        intent_payload = self._predict_intent(text, session_id)
        intent_ms = round((time.perf_counter() - t_intent) * 1000.0, 2)

        intent     = intent_payload.get("intent", "general")
        confidence = float(intent_payload.get("confidence", 0.0))
        is_unknown = bool(intent_payload.get("is_unknown", False))

        # ── Step 2: Routing decision ──────────────────────────────────
        use_openai_fallback, fallback_reason = self._should_use_openai_fallback(
            intent, confidence, is_unknown
        )

        # ── Step 3: Log routing decision ─────────────────────────────
        self._log_routing(
            text=text,
            intent=intent,
            confidence=confidence,
            intent_ms=intent_ms,
            use_openai_fallback=use_openai_fallback,
            fallback_reason=fallback_reason,
            session_id=session_id,
        )

        # ── Step 4: Route to local module ─────────────────────────────
        if not use_openai_fallback:
            result = self._route_local(
                intent_payload=intent_payload,
                session_id=session_id,
                farmer_id=farmer_id,
                location=location,
                extra=extra,
            )
            result["fallback_used"]   = False
            result["fallback_engine"] = None
            result["intent_ms"]       = intent_ms
            result["total_ms"]        = round((time.perf_counter() - t_start) * 1000.0, 2)
            # ── Update session store with response language ───────────
            try:
                from knowledge_base.session_store import get_session_store, Slot
                _store = get_session_store()
                _resp_lang = result.get("language", language or "hi")
                _store.set(session_id, Slot.LANGUAGE, _resp_lang)
                _store.set(session_id, Slot.ACTIVE_INTENT, intent)
                _store.set(session_id, Slot.ACTIVE_MODULE, result.get("module_id", ""))
                _resp_msg = result.get("message", "")
                if _resp_msg:
                    _store.set(session_id, Slot.LAST_RESPONSE, str(_resp_msg)[:500])
            except Exception:
                pass
            return result

        # ── Step 5: OpenAI fallback (OPTIONAL, LAST RESORT ONLY) ─────
        result = self._openai_fallback(
            text=text,
            intent=intent,
            confidence=confidence,
            session_id=session_id,
            farmer_id=farmer_id,
            language=language,
            fallback_reason=fallback_reason,
        )
        result["fallback_used"]   = True
        result["fallback_engine"] = "openai"
        result["intent_ms"]       = intent_ms
        result["total_ms"]        = round((time.perf_counter() - t_start) * 1000.0, 2)
        return result

    # ------------------------------------------------------------------
    # INTENT PREDICTION
    # ------------------------------------------------------------------

    def _predict_intent(self, text: str, session_id: str) -> dict[str, Any]:
        """Calls the local Intent Engine. Never calls OpenAI."""
        # ── Step 0: Alias resolver (runs BEFORE ML model) ─────────────
        try:
            from intent_engine.intent_alias_resolver import resolve_alias
            alias_intent = resolve_alias(text)
            if alias_intent:
                self._log.info(
                    "DEBUG | Raw='%s' | AliasResolver=HIT | Intent=%s | Conf=1.0",
                    text, alias_intent,
                )
                return {
                    "intent":     alias_intent,
                    "confidence": 1.0,
                    "is_unknown": False,
                    "text":       text,
                    "language":   "latin",
                    "timestamp":  "",
                    "top":        [{"intent": alias_intent, "confidence": 1.0}],
                    "success":    True,
                    "error":      "",
                }
        except Exception as alias_exc:
            self._log.warning("Alias resolver error: %s", alias_exc)

        predictor = self._get_predictor()
        if predictor is None:
            self._log.error("Intent Engine unavailable — using general fallback")
            return {
                "intent":     "general",
                "confidence": 0.0,
                "is_unknown": True,
                "text":       text,
                "language":   "latin",
                "timestamp":  "",
                "top":        [],
                "success":    False,
                "error":      "Intent Engine unavailable",
            }

        try:
            result  = predictor.predict(text, metadata={"session_id": session_id})
            payload = result.to_router_payload()

            self._log.info(
                "DEBUG | Raw='%s' | MLModel=HIT | Intent=%s | Conf=%.4f | "
                "IsUnknown=%s | Lang=%s",
                text, payload.get("intent"), payload.get("confidence"),
                payload.get("is_unknown"), payload.get("language"),
            )

            # Remap "unknown" intent to "general" so it always hits a local module
            if payload.get("intent") == "unknown":
                self._log.warning(
                    "DEBUG | Raw='%s' | MLModel returned 'unknown' (conf=%.4f < threshold) "
                    "→ remapping to 'general'",
                    text, payload.get("confidence", 0.0),
                )
                payload["intent"]     = "general"
                payload["is_unknown"] = False
            payload["success"] = True
            payload["error"]   = ""
            return payload
        except Exception as exc:
            self._log.error("Intent prediction error: %s", exc, exc_info=True)
            return {
                "intent":     "general",
                "confidence": 0.0,
                "is_unknown": True,
                "text":       text,
                "language":   "latin",
                "timestamp":  "",
                "top":        [],
                "success":    False,
                "error":      str(exc),
            }

    # ------------------------------------------------------------------
    # ROUTING DECISION
    # ------------------------------------------------------------------

    def _should_use_openai_fallback(
        self,
        intent:     str,
        confidence: float,
        is_unknown: bool,
    ) -> tuple[bool, str]:
        """
        Determines whether OpenAI fallback should be used.

        Returns (use_openai, reason).

        OpenAI is NEVER used for:
          - Any intent in _LOCAL_ONLY_INTENTS
          - When OPENAI_FALLBACK_ENABLED is not explicitly "true"
          - When confidence >= OPENAI_FALLBACK_THRESHOLD
        """
        # Greeting and Emergency: ALWAYS local, NEVER OpenAI
        if intent in ("greeting", "emergency"):
            return False, ""

        # All known intents: always local
        if intent in _LOCAL_ONLY_INTENTS:
            return False, ""

        # OpenAI fallback disabled (default)
        if not _OPENAI_FALLBACK_ENABLED:
            return False, ""

        # Only consider OpenAI if confidence is extremely low
        if confidence >= _OPENAI_FALLBACK_THRESHOLD:
            return False, ""

        return True, f"extremely_low_confidence:{confidence:.4f}"

    # ------------------------------------------------------------------
    # LOCAL ROUTING
    # ------------------------------------------------------------------

    def _route_local(
        self,
        intent_payload: dict[str, Any],
        session_id:     str,
        farmer_id:      str,
        location:       Optional[dict[str, Any]],
        extra:          Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """Routes the intent payload to the correct local Knowledge Router module."""
        router = self._get_router()
        if router is None:
            return {
                "status":    "error",
                "intent":    intent_payload.get("intent", "general"),
                "confidence": intent_payload.get("confidence", 0.0),
                "module_id": "general_ai",
                "message":   "Knowledge Router unavailable. Please try again.",
                "error":     "router_unavailable",
                "data":      None,
                "suggestions": [],
            }

        try:
            return router.route(
                payload    = intent_payload,
                session_id = session_id,
                farmer_id  = farmer_id,
                location   = location,
                extra      = extra,
            )
        except Exception as exc:
            self._log.error("Local routing error: %s", exc, exc_info=True)
            return {
                "status":    "error",
                "intent":    intent_payload.get("intent", "general"),
                "confidence": intent_payload.get("confidence", 0.0),
                "module_id": "general_ai",
                "message":   "Routing error. Please try again.",
                "error":     str(exc),
                "data":      None,
                "suggestions": [],
            }

    # ------------------------------------------------------------------
    # OPENAI FALLBACK (OPTIONAL, LAST RESORT)
    # ------------------------------------------------------------------

    def _openai_fallback(
        self,
        text:           str,
        intent:         str,
        confidence:     float,
        session_id:     str,
        farmer_id:      str,
        language:       Optional[str],
        fallback_reason: str,
    ) -> dict[str, Any]:
        """
        Optional OpenAI fallback — called ONLY when:
          - OPENAI_FALLBACK_ENABLED=true is explicitly set
          - confidence is extremely low
          - intent is not in _LOCAL_ONLY_INTENTS

        This is NEVER the primary engine.
        """
        self._log.warning(
            "OPENAI_FALLBACK | session=%s intent=%s conf=%.4f reason=%s",
            session_id, intent, confidence, fallback_reason,
        )

        try:
            import openai
            api_key = os.getenv("OPENAI_API_KEY", "")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set")

            client = openai.OpenAI(api_key=api_key)
            system_prompt = (
                "You are Pragati AI, an agricultural assistant for Indian farmers. "
                "Answer only farming-related questions. Be concise and helpful."
            )
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": text},
                ],
                max_tokens=300,
                temperature=0.3,
            )
            answer = response.choices[0].message.content or ""
            return {
                "status":          "success",
                "intent":          intent,
                "confidence":      confidence,
                "module_id":       "openai_fallback",
                "message":         answer,
                "data":            None,
                "suggestions":     [],
                "fallback_reason": fallback_reason,
                "error":           "",
            }
        except Exception as exc:
            self._log.error("OpenAI fallback error: %s", exc)
            # Even OpenAI fallback failed — return local general response
            lang = language or "en"
            if lang in ("hi", "devanagari", "raj", "mr", "mew"):
                msg = "मुझे आपका प्रश्न समझ नहीं आया। कृपया अधिक जानकारी दें।"
            else:
                msg = "I could not understand your query. Please provide more details."
            return {
                "status":          "fallback",
                "intent":          intent,
                "confidence":      confidence,
                "module_id":       "general_ai",
                "message":         msg,
                "data":            None,
                "suggestions":     [],
                "fallback_reason": f"openai_failed:{exc}",
                "error":           str(exc),
            }

    # ------------------------------------------------------------------
    # LOGGING
    # ------------------------------------------------------------------

    def _log_routing(
        self,
        text:               str,
        intent:             str,
        confidence:         float,
        intent_ms:          float,
        use_openai_fallback: bool,
        fallback_reason:    str,
        session_id:         str,
    ) -> None:
        """Structured routing log — intent, confidence, route, module, fallback."""
        from knowledge_router.config import INTENT_MODULE_MAP, DEFAULT_FALLBACK_MODULE
        module = INTENT_MODULE_MAP.get(intent, DEFAULT_FALLBACK_MODULE)
        route  = "openai_fallback" if use_openai_fallback else f"local:{module}"

        self._log.info(
            "ROUTING | session=%-20s | intent=%-12s | confidence=%.4f | "
            "route=%-30s | module=%-20s | fallback_used=%-3s | intent_ms=%.1fms | text='%s'",
            session_id or "—",
            intent,
            confidence,
            route,
            "openai_fallback" if use_openai_fallback else module,
            "YES" if use_openai_fallback else "NO",
            intent_ms,
            text[:60],
        )

        # ── CRITICAL DEBUG: warn if market/weather/etc goes to general_ai ──
        _SHOULD_NEVER_BE_GENERAL = {
            "market", "weather", "government", "soil", "fertilizer",
            "disease", "crop", "seed", "irrigation", "machinery",
            "greeting", "emergency",
        }
        if intent in _SHOULD_NEVER_BE_GENERAL and module == DEFAULT_FALLBACK_MODULE:
            self._log.error(
                "ROUTING_BUG | intent='%s' is being routed to '%s' — "
                "this should NEVER happen! Check INTENT_MODULE_MAP.",
                intent, DEFAULT_FALLBACK_MODULE,
            )

    # ------------------------------------------------------------------
    # EMPTY INPUT
    # ------------------------------------------------------------------

    def _empty_input_response(self, session_id: str, farmer_id: str) -> dict[str, Any]:
        self._log.warning("Empty input received | session=%s", session_id)
        return {
            "status":          "fallback",
            "intent":          "unknown",
            "confidence":      0.0,
            "module_id":       "general_ai",
            "message":         "Please enter your query. / कृपया अपना प्रश्न लिखें।",
            "data":            None,
            "suggestions":     [],
            "fallback_reason": "empty_input",
            "fallback_used":   False,
            "fallback_engine": None,
            "error":           "",
            "intent_ms":       0.0,
            "total_ms":        0.0,
        }

    # ------------------------------------------------------------------
    # LAZY LOADERS
    # ------------------------------------------------------------------

    def _get_predictor(self) -> Any:
        with self._predictor_lock:
            if self._predictor is not None:
                return self._predictor
            try:
                from intent_engine.predictor import get_predictor
                self._predictor = get_predictor()
                self._log.info(
                    "Intent Engine loaded | model=%s",
                    self._predictor.get_model_info().get("trained_at", "?"),
                )
            except Exception as exc:
                self._log.error(
                    "CRITICAL: Intent Engine failed to load: %s — "
                    "server will return error responses until model is available.",
                    exc,
                )
                return None
        return self._predictor

    def _get_router(self) -> Any:
        with self._router_lock:
            if self._router is not None:
                return self._router
            try:
                from knowledge_router.router import get_router
                self._router = get_router()
                self._log.info("Knowledge Router loaded")
            except Exception as exc:
                self._log.error("Knowledge Router failed to load: %s", exc)
                return None
        return self._router

    # ------------------------------------------------------------------
    # HEALTH
    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Returns health status of the Root Agent and its dependencies."""
        predictor = self._get_predictor()
        router    = self._get_router()

        intent_info: dict[str, Any] = {}
        if predictor is not None:
            try:
                intent_info = predictor.get_model_info()
            except Exception:
                pass

        return {
            "root_agent":            "ready",
            "intent_engine":         "loaded" if predictor is not None else "unavailable",
            "knowledge_router":      "loaded" if router    is not None else "unavailable",
            "openai_fallback":       "enabled" if _OPENAI_FALLBACK_ENABLED else "disabled",
            "openai_threshold":      _OPENAI_FALLBACK_THRESHOLD,
            "local_only_intents":    sorted(_LOCAL_ONLY_INTENTS),
            "intent_model_info":     intent_info,
        }


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_root_agent_instance: Optional[RootAgent] = None
_root_agent_lock = threading.Lock()


def get_root_agent(force_rebuild: bool = False) -> RootAgent:
    """
    Returns the singleton RootAgent.

    The Root Agent loads the Intent Engine on first call.
    If the model cannot load, a proper error is returned without crashing.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        RootAgent
    """
    global _root_agent_instance
    with _root_agent_lock:
        if _root_agent_instance is None or force_rebuild:
            _root_agent_instance = RootAgent()
            # Eagerly load Intent Engine to catch model errors at startup
            _root_agent_instance._get_predictor()
            _root_agent_instance._get_router()
    return _root_agent_instance


# ---------------------------------------------------------------------------
# CLI SELF-TEST
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    agent = get_root_agent()

    print("\n" + "=" * 60)
    print("  Pragati AI — Root Agent Health")
    print("=" * 60)
    print(json.dumps(agent.health(), indent=2, ensure_ascii=False))

    test_inputs = [
        ("Namaste", "greeting"),
        ("Hello", "greeting"),
        ("मेरी फसल में बीमारी है", "disease"),
        ("आज मौसम कैसा है", "weather"),
        ("मंडी भाव बताओ", "market"),
        ("सरकारी योजना", "government"),
        ("What can you do?", "general"),
        ("Emergency! My crop is dying!", "emergency"),
    ]

    print("\n" + "=" * 60)
    print("  Root Agent Routing Tests")
    print("=" * 60)
    for text, expected in test_inputs:
        result = agent.process(text=text, session_id="test_001")
        intent     = result.get("intent", "?")
        confidence = result.get("confidence", 0.0)
        module     = result.get("module_id", "?")
        fallback   = result.get("fallback_used", False)
        intent_ms  = result.get("intent_ms", 0.0)
        status     = "✓" if intent == expected else "?"
        print(
            f"  {status} [{expected:<12}] text='{text[:30]:<30}' "
            f"→ intent={intent:<12} conf={confidence:.3f} "
            f"module={module:<20} fallback={'YES' if fallback else 'NO '} "
            f"intent_ms={intent_ms:.1f}ms"
        )
    print("=" * 60 + "\n")
