# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/tests/test_predictor.py
# Tests: Predictor — 30 unit tests
# Run:   python -m pytest intent_engine/tests/test_predictor.py -v
# =============================================================================

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from intent_engine.predictor import (
    Predictor,
    PredictionResult,
    get_predictor,
    predict_intent,
)
from intent_engine.intent_classifier import (
    ClassificationResult,
    UNKNOWN_INTENT,
)


# ---------------------------------------------------------------------------
# FIXTURES
# ---------------------------------------------------------------------------

INTENTS = ["crop", "disease", "weather", "market", "general"]


def _make_clf_result(
    intent:     str   = "crop",
    confidence: float = 0.85,
    is_unknown: bool  = False,
    lang:       str   = "latin",
    metadata:   dict  | None = None,
) -> ClassificationResult:
    return ClassificationResult(
        text            = "crop disease in wheat",
        raw_text        = "Crop Disease in Wheat",
        intent          = intent,
        confidence      = confidence,
        is_unknown      = is_unknown,
        top_predictions = [(intent, confidence), ("disease", 0.10)],
        language_hint   = lang,
        timestamp       = "2025-01-01T00:00:00+00:00",
        metadata        = metadata or {},
    )


def _make_predictor(clf_result: ClassificationResult | None = None) -> Predictor:
    """Returns a Predictor with a mocked IntentClassifier."""
    predictor = Predictor(confidence_threshold=0.30)
    mock_clf = MagicMock()
    mock_clf.is_loaded.return_value = True
    mock_clf.confidence_threshold   = 0.30
    mock_clf.get_model_metadata.return_value = {
        "model_type":   "logistic",
        "num_classes":  5,
        "classes":      INTENTS,
        "trained_at":   "2025-01-01T00:00:00+00:00",
        "train_size":   100,
        "test_metrics": {"accuracy": 0.92},
    }
    mock_clf.get_supported_intents.return_value = INTENTS

    result = clf_result or _make_clf_result()
    mock_clf.classify.return_value           = result
    mock_clf.classify_batch.return_value     = [result]
    mock_clf.classify_from_stt.return_value  = result

    predictor._classifier    = mock_clf
    predictor._model_version = "2025-01-01T00:00:00+00:00"
    return predictor


# ---------------------------------------------------------------------------
# PredictionResult
# ---------------------------------------------------------------------------

