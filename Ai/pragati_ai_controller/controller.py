# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/controller.py
# Purpose: Master brain of the Pragati AI system.
#          Detects input type, routes to correct pipeline, manages sessions,
#          records conversation turns, and returns unified responses.
#          Thread-safe. Singleton. Production-ready.
# =============================================================================

from __future__ import annotations

import logging
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from pragati_ai_controller.ai_manager import AIManager, get_ai_manager
from pragati_ai_controller.config import (
    CONTROLLER_VERSION,
    INPUT_TYPE_IMAGE,
    INPUT_TYPE_TEXT,
    INPUT_TYPE_VOICE,
    PragatiAIConfig,
    get_config,
)
from pragati_ai_controller.conversation_manager import (
    ConversationManager,
    get_conversation_manager,
)
from pragati_ai_controller.language_manager import LanguageManager, get_language_manager
from pragati_ai_controller.pipeline import (
    ImagePipeline,
    TextPipeline,
    VoicePipeline,
    get_image_pipeline,
    get_text_pipeline,
    get_voice_pipeline,
)
from pragati_ai_controller.response_generator import (
    ResponseGenerator,
    get_response_generator,
)

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.controller.main")
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
        filename=cfg.logs_dir / "controller.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# INPUT DETECTOR
# ---------------------------------------------------------------------------

def detect_input_type(user_input: str | Path) -> str:
    """
    Detects whether the input is text, voice, or image.

    Rules:
      - Path with audio extension  → voice
      - Path with image extension  → image
      - str (non-path) or text     → text

    Returns:
        INPUT_TYPE_TEXT | INPUT_TYPE_VOICE | INPUT_TYPE_IMAGE
    """
    _AUDIO_EXT = {".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus"}
    _IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}

    p = Path(str(user_input))
    ext = p.suffix.lower()

    if ext in _AUDIO_EXT:
        return INPUT_TYPE_VOICE
    if ext in _IMAGE_EXT:
        return INPUT_TYPE_IMAGE
    return INPUT_TYPE_TEXT


# ---------------------------------------------------------------------------
# PRAGATI AI CONTROLLER
# ---------------------------------------------------------------------------

