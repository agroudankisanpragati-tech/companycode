# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/tests/test_api.py
# Purpose: API-level tests for FastAPI YOLO inference server + controller.
# Run: python -m pytest pragati_ai_controller/tests/test_api.py -v
# =============================================================================

from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))


class TestFastAPIServer(unittest.TestCase):
    """Tests for the YOLO FastAPI inference server."""

    @classmethod
    def setUpClass(cls):
        try:
            from fastapi.testclient import TestClient
            from fastapi_server import app
            cls.client = TestClient(app)
            cls.available = True
        except Exception:
            cls.available = False

    def _skip_if_unavailable(self):
        if not self.available:
            self.skipTest("FastAPI server not available")

    def test_health_endpoint(self):
        self._skip_if_unavailable()
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)
        self.assertIn("version", data)

    def test_crops_endpoint(self):
        self._skip_if_unavailable()
        r = self.client.get("/crops")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("crops", data)
        self.assertIn("total_crops", data)

    def test_predict_no_image_returns_422(self):
        self._skip_if_unavailable()
        r = self.client.post("/predict")
        self.assertIn(r.status_code, (400, 422))

    def test_predict_invalid_file_returns_400(self):
        self._skip_if_unavailable()
        fake = io.BytesIO(b"not an image")
        r = self.client.post(
            "/predict",
            files={"image": ("test.txt", fake, "text/plain")},
        )
        self.assertIn(r.status_code, (400, 422))

    def test_predict_with_real_image(self):
        self._skip_if_unavailable()
        sample = None
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            found = list(_AI_ROOT.rglob(ext))
            if found:
                sample = found[0]
                break
        if sample is None:
            self.skipTest("No sample image found")

        with open(sample, "rb") as f:
            r = self.client.post(
                "/predict",
                files={"image": (sample.name, f, "image/jpeg")},
            )
        self.assertIn(r.status_code, (200, 500))
        if r.status_code == 200:
            data = r.json()
            self.assertIn("status", data)

    def test_predict_with_crop_hint(self):
        self._skip_if_unavailable()
        sample = None
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            found = list(_AI_ROOT.rglob(ext))
            if found:
                sample = found[0]
                break
        if sample is None:
            self.skipTest("No sample image found")

        with open(sample, "rb") as f:
            r = self.client.post(
                "/predict",
                files={"image": (sample.name, f, "image/jpeg")},
                data={"crop_hint": "Tomato"},
            )
        self.assertIn(r.status_code, (200, 422, 500))

    def test_predict_unknown_crop_returns_422(self):
        self._skip_if_unavailable()
        sample = None
        for ext in ("*.jpg",):
            found = list(_AI_ROOT.rglob(ext))
            if found:
                sample = found[0]
                break
        if sample is None:
            self.skipTest("No sample image found")

        with open(sample, "rb") as f:
            r = self.client.post(
                "/predict",
                files={"image": (sample.name, f, "image/jpeg")},
                data={"crop_hint": "totally_unknown_crop_xyz"},
            )
        self.assertEqual(r.status_code, 422)