class TestPredictionResult:
    def test_to_dict_keys(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease")
        d = result.to_dict()
        for key in ("intent", "confidence", "is_unknown", "top_predictions",
                    "text", "raw_text", "language_hint", "timestamp",
                    "model_version", "metadata"):
            assert key in d

    def test_to_dict_json_serialisable(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease")
        # Should not raise
        json.dumps(result.to_dict())

    def test_to_router_payload_keys(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease")
        payload = result.to_router_payload()
        for key in ("intent", "confidence", "is_unknown", "text",
                    "language", "timestamp", "top"):
            assert key in payload

    def test_to_router_payload_no_raw_text(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease")
        payload = result.to_router_payload()
        assert "raw_text" not in payload

    def test_top_predictions_list_of_dicts(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease")
        assert isinstance(result.top_predictions, list)
        for item in result.top_predictions:
            assert "intent" in item
            assert "confidence" in item


# ---------------------------------------------------------------------------
# Predictor — load
# ---------------------------------------------------------------------------

class TestPredictorLoad:
    def test_load_returns_self(self):
        predictor = Predictor()
        mock_clf = MagicMock()
        mock_clf.is_loaded.return_value = False
        mock_clf.load.return_value = mock_clf
        mock_clf.get_model_metadata.return_value = {"trained_at": "2025-01-01"}
        predictor._classifier = mock_clf
        result = predictor.load()
        assert result is predictor

    def test_is_ready_false_before_load(self):
        predictor = Predictor()
        mock_clf = MagicMock()
        mock_clf.is_loaded.return_value = False
        predictor._classifier = mock_clf
        assert predictor.is_ready() is False

    def test_is_ready_true_after_load(self):
        predictor = _make_predictor()
        assert predictor.is_ready() is True


# ---------------------------------------------------------------------------
# Predictor — predict
# ---------------------------------------------------------------------------

class TestPredictorPredict:
    def test_returns_prediction_result(self):
        predictor = _make_predictor()
        result = predictor.predict("crop disease in wheat")
        assert isinstance(result, PredictionResult)

    def test_correct_intent(self):
        predictor = _make_predictor(_make_clf_result(intent="crop", confidence=0.85))
        result = predictor.predict("crop disease")
        assert result.intent == "crop"

    def test_confidence_value(self):
        predictor = _make_predictor(_make_clf_result(confidence=0.85))
        result = predictor.predict("crop disease")
        assert result.confidence == pytest.approx(0.85)

    def test_is_unknown_false(self):
        predictor = _make_predictor(_make_clf_result(is_unknown=False))
        result = predictor.predict("crop disease")
        assert result.is_unknown is False

    def test_is_unknown_true(self):
        predictor = _make_predictor(
            _make_clf_result(intent=UNKNOWN_INTENT, confidence=0.20, is_unknown=True)
        )
        result = predictor.predict("ambiguous text")
        assert result.is_unknown is True
        assert result.intent == UNKNOWN_INTENT

    def test_model_version_set(self):
        predictor = _make_predictor()
        result = predictor.predict("crop")
        assert result.model_version == "2025-01-01T00:00:00+00:00"

    def test_metadata_forwarded(self):
        predictor = _make_predictor(
            _make_clf_result(metadata={"session_id": "xyz"})
        )
        result = predictor.predict("crop", metadata={"session_id": "xyz"})
        assert result.metadata.get("session_id") == "xyz"

    def test_language_hint_devanagari(self):
        predictor = _make_predictor(
            _make_clf_result(lang="devanagari")
        )
        result = predictor.predict("मेरी फसल में बीमारी है")
        assert result.language_hint == "devanagari"

    def test_timestamp_present(self):
        predictor = _make_predictor()
        result = predictor.predict("crop")
        assert isinstance(result.timestamp, str)


# ---------------------------------------------------------------------------
# Predictor — predict_batch
# ---------------------------------------------------------------------------

class TestPredictorBatch:
    def test_batch_returns_list(self):
        clf_results = [
            _make_clf_result(intent="crop"),
            _make_clf_result(intent="disease"),
        ]
        predictor = _make_predictor()
        predictor._classifier.classify_batch.return_value = clf_results
        results = predictor.predict_batch(["crop problem", "disease in wheat"])
        assert len(results) == 2

    def test_batch_empty_input(self):
        predictor = _make_predictor()
        results = predictor.predict_batch([])
        assert results == []

    def test_batch_all_prediction_results(self):
        clf_results = [_make_clf_result(), _make_clf_result()]
        predictor = _make_predictor()
        predictor._classifier.classify_batch.return_value = clf_results
        results = predictor.predict_batch(["a", "b"])
        assert all(isinstance(r, PredictionResult) for r in results)

    def test_batch_unknown_count_logged(self, caplog):
        clf_results = [
            _make_clf_result(intent=UNKNOWN_INTENT, is_unknown=True),
            _make_clf_result(intent="crop"),
        ]
        predictor = _make_predictor()
        predictor._classifier.classify_batch.return_value = clf_results
        results = predictor.predict_batch(["?", "crop"])
        unknown = sum(1 for r in results if r.is_unknown)
        assert unknown == 1


# ---------------------------------------------------------------------------
# Predictor — predict_from_stt
# ---------------------------------------------------------------------------

class TestPredictorFromSTT:
    def test_stt_returns_prediction_result(self):
        predictor = _make_predictor()
        result = predictor.predict_from_stt({"text": "crop disease", "language": "en"})
        assert isinstance(result, PredictionResult)

    def test_stt_intent_correct(self):
        predictor = _make_predictor(_make_clf_result(intent="crop"))
        result = predictor.predict_from_stt({"text": "crop disease"})
        assert result.intent == "crop"

    def test_stt_metadata_source(self):
        predictor = _make_predictor(
            _make_clf_result(metadata={"source": "stt", "stt_language": "hi"})
        )
        result = predictor.predict_from_stt({"text": "crop", "language": "hi"})
        assert result.metadata.get("source") == "stt"


# ---------------------------------------------------------------------------
# Predictor — configuration
# ---------------------------------------------------------------------------

class TestPredictorConfiguration:
    def test_get_supported_intents(self):
        predictor = _make_predictor()
        intents = predictor.get_supported_intents()
        assert "crop" in intents

    def test_get_model_info_keys(self):
        predictor = _make_predictor()
        info = predictor.get_model_info()
        for key in ("model_type", "num_classes", "classes", "trained_at",
                    "train_size", "test_accuracy", "confidence_threshold"):
            assert key in info

    def test_confidence_threshold_property(self):
        predictor = _make_predictor()
        predictor._classifier.confidence_threshold = 0.30
        assert predictor.confidence_threshold == pytest.approx(0.30)


# ---------------------------------------------------------------------------
# get_predictor singleton
# ---------------------------------------------------------------------------

class TestGetPredictor:
    def test_returns_predictor(self):
        p = get_predictor(force_rebuild=True)
        assert isinstance(p, Predictor)

    def test_singleton_same_instance(self):
        p1 = get_predictor()
        p2 = get_predictor()
        assert p1 is p2

    def test_force_rebuild_new_instance(self):
        p1 = get_predictor()
        p2 = get_predictor(force_rebuild=True)
        assert p1 is not p2


# ---------------------------------------------------------------------------
# predict_intent convenience function
# ---------------------------------------------------------------------------

class TestPredictIntentConvenience:
    def test_returns_prediction_result(self):
        with patch("intent_engine.predictor.get_predictor") as mock_get:
            mock_predictor = MagicMock()
            mock_predictor.predict.return_value = PredictionResult(
                intent="crop", confidence=0.85, is_unknown=False,
                top_predictions=[{"intent": "crop", "confidence": 0.85}],
                text="crop disease", raw_text="crop disease",
                language_hint="latin", timestamp="2025-01-01T00:00:00+00:00",
                model_version="2025-01-01", metadata={},
            )
            mock_get.return_value = mock_predictor
            result = predict_intent("crop disease")
            assert isinstance(result, PredictionResult)
            assert result.intent == "crop"
