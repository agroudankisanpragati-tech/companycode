# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/ai_manager.py
# Purpose: Wraps all upstream AI modules (STT, Intent Engine, Knowledge
#          Router, Voice Generator) with fault-tolerant lazy loading.
#          Provides a single validated interface for the controller.
#          Never crashes — returns structured error dicts on failure.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path
from typing import Any, Optional

from pragati_ai_controller.config import PragatiAIConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.ai_manager")
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
    from logging.handlers import RotatingFileHandler
    fh = RotatingFileHandler(
        filename=cfg.logs_dir / "ai_manager.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# MODULE STATUS
# ---------------------------------------------------------------------------

class ModuleStatus:
    AVAILABLE   = "available"
    UNAVAILABLE = "unavailable"
    NOT_LOADED  = "not_loaded"


# ---------------------------------------------------------------------------
# AI MANAGER
# ---------------------------------------------------------------------------

class AIManager:
    """
    Centralised manager for all upstream AI modules used by the controller.

    Modules managed:
        - Speech-to-Text  (speech_to_text.transcriber.Transcriber)
        - Intent Engine   (intent_engine.predictor.Predictor)
        - Knowledge Router(knowledge_router.router.KnowledgeRouter)
        - Voice Generator (voice_generator.voice_generator.PiperTTSEngine)

    All modules are lazy-loaded on first use. A failed module is marked
    unavailable and the controller continues without it.

    Thread-safe via per-module locks.

    Usage:
        am = AIManager()
        result = am.transcribe(audio_path)
        prediction = am.predict_intent(text)
        response = am.route(payload, session_id=sid)
        ok = am.synthesize(text, output_path)
    """

    def __init__(self, cfg: Optional[PragatiAIConfig] = None) -> None:
        self._cfg  = cfg or get_config()
        self._log  = _build_logger(self._cfg)

        # Lazy module references
        self._stt:    Any = None
        self._intent: Any = None
        self._router: Any = None
        self._tts:    Any = None

        # Status tracking
        self._status: dict[str, str] = {
            "stt":    ModuleStatus.NOT_LOADED,
            "intent": ModuleStatus.NOT_LOADED,
            "router": ModuleStatus.NOT_LOADED,
            "tts":    ModuleStatus.NOT_LOADED,
        }

        # Per-module locks
        self._stt_lock    = threading.Lock()
        self._intent_lock = threading.Lock()
        self._router_lock = threading.Lock()
        self._tts_lock    = threading.Lock()

        # Ensure Ai/ is on sys.path for all upstream imports
        ai_root_str = str(self._cfg.ai_root)
        if ai_root_str not in sys.path:
            sys.path.insert(0, ai_root_str)

    # ------------------------------------------------------------------
    # SPEECH-TO-TEXT
    # ------------------------------------------------------------------

    def transcribe(
        self,
        audio_path: str | Path,
        language:   Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Transcribes an audio file to text using Faster-Whisper.

        Args:
            audio_path: Path to the audio file.
            language:   Optional forced language code (e.g. "hi").

        Returns:
            Dict with keys: success, text, language, language_probability,
            duration_s, transcription_time_s, segments, error.
        """
        stt = self._get_stt()
        if stt is None:
            return self._unavailable_result("stt", "Speech-to-Text module unavailable")

        try:
            result = stt.transcribe(Path(audio_path), language=language)
            return {
                "success":              True,
                "text":                 result.text,
                "language":             result.language,
                "language_probability": result.language_probability,
                "duration_s":           result.duration_s,
                "transcription_time_s": result.transcription_time_s,
                "segments":             [
                    {
                        "id":         s.id,
                        "start":      s.start,
                        "end":        s.end,
                        "text":       s.text,
                        "confidence": s.confidence,
                    }
                    for s in result.segments
                ],
                "error": "",
            }
        except Exception as exc:
            self._log.error("STT transcribe error: %s", exc, exc_info=True)
            return self._unavailable_result("stt", f"{type(exc).__name__}: {exc}")

    # ------------------------------------------------------------------
    # INTENT ENGINE
    # ------------------------------------------------------------------

    def predict_intent(
        self,
        text:     str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Predicts the intent of a text string.

        Args:
            text:     Raw input text.
            metadata: Optional metadata forwarded to the predictor.

        Returns:
            Dict from PredictionResult.to_router_payload() plus success/error.
        """
        predictor = self._get_intent()
        if predictor is None:
            return {
                "success":    False,
                "intent":     "general",
                "confidence": 0.0,
                "is_unknown": True,
                "text":       text,
                "language":   "latin",
                "timestamp":  "",
                "top":        [],
                "error":      "Intent Engine unavailable",
            }

        try:
            result  = predictor.predict(text, metadata=metadata)
            payload = result.to_router_payload()
            payload["success"] = True
            payload["error"]   = ""
            return payload
        except Exception as exc:
            self._log.error("Intent predict error: %s", exc, exc_info=True)
            return {
                "success":    False,
                "intent":     "general",
                "confidence": 0.0,
                "is_unknown": True,
                "text":       text,
                "language":   "latin",
                "timestamp":  "",
                "top":        [],
                "error":      f"{type(exc).__name__}: {exc}",
            }

    def predict_intent_from_stt(self, stt_output: dict[str, Any]) -> dict[str, Any]:
        """
        Predicts intent directly from a Speech-to-Text output dict.

        Args:
            stt_output: Dict with at least a "text" key.

        Returns:
            Same schema as predict_intent().
        """
        predictor = self._get_intent()
        if predictor is None:
            text = stt_output.get("text", "")
            return self.predict_intent(text)

        try:
            result  = predictor.predict_from_stt(stt_output)
            payload = result.to_router_payload()
            payload["success"] = True
            payload["error"]   = ""
            return payload
        except Exception as exc:
            self._log.error("Intent predict_from_stt error: %s", exc, exc_info=True)
            return self.predict_intent(stt_output.get("text", ""))

    # ------------------------------------------------------------------
    # KNOWLEDGE ROUTER
    # ------------------------------------------------------------------

    def route(
        self,
        payload:    dict[str, Any],
        session_id: str = "",
        farmer_id:  str = "",
        location:   Optional[dict[str, Any]] = None,
        extra:      Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Routes an intent payload through the Knowledge Router.

        Args:
            payload:    Dict from predict_intent() (router-ready payload).
            session_id: Optional session identifier.
            farmer_id:  Optional farmer identifier.
            location:   Optional location context dict.
            extra:      Optional additional metadata.

        Returns:
            Unified Knowledge Router response envelope.
        """
        router = self._get_router()
        if router is None:
            return {
                "status":          "error",
                "intent":          payload.get("intent", "unknown"),
                "confidence":      payload.get("confidence", 0.0),
                "module_id":       "general_ai",
                "language":        payload.get("language", "latin"),
                "session_id":      session_id,
                "farmer_id":       farmer_id,
                "data":            None,
                "message":         "Knowledge Router unavailable",
                "suggestions":     [],
                "fallback_reason": "router_unavailable",
                "error":           "Knowledge Router module failed to load",
                "routed_at":       "",
                "responded_at":    "",
            }

        try:
            return router.route(
                payload    = payload,
                session_id = session_id,
                farmer_id  = farmer_id,
                location   = location,
                extra      = extra,
            )
        except Exception as exc:
            self._log.error("Router error: %s", exc, exc_info=True)
            return {
                "status":          "error",
                "intent":          payload.get("intent", "unknown"),
                "confidence":      0.0,
                "module_id":       "general_ai",
                "language":        payload.get("language", "latin"),
                "session_id":      session_id,
                "farmer_id":       farmer_id,
                "data":            None,
                "message":         "Routing failed. Please try again.",
                "suggestions":     [],
                "fallback_reason": "",
                "error":           f"{type(exc).__name__}: {exc}",
                "routed_at":       "",
                "responded_at":    "",
            }

    # ------------------------------------------------------------------
    # VOICE GENERATOR (TTS)
    # ------------------------------------------------------------------

    def synthesize(
        self,
        text:            str,
        output_wav_path: str | Path,
    ) -> dict[str, Any]:
        """
        Synthesizes text to a WAV file using Piper TTS.

        Args:
            text:            Text to synthesize.
            output_wav_path: Path where the WAV file will be written.

        Returns:
            Dict with keys: success, output_path, error.
        """
        tts = self._get_tts()
        if tts is None:
            return {
                "success":     False,
                "output_path": "",
                "error":       "Voice Generator unavailable",
            }

        try:
            out_path = Path(output_wav_path)
            ok       = tts.synthesize(text, out_path)
            return {
                "success":     ok,
                "output_path": str(out_path) if ok else "",
                "error":       "" if ok else "Synthesis failed",
            }
        except Exception as exc:
            self._log.error("TTS synthesize error: %s", exc, exc_info=True)
            return {
                "success":     False,
                "output_path": "",
                "error":       f"{type(exc).__name__}: {exc}",
            }

    # ------------------------------------------------------------------
    # HEALTH / STATUS
    # ------------------------------------------------------------------

    def get_status(self) -> dict[str, str]:
        """Returns the current load status of all managed modules."""
        return dict(self._status)

    def is_stt_available(self) -> bool:
        return self._status["stt"] == ModuleStatus.AVAILABLE

    def is_intent_available(self) -> bool:
        return self._status["intent"] == ModuleStatus.AVAILABLE

    def is_router_available(self) -> bool:
        return self._status["router"] == ModuleStatus.AVAILABLE

    def is_tts_available(self) -> bool:
        return self._status["tts"] == ModuleStatus.AVAILABLE

    # ------------------------------------------------------------------
    # LAZY LOADERS
    # ------------------------------------------------------------------

    def _get_stt(self) -> Any:
        with self._stt_lock:
            if self._stt is not None:
                return self._stt
            if self._status["stt"] == ModuleStatus.UNAVAILABLE:
                return None
            try:
                from speech_to_text.transcriber import get_transcriber
                self._stt = get_transcriber()
                self._status["stt"] = ModuleStatus.AVAILABLE
                self._log.info("STT module loaded")
            except Exception as exc:
                self._status["stt"] = ModuleStatus.UNAVAILABLE
                self._log.warning("STT module unavailable: %s", exc)
            return self._stt

    def _get_intent(self) -> Any:
        with self._intent_lock:
            if self._intent is not None:
                return self._intent
            if self._status["intent"] == ModuleStatus.UNAVAILABLE:
                return None
            try:
                from intent_engine.predictor import get_predictor
                self._intent = get_predictor()
                self._status["intent"] = ModuleStatus.AVAILABLE
                self._log.info("Intent Engine loaded")
            except Exception as exc:
                self._status["intent"] = ModuleStatus.UNAVAILABLE
                self._log.warning("Intent Engine unavailable: %s", exc)
            return self._intent

    def _get_router(self) -> Any:
        with self._router_lock:
            if self._router is not None:
                return self._router
            if self._status["router"] == ModuleStatus.UNAVAILABLE:
                return None
            try:
                from knowledge_router.router import get_router
                self._router = get_router()
                self._status["router"] = ModuleStatus.AVAILABLE
                self._log.info("Knowledge Router loaded")
            except Exception as exc:
                self._status["router"] = ModuleStatus.UNAVAILABLE
                self._log.warning("Knowledge Router unavailable: %s", exc)
            return self._router

    def _get_tts(self) -> Any:
        with self._tts_lock:
            if self._tts is not None:
                return self._tts
            if self._status["tts"] == ModuleStatus.UNAVAILABLE:
                return None
            try:
                self._tts = self._load_tts()
                if self._tts is not None:
                    self._status["tts"] = ModuleStatus.AVAILABLE
                    self._log.info("Voice Generator loaded")
                else:
                    self._status["tts"] = ModuleStatus.UNAVAILABLE
            except Exception as exc:
                self._status["tts"] = ModuleStatus.UNAVAILABLE
                self._log.warning("Voice Generator unavailable: %s", exc)
            return self._tts

    def _load_tts(self) -> Any:
        from voice_generator.voice_generator import PiperTTSEngine
        ai_root    = self._cfg.ai_root
        piper_dir  = ai_root / "voice_models" / "piper"
        voices_dir = ai_root / "voice_models" / "voices"

        if not piper_dir.exists():
            self._log.warning("Piper directory not found: %s", piper_dir)
            return None

        model_relative: Optional[str] = None
        if voices_dir.exists():
            for onnx_file in voices_dir.rglob("*.onnx"):
                rel = onnx_file.relative_to(voices_dir)
                json_file = Path(str(onnx_file) + ".json")
                if json_file.exists():
                    model_relative = str(rel)
                    break

        if model_relative is None:
            self._log.warning("No voice model found in: %s", voices_dir)
            return None

        return PiperTTSEngine(
            piper_dir      = piper_dir,
            voices_dir     = voices_dir,
            model_relative = model_relative,
        )

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    @staticmethod
    def _unavailable_result(module: str, error: str) -> dict[str, Any]:
        return {
            "success": False,
            "error":   error,
            "module":  module,
        }


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_am_instance: Optional[AIManager] = None
_am_lock = threading.Lock()


def get_ai_manager(force_rebuild: bool = False) -> AIManager:
    """
    Returns the singleton AIManager.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        AIManager
    """
    global _am_instance
    with _am_lock:
        if _am_instance is None or force_rebuild:
            _am_instance = AIManager()
    return _am_instance
