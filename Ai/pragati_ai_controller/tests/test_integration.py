# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/tests/test_integration.py
# Run: python -m pytest pragati_ai_controller/tests/test_integration.py -v
# =============================================================================

from __future__ import annotations

import sys
import time
import threading
import unittest
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))


class TestConfig(unittest.TestCase):
    def test_loads(self):
        from pragati_ai_controller.config import get_config
        cfg = get_config()
        self.assertTrue(cfg.ai_root.exists())
        self.assertGreater(cfg.short_term_memory_limit, 0)

    def test_dirs_created(self):
        from pragati_ai_controller.config import get_config
        cfg = get_config()
        self.assertTrue(cfg.logs_dir.exists())
        self.assertTrue(cfg.outputs_dir.exists())
        self.assertTrue(cfg.memory_dir.exists())

    def test_singleton(self):
        from pragati_ai_controller.config import get_config
        self.assertIs(get_config(), get_config())


class TestLanguageManager(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.language_manager import get_language_manager
        self.lm = get_language_manager()

    def test_detect_hindi(self):
        self.assertEqual(self.lm.detect("मेरी फसल में बीमारी है"), "hi")

    def test_detect_english(self):
        self.assertEqual(self.lm.detect("my crop has disease"), "en")

    def test_explicit_override(self):
        self.assertEqual(self.lm.resolve("hello", explicit_language="hi"), "hi")

    def test_stt_priority(self):
        self.assertEqual(self.lm.resolve("hello", stt_language="hi"), "hi")

    def test_supported(self):
        self.assertTrue(self.lm.is_supported("hi"))
        self.assertFalse(self.lm.is_supported("xyz"))


class TestMemoryManager(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.memory_manager import MemoryManager
        self.mm = MemoryManager()
        self.sid = "test_mem_001"

    def tearDown(self):
        self.mm.delete_session(self.sid)

    def test_add_get(self):
        self.mm.add_turn(self.sid, "user", "hello", intent="greeting")
        turns = self.mm.get_short_term(self.sid)
        self.assertEqual(len(turns), 1)
        self.assertEqual(turns[0]["content"], "hello")

    def test_context_window(self):
        for i in range(10):
            self.mm.add_turn(self.sid, "user", f"msg {i}")
        self.assertEqual(len(self.mm.get_context_window(self.sid, max_turns=4)), 4)

    def test_flush_restore(self):
        self.mm.add_turn(self.sid, "user", "flush test")
        self.mm.flush_to_long_term(self.sid)
        self.mm.clear_short_term(self.sid)
        self.mm.restore_to_short_term(self.sid, last_n=5)
        self.assertGreater(len(self.mm.get_short_term(self.sid)), 0)


class TestContextManager(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.context_manager import ContextManager
        self.cm = ContextManager()
        self.sid = "test_ctx_001"

    def tearDown(self):
        self.cm.delete_session(self.sid)

    def test_init(self):
        ctx = self.cm.init_session(self.sid, farmer_id="f001", language="hi")
        self.assertEqual(ctx["farmer_id"], "f001")

    def test_increment_turn(self):
        self.cm.init_session(self.sid)
        self.assertEqual(self.cm.increment_turn(self.sid), 1)
        self.assertEqual(self.cm.increment_turn(self.sid), 2)

    def test_set_intent(self):
        self.cm.init_session(self.sid)
        self.cm.set_last_intent(self.sid, "disease")
        self.assertEqual(self.cm.get(self.sid)["last_intent"], "disease")


class TestConversationManager(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.conversation_manager import ConversationManager
        self.conv = ConversationManager()
        self.sid = "test_conv_001"

    def tearDown(self):
        self.conv.clear_session(self.sid)

    def test_record_turns(self):
        self.conv.start_session(self.sid, farmer_id="f001", language="hi")
        self.conv.record_user_turn(self.sid, "बीमारी है", intent="disease")
        self.conv.record_assistant_turn(self.sid, "झुलसा रोग", module_id="disease_ai")
        self.assertEqual(len(self.conv.get_history(self.sid)), 2)

    def test_context_as_text(self):
        self.conv.start_session(self.sid)
        self.conv.record_user_turn(self.sid, "hello")
        self.conv.record_assistant_turn(self.sid, "hi")
        text = self.conv.get_context_as_text(self.sid)
        self.assertIn("User:", text)
        self.assertIn("Assistant:", text)


class TestAIManager(unittest.TestCase):
    def test_status_keys(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        status = get_ai_manager().get_status()
        for key in ("stt", "intent", "router", "tts"):
            self.assertIn(key, status)

    def test_predict_intent(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        result = get_ai_manager().predict_intent("crop disease treatment")
        self.assertIn("intent", result)
        self.assertIn("confidence", result)

    def test_route(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        payload = {
            "intent": "general", "confidence": 0.5, "is_unknown": False,
            "text": "hello", "language": "latin", "timestamp": "", "top": [],
        }
        result = get_ai_manager().route(payload, session_id="test")
        self.assertIn("status", result)


class TestTextPipeline(unittest.TestCase):
    def test_runs(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        rr, lang, metrics, err = get_text_pipeline().run(
            text="मेरी फसल में पीले पत्ते हो रहे हैं",
            session_id="tp_001", farmer_id="f001",
        )
        self.assertIsInstance(rr, dict)
        self.assertIsInstance(lang, str)
        self.assertIn("total_ms", metrics)

    def test_empty_returns_error(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        _, _, _, err = get_text_pipeline().run(text="", session_id="tp_empty", farmer_id="")
        self.assertNotEqual(err, "")

    def test_english(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        rr, lang, metrics, err = get_text_pipeline().run(
            text="weather today", session_id="tp_en", farmer_id=""
        )
        self.assertIsInstance(rr, dict)


class TestResponseGenerator(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.response_generator import get_response_generator
        self.rg = get_response_generator()

    def test_build_success(self):
        rr = {
            "status": "success", "intent": "disease", "confidence": 0.9,
            "module_id": "disease_ai", "message": "Test response",
            "suggestions": [], "fallback_reason": "", "error": "", "data": None,
        }
        resp = self.rg.build("text", "s1", "f1", "hi", rr)
        self.assertTrue(resp["success"])
        self.assertEqual(resp["intent"], "disease")
        self.assertIn("metrics", resp)

    def test_build_error(self):
        resp = self.rg.build_error("text", "s1", "f1", "hi", "Test error")
        self.assertFalse(resp["success"])
        self.assertEqual(resp["error"], "Test error")

    def test_metrics_normalised(self):
        resp = self.rg.build("text", "s1", "f1", "en", {},
                             metrics={"total_ms": 123.4, "intent_ms": 45.6})
        self.assertEqual(resp["metrics"]["total_ms"], 123.4)
        self.assertEqual(resp["metrics"]["stt_ms"], 0.0)


class TestController(unittest.TestCase):
    def setUp(self):
        from pragati_ai_controller.controller import get_controller
        self.ctrl = get_controller()

    def test_health_check(self):
        h = self.ctrl.health_check()
        self.assertIn("status", h)
        self.assertIn("modules", h)
        self.assertIn("assets", h)

    def test_process_hindi_text(self):
        r = self.ctrl.process("मेरी फसल में बीमारी है", session_id="ctrl_001", farmer_id="f001")
        self.assertIn("success", r)
        self.assertEqual(r["pipeline"], "text")
        self.assertIn("response_text", r)
        self.assertIn("metrics", r)

    def test_process_english_text(self):
        r = self.ctrl.process("tell me about crop diseases", session_id="ctrl_002")
        self.assertEqual(r["pipeline"], "text")

    def test_detect_text(self):
        from pragati_ai_controller.controller import detect_input_type
        self.assertEqual(detect_input_type("hello world"), "text")

    def test_detect_voice(self):
        from pragati_ai_controller.controller import detect_input_type
        self.assertEqual(detect_input_type(Path("audio.wav")), "voice")
        self.assertEqual(detect_input_type("rec.mp3"), "voice")

    def test_detect_image(self):
        from pragati_ai_controller.controller import detect_input_type
        self.assertEqual(detect_input_type(Path("leaf.jpg")), "image")
        self.assertEqual(detect_input_type("photo.png"), "image")

    def test_session_history(self):
        sid = "ctrl_hist_001"
        self.ctrl.process("hello", session_id=sid)
        self.assertIsInstance(self.ctrl.get_session_history(sid), list)

    def test_singleton(self):
        from pragati_ai_controller.controller import get_controller
        self.assertIs(get_controller(), get_controller())

    def test_concurrent(self):
        results, errors = [], []

        def run(i):
            try:
                results.append(self.ctrl.process(f"query {i}", session_id=f"conc_{i}"))
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=run, args=(i,)) for i in range(5)]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 5)


class TestStartupValidator(unittest.TestCase):
    def test_runs(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        report = run_startup_validation()
        self.assertIn("status", report)
        self.assertIn("checks", report)
        self.assertGreater(report["total_checks"], 0)

    def test_report_on_disk(self):
        from pragati_ai_controller.startup_validator import run_startup_validation
        from pragati_ai_controller.config import get_config
        run_startup_validation()
        self.assertTrue((get_config().outputs_dir / "startup_validation.json").exists())


class TestPerformance(unittest.TestCase):
    def test_text_pipeline_under_5s(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        t0 = time.perf_counter()
        get_text_pipeline().run("crop disease", session_id="perf_001", farmer_id="")
        self.assertLess(time.perf_counter() - t0, 5.0)

    def test_controller_under_5s(self):
        from pragati_ai_controller.controller import get_controller
        t0 = time.perf_counter()
        get_controller().process("weather today", session_id="perf_002")
        self.assertLess(time.perf_counter() - t0, 5.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
