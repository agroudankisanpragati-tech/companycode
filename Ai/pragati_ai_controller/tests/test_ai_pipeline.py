# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/tests/test_ai_pipeline.py
# Purpose: AI pipeline tests — Speech→Intent→Router→Response,
#          Image→DiseaseAI, Text→Intent→Response, Knowledge Base search,
#          Conversation History, User Memory, Voice Generation, STT.
# Run: python -m pytest pragati_ai_controller/tests/test_ai_pipeline.py -v
# =============================================================================

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))


# ---------------------------------------------------------------------------
# TEXT → INTENT → RESPONSE FLOW
# ---------------------------------------------------------------------------

class TestTextIntentResponseFlow(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        self.pipeline = get_text_pipeline()

    def test_hindi_disease_intent_routed(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="मेरी फसल में पीले पत्ते हो रहे हैं",
            session_id="tap_hi_001", farmer_id="f001",
        )
        self.assertEqual(err, "")
        self.assertIn("intent", rr)
        self.assertIn("module_id", rr)
        self.assertGreater(metrics["total_ms"], 0)

    def test_english_crop_intent_routed(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="what crop should I grow in summer",
            session_id="tap_en_001", farmer_id="",
        )
        self.assertEqual(err, "")
        self.assertIn("intent", rr)

    def test_empty_text_returns_error(self):
        _, _, _, err = self.pipeline.run(text="", session_id="tap_empty", farmer_id="")
        self.assertNotEqual(err, "")

    def test_whitespace_only_returns_error(self):
        _, _, _, err = self.pipeline.run(text="   ", session_id="tap_ws", farmer_id="")
        self.assertNotEqual(err, "")

    def test_response_has_message(self):
        rr, _, _, err = self.pipeline.run(
            text="fertilizer for wheat", session_id="tap_msg_001", farmer_id=""
        )
        self.assertEqual(err, "")
        self.assertIn("message", rr)
        self.assertIsInstance(rr["message"], str)

    def test_language_detection_hindi(self):
        _, lang, _, _ = self.pipeline.run(
            text="मेरी फसल में बीमारी है", session_id="tap_lang_hi", farmer_id=""
        )
        self.assertEqual(lang, "hi")

    def test_language_detection_english(self):
        _, lang, _, _ = self.pipeline.run(
            text="crop disease treatment", session_id="tap_lang_en", farmer_id=""
        )
        self.assertEqual(lang, "en")

    def test_explicit_language_override(self):
        _, lang, _, _ = self.pipeline.run(
            text="hello", session_id="tap_override", farmer_id="",
            explicit_language="hi",
        )
        self.assertEqual(lang, "hi")

    def test_metrics_all_keys_present(self):
        _, _, metrics, _ = self.pipeline.run(
            text="soil test", session_id="tap_metrics", farmer_id=""
        )
        for key in ("stt_ms", "intent_ms", "router_ms", "tts_ms", "total_ms"):
            self.assertIn(key, metrics)
            self.assertGreaterEqual(metrics[key], 0.0)

    def test_router_result_structure(self):
        rr, _, _, _ = self.pipeline.run(
            text="irrigation schedule", session_id="tap_struct", farmer_id=""
        )
        for key in ("status", "intent", "confidence", "module_id", "message"):
            self.assertIn(key, rr)


# ---------------------------------------------------------------------------
# SPEECH → INTENT → ROUTER → RESPONSE FLOW
# ---------------------------------------------------------------------------

class TestSpeechIntentRouterFlow(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.pipeline import get_voice_pipeline
        from pragati_ai_controller.ai_manager import get_ai_manager
        self.pipeline = get_voice_pipeline()
        self.am = get_ai_manager()

    def test_nonexistent_audio_returns_error(self):
        rr, lang, metrics, err, audio = self.pipeline.run(
            audio_path=Path("nonexistent_audio.wav"),
            session_id="stt_001", farmer_id="",
        )
        self.assertNotEqual(err, "")

    def test_returns_five_tuple(self):
        result = self.pipeline.run(
            audio_path=Path("nonexistent.wav"),
            session_id="stt_002", farmer_id="",
        )
        self.assertEqual(len(result), 5)

    def test_metrics_keys_present(self):
        _, _, metrics, _, _ = self.pipeline.run(
            audio_path=Path("nonexistent.wav"),
            session_id="stt_003", farmer_id="",
        )
        for key in ("stt_ms", "intent_ms", "router_ms", "tts_ms", "total_ms"):
            self.assertIn(key, metrics)

    def test_stt_unavailable_graceful(self):
        if not self.am.is_stt_available():
            rr, lang, metrics, err, audio = self.pipeline.run(
                audio_path=Path("nonexistent.wav"),
                session_id="stt_004", farmer_id="",
            )
            self.assertNotEqual(err, "")
            self.assertIsNone(audio)

    def test_real_wav_from_voice_dataset(self):
        wav_files = list((_AI_ROOT / "voice_dataset").rglob("*.wav"))
        if not wav_files:
            self.skipTest("No WAV files in voice_dataset")
        rr, lang, metrics, err, audio = self.pipeline.run(
            audio_path=wav_files[0],
            session_id="stt_real_001", farmer_id="",
        )
        self.assertIsInstance(metrics, dict)


# ---------------------------------------------------------------------------
# IMAGE → DISEASE AI FLOW
# ---------------------------------------------------------------------------

class TestImageDiseaseAIFlow(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.pipeline import get_image_pipeline
        self.pipeline = get_image_pipeline()

    def test_nonexistent_image_returns_error(self):
        rr, kb, lang, metrics, err = self.pipeline.run(
            image_path=Path("nonexistent_leaf.jpg"),
            session_id="img_001", farmer_id="",
        )
        self.assertNotEqual(err, "")

    def test_returns_five_tuple(self):
        result = self.pipeline.run(
            image_path=Path("nonexistent.jpg"),
            session_id="img_002", farmer_id="",
        )
        self.assertEqual(len(result), 5)

    def test_language_defaults_to_config(self):
        from pragati_ai_controller.config import get_config
        _, _, lang, _, _ = self.pipeline.run(
            image_path=Path("nonexistent.jpg"),
            session_id="img_003", farmer_id="",
        )
        self.assertEqual(lang, get_config().default_language)

    def test_explicit_language_respected(self):
        _, _, lang, _, _ = self.pipeline.run(
            image_path=Path("nonexistent.jpg"),
            session_id="img_004", farmer_id="",
            explicit_language="en",
        )
        self.assertEqual(lang, "en")

    def test_real_crop_image_if_available(self):
        images = list((_AI_ROOT / "crop_dataset").rglob("*.jpg"))
        if not images:
            self.skipTest("No crop images found")
        rr, kb, lang, metrics, err = self.pipeline.run(
            image_path=images[0],
            session_id="img_real_001", farmer_id="",
        )
        self.assertIsInstance(rr, dict)
        self.assertIsInstance(metrics, dict)

    def test_inference_service_health(self):
        try:
            from inference_service import InferenceService
            svc = InferenceService()
            h = svc.health_check()
            self.assertIn("status", h)
            self.assertIn("weights_exists", h)
        except ImportError:
            self.skipTest("InferenceService not importable")


# ---------------------------------------------------------------------------
# KNOWLEDGE BASE SEARCH
# ---------------------------------------------------------------------------

class TestKnowledgeBaseSearch(unittest.TestCase):

    def setUp(self):
        try:
            from knowledge_service import KnowledgeService
            self.svc = KnowledgeService()
            self.available = True
        except Exception:
            self.available = False

    def _skip(self):
        if not self.available:
            self.skipTest("KnowledgeService unavailable")

    def test_health_check_structure(self):
        self._skip()
        h = self.svc.health_check()
        self.assertIn("status", h)
        self.assertIn("db", h)
        self.assertIn("collection", h)

    def test_lookup_returns_knowledge_result(self):
        self._skip()
        r = self.svc.lookup("green_gram", "diseases", "Yellow Mosaic")
        self.assertIsInstance(r.found, bool)
        self.assertIsInstance(r.to_dict(), dict)

    def test_lookup_empty_returns_not_found(self):
        self._skip()
        r = self.svc.lookup("", "", "")
        self.assertFalse(r.found)

    def test_lookup_from_prediction_bad_status(self):
        self._skip()
        r = self.svc.lookup_from_prediction({"status": "error"})
        self.assertFalse(r.found)

    def test_to_dict_has_required_keys(self):
        self._skip()
        r = self.svc.lookup("Tomato", "diseases", "Early Blight")
        d = r.to_dict()
        for key in ("found", "crop", "category", "class_name", "description"):
            self.assertIn(key, d)

    def test_knowledge_base_modules_importable(self):
        modules = [
            "knowledge_base.disease_ai",
            "knowledge_base.crop_ai",
            "knowledge_base.general_ai",
            "knowledge_base.weather",
            "knowledge_base.market",
            "knowledge_base.government_schemes",
            "knowledge_base.fertilizer",
            "knowledge_base.irrigation",
            "knowledge_base.seed",
            "knowledge_base.soil_analysis",
            "knowledge_base.machinery",
        ]
        import importlib
        for mod in modules:
            try:
                m = importlib.import_module(mod)
                self.assertTrue(callable(getattr(m, "handle", None)),
                                f"{mod} missing handle()")
            except Exception as exc:
                self.fail(f"Failed to import {mod}: {exc}")


# ---------------------------------------------------------------------------
# CONVERSATION HISTORY
# ---------------------------------------------------------------------------

class TestConversationHistory(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.conversation_manager import ConversationManager
        self.conv = ConversationManager()
        self.sid = "hist_test_001"

    def tearDown(self):
        self.conv.clear_session(self.sid)

    def test_record_and_retrieve(self):
        self.conv.start_session(self.sid, farmer_id="f001", language="hi")
        self.conv.record_user_turn(self.sid, "बीमारी है", intent="disease")
        self.conv.record_assistant_turn(self.sid, "झुलसा रोग", module_id="disease_ai")
        history = self.conv.get_history(self.sid)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["role"], "user")
        self.assertEqual(history[1]["role"], "assistant")

    def test_context_as_text(self):
        self.conv.start_session(self.sid)
        self.conv.record_user_turn(self.sid, "hello")
        self.conv.record_assistant_turn(self.sid, "hi there")
        text = self.conv.get_context_as_text(self.sid)
        self.assertIn("User:", text)
        self.assertIn("Assistant:", text)

    def test_full_history_includes_ltm(self):
        self.conv.start_session(self.sid)
        self.conv.record_user_turn(self.sid, "test message")
        self.conv.end_session(self.sid, flush_memory=True)
        self.conv.start_session(self.sid)
        full = self.conv.get_full_history(self.sid)
        self.assertIsInstance(full, list)

    def test_session_context_structure(self):
        self.conv.start_session(self.sid, farmer_id="f001", language="hi")
        ctx = self.conv.get_session_context(self.sid)
        self.assertIn("session_id", ctx)
        self.assertIn("farmer_id", ctx)
        self.assertIn("language", ctx)

    def test_last_intent_tracked(self):
        self.conv.start_session(self.sid)
        self.conv.record_user_turn(self.sid, "disease query", intent="disease")
        self.assertEqual(self.conv.get_last_intent(self.sid), "disease")


# ---------------------------------------------------------------------------
# USER MEMORY
# ---------------------------------------------------------------------------

class TestUserMemory(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.memory_manager import MemoryManager
        self.mm = MemoryManager()
        self.sid = "mem_test_001"

    def tearDown(self):
        self.mm.delete_session(self.sid)

    def test_add_and_get_stm(self):
        self.mm.add_turn(self.sid, "user", "hello", intent="greeting")
        turns = self.mm.get_short_term(self.sid)
        self.assertEqual(len(turns), 1)
        self.assertEqual(turns[0]["content"], "hello")
        self.assertEqual(turns[0]["intent"], "greeting")

    def test_stm_respects_limit(self):
        from pragati_ai_controller.config import get_config
        limit = get_config().short_term_memory_limit
        for i in range(limit + 5):
            self.mm.add_turn(self.sid, "user", f"msg {i}")
        turns = self.mm.get_short_term(self.sid)
        self.assertLessEqual(len(turns), limit)

    def test_context_window_max_turns(self):
        for i in range(10):
            self.mm.add_turn(self.sid, "user", f"msg {i}")
        window = self.mm.get_context_window(self.sid, max_turns=4)
        self.assertEqual(len(window), 4)

    def test_flush_and_restore(self):
        self.mm.add_turn(self.sid, "user", "flush test")
        self.mm.flush_to_long_term(self.sid)
        self.mm.clear_short_term(self.sid)
        self.assertEqual(len(self.mm.get_short_term(self.sid)), 0)
        self.mm.restore_to_short_term(self.sid, last_n=5)
        self.assertGreater(len(self.mm.get_short_term(self.sid)), 0)

    def test_full_history_deduplication(self):
        self.mm.add_turn(self.sid, "user", "msg1")
        self.mm.flush_to_long_term(self.sid)
        self.mm.add_turn(self.sid, "user", "msg2")
        full = self.mm.get_full_history(self.sid)
        contents = [t["content"] for t in full]
        self.assertIn("msg1", contents)
        self.assertIn("msg2", contents)

    def test_session_exists(self):
        self.assertFalse(self.mm.session_exists(self.sid))
        self.mm.add_turn(self.sid, "user", "test")
        self.assertTrue(self.mm.session_exists(self.sid))


# ---------------------------------------------------------------------------
# VOICE GENERATION
# ---------------------------------------------------------------------------

class TestVoiceGeneration(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        self.am = get_ai_manager()

    def test_tts_status_reported(self):
        status = self.am.get_status()
        self.assertIn("tts", status)
        self.assertIn(status["tts"], ("available", "unavailable", "not_loaded"))

    def test_synthesize_returns_dict(self):
        import tempfile, os
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            tmp = f.name
        try:
            result = self.am.synthesize("नमस्ते", Path(tmp))
            self.assertIn("success", result)
            self.assertIn("output_path", result)
            self.assertIn("error", result)
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass

    def test_piper_engine_importable(self):
        try:
            from voice_generator.voice_generator import PiperTTSEngine
            self.assertTrue(callable(PiperTTSEngine))
        except ImportError as exc:
            self.fail(f"PiperTTSEngine not importable: {exc}")

    def test_voice_model_files_exist(self):
        from pragati_ai_controller.config import get_config
        cfg = get_config()
        voices_dir = cfg.ai_root / "voice_models" / "voices"
        piper_exe = cfg.ai_root / "voice_models" / "piper" / "piper.exe"
        self.assertTrue(piper_exe.exists(), f"piper.exe not found: {piper_exe}")
        onnx_files = list(voices_dir.rglob("*.onnx")) if voices_dir.exists() else []
        self.assertGreater(len(onnx_files), 0, "No .onnx voice model found")


# ---------------------------------------------------------------------------
# SPEECH RECOGNITION
# ---------------------------------------------------------------------------

class TestSpeechRecognition(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        self.am = get_ai_manager()

    def test_stt_status_reported(self):
        status = self.am.get_status()
        self.assertIn("stt", status)

    def test_transcribe_nonexistent_returns_error(self):
        result = self.am.transcribe(Path("nonexistent_audio.wav"))
        self.assertIn("success", result)
        self.assertIn("error", result)

    def test_transcribe_result_schema(self):
        result = self.am.transcribe(Path("nonexistent.wav"))
        for key in ("success", "error"):
            self.assertIn(key, result)

    def test_real_wav_transcription(self):
        if not self.am.is_stt_available():
            self.skipTest("STT module not available")
        wav_files = list((_AI_ROOT / "voice_dataset" / "hindi" / "audio").glob("*.wav"))
        if not wav_files:
            self.skipTest("No Hindi WAV files found")
        result = self.am.transcribe(wav_files[0])
        self.assertIn("success", result)
        if result["success"]:
            self.assertIn("text", result)
            self.assertIn("language", result)
            self.assertIsInstance(result["text"], str)


# ---------------------------------------------------------------------------
# AI STARTUP SEQUENCE
# ---------------------------------------------------------------------------

class TestAIStartupSequence(unittest.TestCase):

    def test_startup_validator_runs(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        report = run_startup_validation()
        self.assertIn("status", report)
        self.assertIn("checks", report)
        self.assertIn("passed", report)
        self.assertIn("warnings", report)
        self.assertIn("errors", report)
        self.assertGreater(report["total_checks"], 0)

    def test_startup_report_saved_to_disk(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        from pragati_ai_controller.config import get_config
        run_startup_validation()
        report_path = get_config().outputs_dir / "startup_validation.json"
        self.assertTrue(report_path.exists())

    def test_all_check_results_have_required_fields(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        report = run_startup_validation()
        for check in report["checks"]:
            self.assertIn("name", check)
            self.assertIn("passed", check)
            self.assertIn("message", check)
            self.assertIn("status", check)

    def test_python_version_check_passes(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        report = run_startup_validation()
        py_check = next(
            (c for c in report["checks"] if c["name"] == "python_version"), None
        )
        self.assertIsNotNone(py_check)
        self.assertTrue(py_check["passed"])

    def test_directories_created(self):
        from pragati_ai_controller.config import get_config
        cfg = get_config()
        self.assertTrue(cfg.logs_dir.exists())
        self.assertTrue(cfg.outputs_dir.exists())
        self.assertTrue(cfg.memory_dir.exists())


# ---------------------------------------------------------------------------
# AI PIPELINE END-TO-END
# ---------------------------------------------------------------------------

class TestAIPipelineEndToEnd(unittest.TestCase):

    def setUp(self):
        from pragati_ai_controller.controller import get_controller
        self.ctrl = get_controller()

    def test_text_pipeline_complete(self):
        r = self.ctrl.process(
            "मेरी फसल में बीमारी है",
            session_id="e2e_text_001",
            farmer_id="f001",
        )
        self.assertIn("success", r)
        self.assertEqual(r["pipeline"], "text")
        self.assertIn("response_text", r)
        self.assertIsInstance(r["response_text"], str)
        self.assertGreater(len(r["response_text"]), 0)

    def test_image_pipeline_nonexistent_graceful(self):
        r = self.ctrl.process(
            Path("nonexistent_leaf.jpg"),
            session_id="e2e_img_001",
        )
        self.assertEqual(r["pipeline"], "image")
        self.assertIn("error", r)

    def test_voice_pipeline_nonexistent_graceful(self):
        r = self.ctrl.process(
            Path("nonexistent.wav"),
            session_id="e2e_voice_001",
        )
        self.assertEqual(r["pipeline"], "voice")
        self.assertIn("error", r)

    def test_response_always_json_serialisable(self):
        import json
        r = self.ctrl.process("test query", session_id="e2e_json_001")
        try:
            json.dumps(r, default=str)
        except (TypeError, ValueError) as exc:
            self.fail(f"Response not JSON serialisable: {exc}")

    def test_concurrent_requests_safe(self):
        import threading
        results, errors = [], []

        def run(i):
            try:
                results.append(
                    self.ctrl.process(f"query {i}", session_id=f"e2e_conc_{i}")
                )
            except Exception as exc:
                errors.append(str(exc))

        threads = [threading.Thread(target=run, args=(i,)) for i in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 5)

    def test_performance_text_under_10s(self):
        t0 = time.perf_counter()
        self.ctrl.process("crop disease", session_id="e2e_perf_001")
        elapsed = time.perf_counter() - t0
        self.assertLess(elapsed, 10.0, f"Text pipeline took {elapsed:.1f}s > 10s")


if __name__ == "__main__":
    unittest.main(verbosity=2)
