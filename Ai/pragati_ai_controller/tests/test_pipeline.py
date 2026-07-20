# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/tests/test_pipeline.py
# Purpose: Pipeline-level tests — text, voice, image flows.
# Run: python -m pytest pragati_ai_controller/tests/test_pipeline.py -v
# =============================================================================

from __future__ import annotations

import sys
import unittest
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))


class TestTextPipelineFlow(unittest.TestCase):
    """Text → Intent → Router → Response"""

    def setUp(self):
        from pragati_ai_controller.pipeline import get_text_pipeline
        self.pipeline = get_text_pipeline()

    def test_hindi_disease_query(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="मेरी फसल में पीले पत्ते हो रहे हैं",
            session_id="flow_hi_001", farmer_id="f001",
        )
        self.assertEqual(err, "")
        self.assertIn("intent", rr)
        self.assertIn("status", rr)
        self.assertGreater(metrics["total_ms"], 0)

    def test_english_weather_query(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="what is the weather forecast for tomorrow",
            session_id="flow_en_001", farmer_id="",
        )
        self.assertEqual(err, "")
        self.assertIn("intent", rr)

    def test_hindi_market_query(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="आज मंडी में गेहूं का भाव क्या है",
            session_id="flow_mkt_001", farmer_id="",
        )
        self.assertEqual(err, "")
        self.assertIn("intent", rr)

    def test_greeting(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="नमस्ते", session_id="flow_greet_001", farmer_id="",
        )
        self.assertEqual(err, "")

    def test_language_explicit_override(self):
        rr, lang, metrics, err = self.pipeline.run(
            text="hello", session_id="flow_lang_001", farmer_id="",
            explicit_language="hi",
        )
        self.assertEqual(lang, "hi")

    def test_metrics_structure(self):
        _, _, metrics, _ = self.pipeline.run(
            text="soil test", session_id="flow_metrics_001", farmer_id="",
        )
        for key in ("stt_ms", "intent_ms", "router_ms", "tts_ms", "total_ms"):
            self.assertIn(key, metrics)
            self.assertGreaterEqual(metrics[key], 0.0)

    def test_router_result_structure(self):
        rr, _, _, _ = self.pipeline.run(
            text="fertilizer recommendation",
            session_id="flow_struct_001", farmer_id="",
        )
        for key in ("status", "intent", "confidence", "module_id"):
            self.assertIn(key, rr)