class PragatiAIController:
    """
    Master entry point for the entire Pragati AI backend.

    Responsibilities:
      - Detect input type (text / voice / image)
      - Route to the correct pipeline
      - Manage conversation sessions
      - Record turns in memory
      - Return unified response envelopes

    Usage:
        controller = PragatiAIController()

        # Text
        response = controller.process(
            user_input="मेरी फसल में बीमारी है",
            session_id="sess_001",
            farmer_id="f_123",
        )

        # Voice
        response = controller.process(
            user_input=Path("recording.wav"),
            session_id="sess_001",
            synthesize_audio=True,
        )

        # Image
        response = controller.process(
            user_input=Path("leaf.jpg"),
            session_id="sess_001",
        )
    """

    def __init__(
        self,
        cfg:       Optional[PragatiAIConfig]     = None,
        ai:        Optional[AIManager]           = None,
        conv_mgr:  Optional[ConversationManager] = None,
        lang_mgr:  Optional[LanguageManager]     = None,
        resp_gen:  Optional[ResponseGenerator]   = None,
    ) -> None:
        self._cfg      = cfg      or get_config()
        self._ai       = ai       or get_ai_manager()
        self._conv_mgr = conv_mgr or get_conversation_manager()
        self._lang_mgr = lang_mgr or get_language_manager()
        self._resp_gen = resp_gen or get_response_generator()
        self._log      = _build_logger(self._cfg)

        # Ensure AI_ROOT on sys.path for cross-module imports
        ai_root_str = str(self._cfg.ai_root)
        if ai_root_str not in sys.path:
            sys.path.insert(0, ai_root_str)

        # Ensure output dirs exist
        (self._cfg.outputs_dir / "audio").mkdir(parents=True, exist_ok=True)

        self._log.info(
            "PragatiAIController v%s initialised | ai_root=%s",
            CONTROLLER_VERSION,
            self._cfg.ai_root,
        )

    # ------------------------------------------------------------------
    # PRIMARY ENTRY POINT
    # ------------------------------------------------------------------

    def process(
        self,
        user_input:        str | Path,
        session_id:        Optional[str]           = None,
        farmer_id:         str                     = "",
        farmer_name:       str                     = "",
        language:          Optional[str]           = None,
        location:          Optional[dict[str, Any]] = None,
        synthesize_audio:  bool                    = False,
        audio_output_path: Optional[Path]          = None,
        extra:             Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Processes any user input through the complete AI pipeline.

        Args:
            user_input:        Text string, audio file Path, or image file Path.
            session_id:        Session ID. Auto-generated if not provided.
            farmer_id:         Optional farmer identifier.
            farmer_name:       Optional farmer display name.
            language:          Optional explicit language override.
            location:          Optional location context dict.
            synthesize_audio:  If True, synthesise TTS response for text/voice.
            audio_output_path: Custom path for TTS output WAV.
            extra:             Optional extra metadata passed through.

        Returns:
            Unified response envelope dict (always — never raises).
        """
        t_start = time.perf_counter()

        # Session management
        sid = session_id or self._new_session_id()
        self._conv_mgr.start_session(
            session_id  = sid,
            farmer_id   = farmer_id,
            farmer_name = farmer_name,
            language    = language or self._cfg.default_language,
            location    = location,
        )

        input_type = detect_input_type(user_input)

        try:
            timeout = self._cfg.max_response_wait_seconds
            with ThreadPoolExecutor(max_workers=1) as executor:
                if input_type == INPUT_TYPE_TEXT:
                    future = executor.submit(
                        self._process_text,
                        str(user_input), sid, farmer_id, language,
                        location, synthesize_audio, audio_output_path,
                    )
                elif input_type == INPUT_TYPE_VOICE:
                    future = executor.submit(
                        self._process_voice,
                        Path(str(user_input)), sid, farmer_id, language,
                        location, synthesize_audio, audio_output_path,
                    )
                else:
                    future = executor.submit(
                        self._process_image,
                        Path(str(user_input)), sid, farmer_id, language, location,
                    )
                try:
                    return future.result(timeout=timeout)
                except FuturesTimeoutError:
                    total_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
                    self._log.error(
                        "Pipeline timeout after %.1fs | session=%s type=%s",
                        timeout, sid, input_type,
                    )
                    return self._resp_gen.build_error(
                        pipeline   = input_type,
                        session_id = sid,
                        farmer_id  = farmer_id,
                        language   = language or self._cfg.default_language,
                        error      = f"Request timed out after {timeout}s",
                        metrics    = {"total_ms": total_ms},
                    )
        except Exception as exc:
            self._log.critical("Unhandled controller error: %s", exc, exc_info=True)
            total_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
            return self._resp_gen.build_error(
                pipeline   = input_type,
                session_id = sid,
                farmer_id  = farmer_id,
                language   = language or self._cfg.default_language,
                error      = f"{type(exc).__name__}: {exc}",
                metrics    = {"total_ms": total_ms},
            )

    # ------------------------------------------------------------------
    # TEXT PIPELINE
    # ------------------------------------------------------------------

    def _process_text(
        self,
        text:              str,
        session_id:        str,
        farmer_id:         str,
        language:          Optional[str],
        location:          Optional[dict[str, Any]],
        synthesize_audio:  bool,
        audio_output_path: Optional[Path],
    ) -> dict[str, Any]:
        pipeline: TextPipeline = get_text_pipeline()

        router_result, resolved_lang, metrics, error = pipeline.run(
            text              = text,
            session_id        = session_id,
            farmer_id         = farmer_id,
            explicit_language = language,
            location          = location,
            synthesize_audio  = synthesize_audio,
            audio_output_path = audio_output_path,
        )

        response = self._resp_gen.build(
            pipeline      = INPUT_TYPE_TEXT,
            session_id    = session_id,
            farmer_id     = farmer_id,
            language      = resolved_lang,
            router_result = router_result,
            error         = error,
            metrics       = metrics,
        )

        # Record conversation turns
        if not error:
            self._conv_mgr.record_user_turn(
                session_id = session_id,
                text       = text,
                intent     = response.get("intent", ""),
                language   = resolved_lang,
            )
            self._conv_mgr.record_assistant_turn(
                session_id = session_id,
                text       = response.get("response_text", ""),
                module_id  = response.get("module_id", ""),
                language   = resolved_lang,
            )

        self._log.info(
            "TEXT | session=%s intent=%s lang=%s total=%.1fms",
            session_id, response.get("intent"), resolved_lang,
            metrics.get("total_ms", 0.0),
        )
        return response

    # ------------------------------------------------------------------
    # VOICE PIPELINE
    # ------------------------------------------------------------------

    def _process_voice(
        self,
        audio_path:        Path,
        session_id:        str,
        farmer_id:         str,
        language:          Optional[str],
        location:          Optional[dict[str, Any]],
        synthesize_audio:  bool,
        audio_output_path: Optional[Path],
    ) -> dict[str, Any]:
        pipeline: VoicePipeline = get_voice_pipeline()

        router_result, resolved_lang, metrics, error, response_audio = pipeline.run(
            audio_path        = audio_path,
            session_id        = session_id,
            farmer_id         = farmer_id,
            explicit_language = language,
            location          = location,
            synthesize_audio  = synthesize_audio,
            audio_output_path = audio_output_path,
        )

        response = self._resp_gen.build(
            pipeline       = INPUT_TYPE_VOICE,
            session_id     = session_id,
            farmer_id      = farmer_id,
            language       = resolved_lang,
            router_result  = router_result,
            response_audio = response_audio,
            error          = error,
            metrics        = metrics,
        )

        if not error:
            self._conv_mgr.record_user_turn(
                session_id = session_id,
                text       = f"[voice:{audio_path.name}]",
                intent     = response.get("intent", ""),
                language   = resolved_lang,
            )
            self._conv_mgr.record_assistant_turn(
                session_id = session_id,
                text       = response.get("response_text", ""),
                module_id  = response.get("module_id", ""),
                language   = resolved_lang,
            )

        self._log.info(
            "VOICE | session=%s stt=%.1fms intent=%.1fms tts=%.1fms total=%.1fms",
            session_id,
            metrics.get("stt_ms", 0.0),
            metrics.get("intent_ms", 0.0),
            metrics.get("tts_ms", 0.0),
            metrics.get("total_ms", 0.0),
        )
        return response

    # ------------------------------------------------------------------
    # IMAGE PIPELINE
    # ------------------------------------------------------------------

    def _process_image(
        self,
        image_path: Path,
        session_id: str,
        farmer_id:  str,
        language:   Optional[str],
        location:   Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        pipeline: ImagePipeline = get_image_pipeline()

        router_result, knowledge_dict, resolved_lang, metrics, error = pipeline.run(
            image_path        = image_path,
            session_id        = session_id,
            farmer_id         = farmer_id,
            explicit_language = language,
            location          = location,
        )

        response = self._resp_gen.build(
            pipeline      = INPUT_TYPE_IMAGE,
            session_id    = session_id,
            farmer_id     = farmer_id,
            language      = resolved_lang,
            router_result = router_result,
            knowledge     = knowledge_dict,
            error         = error,
            metrics       = metrics,
        )

        if not error:
            self._conv_mgr.record_user_turn(
                session_id = session_id,
                text       = f"[image:{image_path.name}]",
                intent     = "disease",
                language   = resolved_lang,
            )
            self._conv_mgr.record_assistant_turn(
                session_id = session_id,
                text       = response.get("response_text", ""),
                module_id  = "disease_ai",
                language   = resolved_lang,
            )
            # Store YOLO result in session store for follow-up context
            try:
                from knowledge_base.session_store import get_session_store, Slot
                _store = get_session_store()
                _pred  = router_result.get("data") or {}
                if _pred.get("class_name"):
                    _store.set(session_id, Slot.LAST_YOLO_RESULT, _pred)
                    _store.set(session_id, Slot.ACTIVE_DISEASE, _pred.get("class_name", ""))
                if _pred.get("crop"):
                    _store.set(session_id, Slot.ACTIVE_CROP, _pred.get("crop", ""))
                _store.set(session_id, Slot.PENDING_ACTION, "")
                _store.set(session_id, Slot.ACTIVE_INTENT, "disease")
            except Exception:
                pass

        self._log.info(
            "IMAGE | session=%s infer=%.1fms kb=%.1fms total=%.1fms",
            session_id,
            metrics.get("inference_ms", 0.0),
            metrics.get("knowledge_ms", 0.0),
            metrics.get("total_ms", 0.0),
        )
        return response

    # ------------------------------------------------------------------
    # SESSION MANAGEMENT
    # ------------------------------------------------------------------

    def end_session(self, session_id: str) -> None:
        """Ends a session and flushes memory to disk."""
        self._conv_mgr.end_session(session_id, flush_memory=True)
        self._log.info("Session ended: %s", session_id)

    def get_session_history(self, session_id: str) -> list[dict[str, Any]]:
        """Returns the full conversation history for a session."""
        return self._conv_mgr.get_full_history(session_id)

    def get_session_context(self, session_id: str) -> dict[str, Any]:
        """Returns the current session context."""
        return self._conv_mgr.get_session_context(session_id)

    # ------------------------------------------------------------------
    # HEALTH CHECK
    # ------------------------------------------------------------------

    def health_check(self) -> dict[str, Any]:
        """
        Returns a comprehensive health status of all modules.
        Safe to call at any time — never raises.
        """
        ai_status = self._ai.get_status()
        cfg = self._cfg

        weights_path = cfg.ai_root / "weights" / "checkpoints" / "best.pt"
        intent_model = cfg.ai_root / "intent_engine" / "models" / "intent_classifier.pkl"
        voice_model_dir = cfg.ai_root / "voice_models" / "voices"
        stt_model_dir = cfg.ai_root / "speech_to_text" / "models" / "faster_whisper"

        voice_model_found = any(voice_model_dir.rglob("*.onnx")) if voice_model_dir.exists() else False
        stt_model_found = any(stt_model_dir.iterdir()) if stt_model_dir.exists() else False

        return {
            "status":     "healthy",
            "version":    CONTROLLER_VERSION,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "modules": {
                "stt":    ai_status.get("stt",    "not_loaded"),
                "intent": ai_status.get("intent", "not_loaded"),
                "router": ai_status.get("router", "not_loaded"),
                "tts":    ai_status.get("tts",    "not_loaded"),
            },
            "assets": {
                "yolo_weights":  weights_path.exists(),
                "intent_model":  intent_model.exists(),
                "voice_model":   voice_model_found,
                "stt_model":     stt_model_found,
            },
            "paths": {
                "ai_root":    str(cfg.ai_root),
                "logs_dir":   str(cfg.logs_dir),
                "memory_dir": str(cfg.memory_dir),
                "outputs_dir":str(cfg.outputs_dir),
            },
        }

    # ------------------------------------------------------------------
    # MODULE STATUS
    # ------------------------------------------------------------------

    def get_module_status(self) -> dict[str, str]:
        """Returns the load status of all AI modules."""
        return self._ai.get_status()

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    @staticmethod
    def _new_session_id() -> str:
        return f"sess_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_controller_instance: Optional[PragatiAIController] = None
_controller_lock = threading.Lock()


def get_controller(force_rebuild: bool = False) -> PragatiAIController:
    """
    Returns the singleton PragatiAIController.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        PragatiAIController
    """
    global _controller_instance
    with _controller_lock:
        if _controller_instance is None or force_rebuild:
            _controller_instance = PragatiAIController()
    return _controller_instance


# ---------------------------------------------------------------------------
# CONVENIENCE FUNCTION
# ---------------------------------------------------------------------------

def process(
    user_input:       str | Path,
    session_id:       Optional[str]            = None,
    farmer_id:        str                      = "",
    language:         Optional[str]            = None,
    synthesize_audio: bool                     = False,
    location:         Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    One-call interface to the Pragati AI pipeline.

    Args:
        user_input:       Text, audio Path, or image Path.
        session_id:       Optional session ID.
        farmer_id:        Optional farmer ID.
        language:         Optional language override.
        synthesize_audio: Generate TTS audio response.
        location:         Optional location context.

    Returns:
        Unified response envelope dict.
    """
    return get_controller().process(
        user_input       = user_input,
        session_id       = session_id,
        farmer_id        = farmer_id,
        language         = language,
        synthesize_audio = synthesize_audio,
        location         = location,
    )


# ---------------------------------------------------------------------------
# CLI SELF-TEST
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    ctrl = PragatiAIController()

    print("\n" + "=" * 60)
    print("  Pragati AI Controller — Health Check")
    print("=" * 60)
    health = ctrl.health_check()
    print(json.dumps(health, indent=2, ensure_ascii=False))

    print("\n" + "=" * 60)
    print("  Text Pipeline Test")
    print("=" * 60)
    result = ctrl.process(
        user_input = "मेरी फसल में पीले पत्ते हो रहे हैं",
        session_id = "test_session_001",
        farmer_id  = "farmer_test",
    )
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    print("=" * 60 + "\n")
