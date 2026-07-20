# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/response_generator.py
# Purpose: Assembles the final unified API response envelope from pipeline
#          stage outputs. Handles text, voice, and image pipelines uniformly.
#          Computes processing metrics. Thread-safe singleton.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from pragati_ai_controller.config import CONTROLLER_VERSION, PragatiAIConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.response_generator")
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
        filename=cfg.logs_dir / "response_generator.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# RESPONSE GENERATOR
# ---------------------------------------------------------------------------

class ResponseGenerator:
    """
    Assembles the final unified response envelope for all pipeline types.

    Envelope schema:
        {
            "success":          bool,
            "version":          str,
            "pipeline":         "text" | "voice" | "image",
            "session_id":       str,
            "farmer_id":        str,
            "language":         str,
            "intent":           str,
            "confidence":       float,
            "module_id":        str,
            "response_text":    str,
            "response_audio":   str | None,   # WAV path if TTS was run
            "knowledge":        dict | None,  # KnowledgeResult.to_dict() for image
            "router_data":      dict | None,  # raw router envelope data field
            "suggestions":      list[str],
            "fallback_reason":  str,
            "error":            str,
            "metrics": {
                "total_ms":       float,
                "stt_ms":         float,
                "intent_ms":      float,
                "router_ms":      float,
                "tts_ms":         float,
                "inference_ms":   float,
                "knowledge_ms":   float,
            },
            "timestamp":        str,
        }
    """

    def __init__(self, cfg: Optional[PragatiAIConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def build(
        self,
        pipeline:       str,
        session_id:     str,
        farmer_id:      str,
        language:       str,
        router_result:  Optional[dict[str, Any]],
        knowledge:      Optional[dict[str, Any]] = None,
        response_audio: Optional[str]            = None,
        error:          str                      = "",
        metrics:        Optional[dict[str, float]] = None,
    ) -> dict[str, Any]:
        """
        Builds the final response envelope.

        Args:
            pipeline:       "text" | "voice" | "image"
            session_id:     Session identifier.
            farmer_id:      Farmer identifier.
            language:       Resolved language code.
            router_result:  Knowledge Router response envelope (may be None on error).
            knowledge:      KnowledgeResult.to_dict() for image pipeline.
            response_audio: Path to synthesised WAV file (voice pipeline).
            error:          Top-level error string if pipeline failed.
            metrics:        Timing dict with *_ms keys.

        Returns:
            Unified response envelope dict.
        """
        rr = router_result or {}
        success = not bool(error) and rr.get("status") != "error"

        response_text = self._extract_response_text(rr, knowledge, language)

        envelope: dict[str, Any] = {
            "success":         success,
            "version":         CONTROLLER_VERSION,
            "pipeline":        pipeline,
            "session_id":      session_id,
            "farmer_id":       farmer_id,
            "language":        language,
            "intent":          rr.get("intent", "unknown"),
            "confidence":      float(rr.get("confidence", 0.0)),
            "module_id":       rr.get("module_id", ""),
            "response_text":   response_text,
            "response_audio":  response_audio,
            "knowledge":       knowledge,
            "router_data":     rr.get("data"),
            "suggestions":     list(rr.get("suggestions", [])),
            "fallback_reason": rr.get("fallback_reason", ""),
            "error":           error or rr.get("error", ""),
            "metrics":         self._normalise_metrics(metrics),
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }

        self._log.info(
            "response | pipeline=%-6s success=%s intent=%-15s lang=%s session=%s",
            pipeline, success, envelope["intent"], language, session_id,
        )
        return envelope

    def build_error(
        self,
        pipeline:   str,
        session_id: str,
        farmer_id:  str,
        language:   str,
        error:      str,
        metrics:    Optional[dict[str, float]] = None,
    ) -> dict[str, Any]:
        """Builds a top-level error envelope when the pipeline itself fails."""
        self._log.error("pipeline error | %s | %s", pipeline, error)
        return {
            "success":         False,
            "version":         CONTROLLER_VERSION,
            "pipeline":        pipeline,
            "session_id":      session_id,
            "farmer_id":       farmer_id,
            "language":        language,
            "intent":          "unknown",
            "confidence":      0.0,
            "module_id":       "",
            "response_text":   self._error_message(language),
            "response_audio":  None,
            "knowledge":       None,
            "router_data":     None,
            "suggestions":     [],
            "fallback_reason": "",
            "error":           error,
            "metrics":         self._normalise_metrics(metrics),
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_response_text(
        rr:       dict[str, Any],
        knowledge: Optional[dict[str, Any]],
        language:  str,
    ) -> str:
        # Image pipeline: use knowledge description
        if knowledge and knowledge.get("found"):
            parts = []
            if knowledge.get("description"):
                parts.append(knowledge["description"])
            if knowledge.get("symptoms"):
                parts.append(knowledge["symptoms"])
            if knowledge.get("organic_solution"):
                parts.append(knowledge["organic_solution"])
            if parts:
                return " ".join(parts)

        # Text/voice pipeline: use router message
        msg = str(rr.get("message", "")).strip()
        if msg:
            return msg

        # Fallback generic message
        if language in ("hi", "raj", "mr", "mew"):
            return "मैं आपकी सहायता के लिए यहाँ हूँ।"
        return "I am here to help you."

    @staticmethod
    def _error_message(language: str) -> str:
        if language in ("hi", "raj", "mr", "mew"):
            return "एक त्रुटि हुई। कृपया पुनः प्रयास करें।"
        return "An error occurred. Please try again."

    @staticmethod
    def _normalise_metrics(metrics: Optional[dict[str, float]]) -> dict[str, float]:
        keys = ("total_ms", "stt_ms", "intent_ms", "router_ms",
                "tts_ms", "inference_ms", "knowledge_ms")
        base = {k: 0.0 for k in keys}
        if metrics:
            for k in keys:
                if k in metrics:
                    base[k] = round(float(metrics[k]), 2)
        return base


# ---------------------------------------------------------------------------
# SINGLETON
# ---------------------------------------------------------------------------

_rg_instance: Optional[ResponseGenerator] = None
_rg_lock = threading.Lock()


def get_response_generator(force_rebuild: bool = False) -> ResponseGenerator:
    global _rg_instance
    with _rg_lock:
        if _rg_instance is None or force_rebuild:
            _rg_instance = ResponseGenerator()
    return _rg_instance