class TestVoicePipelineFlow(unittest.TestCase):
    """Voice → STT → Intent → Router → TTS → Response"""

    def setUp(self):
        from pragati_ai_controller.pipeline import get_voice_pipeline
        self.pipeline = get_voice_pipeline()

    def test_stt_unavailable_returns_error(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        am = get_ai_manager()
        if not am.is_stt_available():
            rr, lang, metrics, err, audio = self.pipeline.run(
                audio_path=Path("nonexistent.wav"),
                session_id="voice_001", farmer_id="",
            )
            self.assertNotEqual(err, "")

    def test_nonexistent_audio_returns_error(self):
        rr, lang, metrics, err, audio = self.pipeline.run(
            audio_path=Path("nonexistent_audio_file.wav"),
            session_id="voice_002", farmer_id="",
        )
        self.assertNotEqual(err, "")

    def test_returns_five_tuple(self):
        result = self.pipeline.run(
            audio_path=Path("nonexistent.wav"),
            session_id="voice_003", farmer_id="",
        )
        self.assertEqual(len(result), 5)

    def test_metrics_keys_present(self):
        _, _, metrics, _, _ = self.pipeline.run(
            audio_path=Path("nonexistent.wav"),
            session_id="voice_004", farmer_id="",
        )
        for key in ("stt_ms", "intent_ms", "router_ms", "tts_ms", "total_ms"):
            self.assertIn(key, metrics)


class TestImagePipelineFlow(unittest.TestCase):
    """Image → InferenceService → KnowledgeService → Response"""

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

    def test_language_default(self):
        from pragati_ai_controller.config import get_config
        _, _, lang, _, _ = self.pipeline.run(
            image_path=Path("nonexistent.jpg"),
            session_id="img_003", farmer_id="",
        )
        self.assertEqual(lang, get_config().default_language)

    def test_explicit_language(self):
        _, _, lang, _, _ = self.pipeline.run(
            image_path=Path("nonexistent.jpg"),
            session_id="img_004", farmer_id="",
            explicit_language="en",
        )
        self.assertEqual(lang, "en")

    def test_real_image_if_exists(self):
        from pragati_ai_controller.config import get_config
        cfg = get_config()
        sample = None
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            found = list(cfg.ai_root.rglob(ext))
            if found:
                sample = found[0]
                break
        if sample is None:
            self.skipTest("No sample image found in project")

        rr, kb, lang, metrics, err = self.pipeline.run(
            image_path=sample,
            session_id="img_real_001", farmer_id="",
        )
        self.assertIsInstance(rr, dict)
        self.assertIsInstance(metrics, dict)


class TestControllerPipelineRouting(unittest.TestCase):
    """Controller correctly routes to each pipeline."""

    def setUp(self):
        from pragati_ai_controller.controller import get_controller
        self.ctrl = get_controller()

    def test_text_routing(self):
        r = self.ctrl.process("crop disease", session_id="route_text_001")
        self.assertEqual(r["pipeline"], "text")

    def test_voice_routing_nonexistent(self):
        r = self.ctrl.process(Path("nonexistent.wav"), session_id="route_voice_001")
        self.assertEqual(r["pipeline"], "voice")

    def test_image_routing_nonexistent(self):
        r = self.ctrl.process(Path("nonexistent.jpg"), session_id="route_img_001")
        self.assertEqual(r["pipeline"], "image")

    def test_response_envelope_keys(self):
        r = self.ctrl.process("hello", session_id="route_keys_001")
        required = [
            "success", "version", "pipeline", "session_id", "farmer_id",
            "language", "intent", "confidence", "module_id", "response_text",
            "response_audio", "knowledge", "router_data", "suggestions",
            "fallback_reason", "error", "metrics", "timestamp",
        ]
        for key in required:
            self.assertIn(key, r, f"Missing key: {key}")

    def test_metrics_always_present(self):
        r = self.ctrl.process("test", session_id="route_metrics_001")
        self.assertIn("metrics", r)
        for key in ("total_ms", "stt_ms", "intent_ms", "router_ms"):
            self.assertIn(key, r["metrics"])

    def test_session_id_preserved(self):
        sid = "route_sid_001"
        r = self.ctrl.process("hello", session_id=sid)
        self.assertEqual(r["session_id"], sid)

    def test_auto_session_id(self):
        r = self.ctrl.process("hello")
        self.assertIn("session_id", r)
        self.assertTrue(r["session_id"].startswith("sess_"))


class TestKnowledgeRouterIntegration(unittest.TestCase):
    """Knowledge Router integration via AIManager."""

    def setUp(self):
        from pragati_ai_controller.ai_manager import get_ai_manager
        self.am = get_ai_manager()

    def _make_payload(self, intent: str, confidence: float = 0.8) -> dict:
        return {
            "intent": intent, "confidence": confidence,
            "is_unknown": False, "text": f"test {intent}",
            "language": "latin", "timestamp": "", "top": [],
        }

    def test_route_disease(self):
        r = self.am.route(self._make_payload("disease"), session_id="kr_001")
        self.assertIn("status", r)
        self.assertIn("module_id", r)

    def test_route_weather(self):
        r = self.am.route(self._make_payload("weather"), session_id="kr_002")
        self.assertIn("intent", r)

    def test_route_low_confidence_fallback(self):
        r = self.am.route(self._make_payload("disease", confidence=0.1), session_id="kr_003")
        self.assertIn("status", r)

    def test_route_unknown_intent(self):
        payload = self._make_payload("unknown_xyz", confidence=0.0)
        payload["is_unknown"] = True
        r = self.am.route(payload, session_id="kr_004")
        self.assertIn("status", r)


if __name__ == "__main__":
    unittest.main(verbosity=2)