class TestControllerAPIContract(unittest.TestCase):
    """Validates the controller response envelope matches the API contract."""

    def setUp(self):
        from pragati_ai_controller.controller import get_controller
        self.ctrl = get_controller()

    def test_text_response_contract(self):
        r = self.ctrl.process("crop disease", session_id="api_text_001")
        required_keys = [
            "success", "version", "pipeline", "session_id", "farmer_id",
            "language", "intent", "confidence", "module_id", "response_text",
            "response_audio", "knowledge", "router_data", "suggestions",
            "fallback_reason", "error", "metrics", "timestamp",
        ]
        for k in required_keys:
            self.assertIn(k, r, f"Missing key in response: {k}")

    def test_success_field_is_bool(self):
        r = self.ctrl.process("hello", session_id="api_bool_001")
        self.assertIsInstance(r["success"], bool)

    def test_confidence_is_float(self):
        r = self.ctrl.process("disease query", session_id="api_float_001")
        self.assertIsInstance(r["confidence"], float)

    def test_suggestions_is_list(self):
        r = self.ctrl.process("unknown xyz", session_id="api_list_001")
        self.assertIsInstance(r["suggestions"], list)

    def test_metrics_is_dict(self):
        r = self.ctrl.process("test", session_id="api_metrics_001")
        self.assertIsInstance(r["metrics"], dict)

    def test_response_text_is_str(self):
        r = self.ctrl.process("hello", session_id="api_str_001")
        self.assertIsInstance(r["response_text"], str)

    def test_version_matches(self):
        from pragati_ai_controller.config import CONTROLLER_VERSION
        r = self.ctrl.process("test", session_id="api_ver_001")
        self.assertEqual(r["version"], CONTROLLER_VERSION)

    def test_pipeline_field_valid(self):
        r = self.ctrl.process("test text", session_id="api_pipe_001")
        self.assertIn(r["pipeline"], ("text", "voice", "image"))

    def test_image_pipeline_contract(self):
        r = self.ctrl.process(Path("nonexistent.jpg"), session_id="api_img_001")
        self.assertEqual(r["pipeline"], "image")
        self.assertIn("knowledge", r)

    def test_voice_pipeline_contract(self):
        r = self.ctrl.process(Path("nonexistent.wav"), session_id="api_voice_001")
        self.assertEqual(r["pipeline"], "voice")
        self.assertIn("response_audio", r)

    def test_json_serialisable(self):
        r = self.ctrl.process("test serialise", session_id="api_json_001")
        try:
            json.dumps(r, default=str)
        except (TypeError, ValueError) as e:
            self.fail(f"Response not JSON serialisable: {e}")

    def test_farmer_id_preserved(self):
        r = self.ctrl.process("test", session_id="api_fid_001", farmer_id="farmer_xyz")
        self.assertEqual(r["farmer_id"], "farmer_xyz")

    def test_error_response_contract(self):
        from pragati_ai_controller.response_generator import get_response_generator
        rg = get_response_generator()
        r = rg.build_error("text", "s1", "f1", "hi", "test error")
        self.assertFalse(r["success"])
        self.assertIsInstance(r["error"], str)
        self.assertIn("metrics", r)
        self.assertIn("timestamp", r)


class TestKnowledgeServiceAPI(unittest.TestCase):
    """Tests for MongoDB KnowledgeService API contract."""

    @classmethod
    def setUpClass(cls):
        try:
            from knowledge_service import KnowledgeService
            cls.svc = KnowledgeService()
            cls.available = True
        except Exception:
            cls.available = False

    def _skip_if_unavailable(self):
        if not self.available:
            self.skipTest("KnowledgeService not available")

    def test_health_check_returns_dict(self):
        self._skip_if_unavailable()
        h = self.svc.health_check()
        self.assertIn("status", h)
        self.assertIn("db", h)
        self.assertIn("collection", h)

    def test_lookup_returns_knowledge_result(self):
        self._skip_if_unavailable()
        result = self.svc.lookup("green_gram", "diseases", "Yellow Mosaic")
        self.assertIsInstance(result.found, bool)
        self.assertIsInstance(result.crop, str)
        self.assertIsInstance(result.to_dict(), dict)

    def test_lookup_empty_returns_not_found(self):
        self._skip_if_unavailable()
        result = self.svc.lookup("", "", "")
        self.assertFalse(result.found)

    def test_lookup_from_prediction_bad_status(self):
        self._skip_if_unavailable()
        result = self.svc.lookup_from_prediction({"status": "error"})
        self.assertFalse(result.found)

    def test_to_dict_keys(self):
        self._skip_if_unavailable()
        result = self.svc.lookup("Tomato", "diseases", "Early Blight")
        d = result.to_dict()
        for key in ("found", "crop", "category", "class_name", "description"):
            self.assertIn(key, d)


class TestInferenceServiceAPI(unittest.TestCase):
    """Tests for InferenceService API contract."""

    @classmethod
    def setUpClass(cls):
        try:
            from inference_service import InferenceService
            cls.svc = InferenceService()
            cls.available = True
        except Exception:
            cls.available = False

    def _skip_if_unavailable(self):
        if not self.available:
            self.skipTest("InferenceService not available")

    def test_health_check(self):
        self._skip_if_unavailable()
        h = self.svc.health_check()
        self.assertIn("status", h)
        self.assertIn("device", h)
        self.assertIn("weights_exists", h)

    def test_predict_single_nonexistent(self):
        self._skip_if_unavailable()
        r = self.svc.predict_single("nonexistent_image.jpg")
        self.assertIsInstance(r.success, bool)

    def test_predict_batch_empty(self):
        self._skip_if_unavailable()
        r = self.svc.predict_batch([])
        self.assertTrue(r.success)
        self.assertEqual(r.data, [])

    def test_predict_batch_not_list(self):
        self._skip_if_unavailable()
        r = self.svc.predict_batch("not_a_list")
        self.assertFalse(r.success)


if __name__ == "__main__":
    unittest.main(verbosity=2)
