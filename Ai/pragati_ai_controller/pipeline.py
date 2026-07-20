# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/pipeline.py
# Purpose: Implements the three concrete pipeline strategies:
#            - TextPipeline:  text → Intent → Router → Response
#            - VoicePipeline: audio → STT → Intent → Router → TTS → Response
#            - ImagePipeline: image → InferenceService → KnowledgeService → Response
#          Each pipeline is stateless, thread-safe, and returns a timing dict
#          alongside its result for performance logging.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional

from pragati_ai_controller.ai_manager import AIManager, get_ai_manager
from pragati_ai_controller.config import PragatiAIConfig, get_config
from pragati_ai_controller.language_manager import LanguageManager, get_language_manager

# Root Agent — primary decision engine (Intent Engine first, OpenAI never primary)
try:
    from root_agent.root_agent import get_root_agent as _get_root_agent
    _ROOT_AGENT_AVAILABLE = True
except ImportError:
    _ROOT_AGENT_AVAILABLE = False

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.pipeline")
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
        filename=cfg.logs_dir / "pipeline.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000.0, 2)


# ---------------------------------------------------------------------------
# TEXT PIPELINE
# ---------------------------------------------------------------------------

class TextPipeline:
    """
    text → Intent Engine → Knowledge Router → (optional TTS) → response

    Returns:
        (router_result, language, metrics, error)
    """

    def __init__(
        self,
        cfg:      Optional[PragatiAIConfig] = None,
        ai:       Optional[AIManager]       = None,
        lang_mgr: Optional[LanguageManager] = None,
    ) -> None:
        self._cfg      = cfg      or get_config()
        self._ai       = ai       or get_ai_manager()
        self._lang_mgr = lang_mgr or get_language_manager()
        self._log      = _build_logger(self._cfg)

    def run(
        self,
        text:              str,
        session_id:        str,
        farmer_id:         str,
        explicit_language: Optional[str]       = None,
        location:          Optional[dict[str, Any]] = None,
        synthesize_audio:  bool                = False,
        audio_output_path: Optional[Path]      = None,
    ) -> tuple[dict[str, Any], str, dict[str, float], str]:
        """
        Runs the text pipeline.

        Returns:
            (router_result, language, metrics, error)
        """
        metrics: dict[str, float] = {
            "stt_ms": 0.0, "intent_ms": 0.0, "router_ms": 0.0,
            "tts_ms": 0.0, "inference_ms": 0.0, "knowledge_ms": 0.0,
        }
        t_total = time.perf_counter()

        if not text or not text.strip():
            return {}, self._cfg.default_language, metrics, "Empty input text"

        # Language resolution
        language = self._lang_mgr.resolve(
            text=text,
            explicit_language=explicit_language,
        )

        # ── ROOT AGENT: Intent → Alias → ML → Router (no LLM bypass) ──
        t0 = time.perf_counter()
        if _ROOT_AGENT_AVAILABLE:
            root_agent = _get_root_agent()
            router_result = root_agent.process(
                text       = text,
                session_id = session_id,
                farmer_id  = farmer_id,
                language   = language,
                location   = location,
            )
            metrics["intent_ms"] = router_result.pop("intent_ms", 0.0)
            metrics["router_ms"] = _ms(t0) - metrics["intent_ms"]
        else:
            # Root Agent unavailable — run alias resolver + router directly
            router_result = self._route_without_root_agent(
                text=text, session_id=session_id,
                farmer_id=farmer_id, location=location,
            )
            metrics["intent_ms"] = router_result.pop("intent_ms", 0.0)
            metrics["router_ms"] = _ms(t0) - metrics["intent_ms"]

        # Optional TTS
        response_audio: Optional[str] = None
        if synthesize_audio and audio_output_path:
            response_text = str(router_result.get("message", ""))
            if response_text:
                t0 = time.perf_counter()
                tts_result = self._ai.synthesize(response_text, audio_output_path)
                metrics["tts_ms"] = _ms(t0)
                if tts_result.get("success"):
                    response_audio = tts_result.get("output_path")

        metrics["total_ms"] = _ms(t_total)
        self._log.info(
            "TextPipeline | intent=%s conf=%.3f lang=%s total=%.1fms",
            router_result.get("intent", "?"),
            router_result.get("confidence", 0.0),
            language,
            metrics["total_ms"],
        )
        return router_result, language, metrics, ""


    def _route_without_root_agent(
        self,
        text:       str,
        session_id: str,
        farmer_id:  str,
        location:   Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Fallback routing when Root Agent is unavailable.
        Alias resolver runs first, then ML model, then Knowledge Router.
        Never calls LLM.
        """
        import time as _time
        t_intent = _time.perf_counter()

        # 1. Alias resolver (no model needed)
        try:
            from intent_engine.intent_alias_resolver import resolve_alias
            alias_intent = resolve_alias(text)
        except Exception:
            alias_intent = None

        if alias_intent:
            payload = {
                "intent":     alias_intent,
                "confidence": 1.0,
                "is_unknown": False,
                "text":       text,
                "language":   "latin",
                "timestamp":  "",
                "top":        [{"intent": alias_intent, "confidence": 1.0}],
            }
        else:
            # 2. ML model
            payload = self._ai.predict_intent(text)
            if not payload.get("success"):
                self._log.warning("Intent Engine failed: %s", payload.get("error"))
            # Remap unknown → general so it always hits a local module
            if payload.get("intent") in ("unknown", "", None):
                self._log.warning(
                    "ML model returned '%s' (conf=%.4f) for text='%s' → remapping to 'general'",
                    payload.get("intent"), payload.get("confidence", 0.0), text[:60],
                )
                payload["intent"]     = "general"
                payload["is_unknown"] = False

        intent_ms = round((_time.perf_counter() - t_intent) * 1000.0, 2)

        # 3. Knowledge Router (local modules only — no LLM)
        result = self._ai.route(
            payload    = payload,
            session_id = session_id,
            farmer_id  = farmer_id,
            location   = location,
        )
        result["intent_ms"]     = intent_ms
        result["fallback_used"] = False
        return result


# ---------------------------------------------------------------------------
# VOICE PIPELINE
# ---------------------------------------------------------------------------

class VoicePipeline:
    """
    audio → STT → Intent Engine → Knowledge Router → TTS → response

    Returns:
        (router_result, language, metrics, error, response_audio_path)
    """

    def __init__(
        self,
        cfg:      Optional[PragatiAIConfig] = None,
        ai:       Optional[AIManager]       = None,
        lang_mgr: Optional[LanguageManager] = None,
    ) -> None:
        self._cfg      = cfg      or get_config()
        self._ai       = ai       or get_ai_manager()
        self._lang_mgr = lang_mgr or get_language_manager()
        self._log      = _build_logger(self._cfg)

    def run(
        self,
        audio_path:        Path,
        session_id:        str,
        farmer_id:         str,
        explicit_language: Optional[str]       = None,
        location:          Optional[dict[str, Any]] = None,
        synthesize_audio:  bool                = True,
        audio_output_path: Optional[Path]      = None,
    ) -> tuple[dict[str, Any], str, dict[str, float], str, Optional[str]]:
        """
        Runs the voice pipeline.

        Returns:
            (router_result, language, metrics, error, response_audio_path)
        """
        metrics: dict[str, float] = {
            "stt_ms": 0.0, "intent_ms": 0.0, "router_ms": 0.0,
            "tts_ms": 0.0, "inference_ms": 0.0, "knowledge_ms": 0.0,
        }
        t_total = time.perf_counter()

        if not self._ai.is_stt_available():
            return {}, self._cfg.default_language, metrics, "STT module unavailable", None

        # STT
        t0 = time.perf_counter()
        stt_result = self._ai.transcribe(audio_path, language=explicit_language)
        metrics["stt_ms"] = _ms(t0)

        if not stt_result.get("success"):
            err = stt_result.get("error", "STT failed")
            return {}, self._cfg.default_language, metrics, err, None

        text = stt_result.get("text", "").strip()
        if not text:
            return {}, self._cfg.default_language, metrics, "STT produced empty transcript", None

        # Language resolution (STT language takes priority)
        stt_language = stt_result.get("language", "")
        language = self._lang_mgr.resolve(
            text=text,
            explicit_language=explicit_language,
            stt_language=stt_language,
        )

        # Intent Engine (use STT-aware path)
        t0 = time.perf_counter()
        if _ROOT_AGENT_AVAILABLE:
            root_agent = _get_root_agent()
            router_result = root_agent.process(
                text       = text,
                session_id = session_id,
                farmer_id  = farmer_id,
                language   = language,
                location   = location,
            )
            metrics["intent_ms"] = router_result.pop("intent_ms", 0.0)
            metrics["router_ms"] = _ms(t0) - metrics["intent_ms"]
        else:
            router_result = self._route_without_root_agent(
                text=text, session_id=session_id,
                farmer_id=farmer_id, location=location,
            )
            metrics["intent_ms"] = router_result.pop("intent_ms", 0.0)
            metrics["router_ms"] = _ms(t0) - metrics["intent_ms"]

        # TTS
        response_audio: Optional[str] = None
        if synthesize_audio and self._ai.is_tts_available():
            response_text = str(router_result.get("message", ""))
            out_path = audio_output_path or (
                self._cfg.outputs_dir / "audio" / f"{session_id}_response.wav"
            )
            if response_text:
                t0 = time.perf_counter()
                tts_result = self._ai.synthesize(response_text, out_path)
                metrics["tts_ms"] = _ms(t0)
                if tts_result.get("success"):
                    response_audio = tts_result.get("output_path")

        metrics["total_ms"] = _ms(t_total)
        self._log.info(
            "VoicePipeline | stt=%.1fms intent=%.1fms router=%.1fms tts=%.1fms total=%.1fms",
            metrics["stt_ms"], metrics["intent_ms"],
            metrics["router_ms"], metrics["tts_ms"], metrics["total_ms"],
        )
        return router_result, language, metrics, "", response_audio


# ---------------------------------------------------------------------------
# IMAGE PIPELINE
# ---------------------------------------------------------------------------

class ImagePipeline:
    """
    image → InferenceService → KnowledgeService → response

    Returns:
        (router_result, knowledge_dict, language, metrics, error)
    """

    def __init__(
        self,
        cfg: Optional[PragatiAIConfig] = None,
    ) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)
        self._inference_svc: Any = None
        self._knowledge_svc: Any = None
        self._svc_lock = threading.Lock()

    def _get_services(self) -> tuple[Any, Any]:
        with self._svc_lock:
            if self._inference_svc is None:
                ai_root_str = str(self._cfg.ai_root)
                if ai_root_str not in sys.path:
                    sys.path.insert(0, ai_root_str)
                try:
                    from inference_service import InferenceService
                    self._inference_svc = InferenceService()
                except Exception as exc:
                    self._log.warning("InferenceService unavailable: %s", exc)
                    self._inference_svc = None
            if self._knowledge_svc is None:
                try:
                    from knowledge_service import KnowledgeService
                    self._knowledge_svc = KnowledgeService()
                except Exception as exc:
                    self._log.warning("KnowledgeService unavailable: %s", exc)
                    self._knowledge_svc = None
        return self._inference_svc, self._knowledge_svc

    def run(
        self,
        image_path:        Path,
        session_id:        str,
        farmer_id:         str,
        explicit_language: Optional[str] = None,
        location:          Optional[dict[str, Any]] = None,
    ) -> tuple[dict[str, Any], Optional[dict[str, Any]], str, dict[str, float], str]:
        """
        Runs the image pipeline.

        Returns:
            (router_result, knowledge_dict, language, metrics, error)
        """
        metrics: dict[str, float] = {
            "stt_ms": 0.0, "intent_ms": 0.0, "router_ms": 0.0,
            "tts_ms": 0.0, "inference_ms": 0.0, "knowledge_ms": 0.0,
        }
        t_total = time.perf_counter()
        language = explicit_language or self._cfg.default_language

        inference_svc, knowledge_svc = self._get_services()

        if inference_svc is None:
            return {}, None, language, metrics, "InferenceService unavailable"

        # YOLO inference
        t0 = time.perf_counter()
        try:
            svc_response = inference_svc.predict_single(image_path)
        except Exception as exc:
            return {}, None, language, metrics, f"Inference error: {exc}"
        metrics["inference_ms"] = _ms(t0)

        if not svc_response.success:
            return {}, None, language, metrics, svc_response.error or "Inference failed"

        prediction = svc_response.data or {}

        # Knowledge Base lookup
        knowledge_dict: Optional[dict[str, Any]] = None
        if knowledge_svc and prediction.get("status") == "success":
            t0 = time.perf_counter()
            try:
                kr = knowledge_svc.lookup_from_prediction(prediction, language=language)
                knowledge_dict = kr.to_dict()
            except Exception as exc:
                self._log.warning("KnowledgeService error: %s", exc)
            metrics["knowledge_ms"] = _ms(t0)

        # Build a minimal router-compatible envelope for the response generator
        router_result: dict[str, Any] = {
            "status":          "success" if prediction.get("status") == "success" else "fallback",
            "intent":          "disease",
            "confidence":      float(prediction.get("confidence", 0.0)) / 100.0,
            "module_id":       "disease_ai",
            "language":        language,
            "session_id":      session_id,
            "farmer_id":       farmer_id,
            "data":            prediction,
            "message":         self._build_image_message(prediction, knowledge_dict, language),
            "suggestions":     [],
            "fallback_reason": "",
            "error":           "",
        }

        metrics["total_ms"] = _ms(t_total)
        self._log.info(
            "ImagePipeline | class=%s conf=%.1f%% infer=%.1fms kb=%.1fms total=%.1fms",
            prediction.get("class_name", "?"),
            prediction.get("confidence", 0.0),
            metrics["inference_ms"],
            metrics["knowledge_ms"],
            metrics["total_ms"],
        )
        return router_result, knowledge_dict, language, metrics, ""

    @staticmethod
    def _build_image_message(
        prediction:    dict[str, Any],
        knowledge:     Optional[dict[str, Any]],
        language:      str,
    ) -> str:
        if prediction.get("status") != "success":
            if language in ("hi", "raj", "mr", "mew"):
                return "छवि विश्लेषण विफल हुआ।"
            return "Image analysis failed."

        crop       = prediction.get("crop", "")
        class_name = prediction.get("class_name", "")
        confidence = prediction.get("confidence", 0.0)

        if language in ("hi", "raj", "mr", "mew"):
            msg = f"फसल: {crop} | रोग/कीट: {class_name} | विश्वास: {confidence:.1f}%"
            if knowledge and knowledge.get("found") and knowledge.get("description"):
                msg += f"\n{knowledge['description']}"
        else:
            msg = f"Crop: {crop} | Class: {class_name} | Confidence: {confidence:.1f}%"
            if knowledge and knowledge.get("found") and knowledge.get("description"):
                msg += f"\n{knowledge['description']}"
        return msg


# ---------------------------------------------------------------------------
# PIPELINE FACTORY
# ---------------------------------------------------------------------------

_text_pipeline:  Optional[TextPipeline]  = None
_voice_pipeline: Optional[VoicePipeline] = None
_image_pipeline: Optional[ImagePipeline] = None
_pipeline_lock = threading.Lock()


def get_text_pipeline(force_rebuild: bool = False) -> TextPipeline:
    global _text_pipeline
    with _pipeline_lock:
        if _text_pipeline is None or force_rebuild:
            _text_pipeline = TextPipeline()
    return _text_pipeline


def get_voice_pipeline(force_rebuild: bool = False) -> VoicePipeline:
    global _voice_pipeline
    with _pipeline_lock:
        if _voice_pipeline is None or force_rebuild:
            _voice_pipeline = VoicePipeline()
    return _voice_pipeline


def get_image_pipeline(force_rebuild: bool = False) -> ImagePipeline:
    global _image_pipeline
    with _pipeline_lock:
        if _image_pipeline is None or force_rebuild:
            _image_pipeline = ImagePipeline()
    return _image_pipeline
