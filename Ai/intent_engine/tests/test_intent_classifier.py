# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/tests/test_intent_classifier.py
# Tests: IntentClassifier — 30 unit tests
# Run:   python -m pytest intent_engine/tests/test_intent_classifier.py -v
# =============================================================================

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from intent_engine.intent_classifier import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    UNKNOWN_INTENT,
    ClassificationResult,
    IntentClassifier,
    _detect_script,
    get_classifier,
    normalise_text,
)


# ---------------------------------------------------------------------------
# FIXTURES
# ---------------------------------------------------------------------------

INTENTS = ["crop", "disease", "weather", "market", "general"]


def _make_artefacts(proba: dict[str, float] | None = None):
    """Returns a mock ModelArtefacts with controllable predict_proba output."""
    if proba is None:
        proba = {"crop": 0.80, "disease": 0.10, "weather": 0.05, "market": 0.03, "general": 0.02}

    artefacts = MagicMock()
    artefacts.metadata = {
        "model_type":  "logistic",
        "num_classes": len(INTENTS),
        "classes":     INTENTS,
        "trained_at":  "2025-01-01T00:00:00+00:00",
        "train_size":  100,
        "test_metrics": {"accuracy": 0.92},
    }
    artefacts.predict_proba.return_value = [proba]
    artefacts.predict.return_value = [max(proba, key=proba.get)]
    return artefacts


def _make_classifier(proba=None, threshold=DEFAULT_CONFIDENCE_THRESHOLD):
    """Returns an IntentClassifier with mocked artefacts already loaded."""
    clf = IntentClassifier(confidence_threshold=threshold)
    clf._artefacts = _make_artefacts(proba)
    return clf


# ---------------------------------------------------------------------------
# normalise_text
# ---------------------------------------------------------------------------

class TestNormaliseText:
    def test_lowercase(self):
        assert normalise_text("CROP DISEASE") == "crop disease"

    def test_collapse_whitespace(self):
        assert normalise_text("crop   disease\t\nweather") == "crop disease weather"

    def test_strip(self):
        assert normalise_text("  hello  ") == "hello"

    def test_devanagari_preserved(self):
        text = "मेरी फसल में बीमारी है"
        result = normalise_text(text)
        assert "मेरी" in result
        assert "बीमारी" in result

    def test_mixed_preserved(self):
        result = normalise_text("मेरी crop में disease है")
        assert "मेरी" in result
        assert "crop" in result

    def test_empty_string(self):
        assert normalise_text("") == ""

    def test_unicode_nfc(self):
        # NFC normalisation should not break normal text
        result = normalise_text("café")
        assert result == "café"


# ---------------------------------------------------------------------------
# _detect_script
# ---------------------------------------------------------------------------

class TestDetectScript:
    def test_latin_english(self):
        assert _detect_script("what is the weather today") == "latin"

    def test_devanagari_hindi(self):
        assert _detect_script("मेरी फसल में बीमारी है") == "devanagari"

    def test_mixed(self):
        assert _detect_script("मेरी crop disease है") == "mixed"

    def test_empty(self):
        assert _detect_script("") == "unknown"

    def test_digits_only(self):
        assert _detect_script("12345") == "unknown"

    def test_pure_latin(self):
        assert _detect_script("hello world") == "latin"


# ---------------------------------------------------------------------------
# IntentClassifier — load
# ---------------------------------------------------------------------------

class TestIntentClassifierLoad:
    def test_load_calls_manager(self):
        clf = IntentClassifier()
        mock_manager = MagicMock()
        mock_manager.load.return_value = _make_artefacts()
        clf._manager = mock_manager
        clf.load()
        mock_manager.load.assert_called_once()

    def test_is_loaded_false_before_load(self):
        clf = IntentClassifier()
        assert clf.is_loaded() is False

    def test_is_loaded_true_after_load(self):
        clf = IntentClassifier()
        clf._artefacts = _make_artefacts()
        assert clf.is_loaded() is True

    def test_load_returns_self(self):
        clf = IntentClassifier()
        mock_manager = MagicMock()
        mock_manager.load.return_value = _make_artefacts()
        clf._manager = mock_manager
        result = clf.load()
        assert result is clf

    def test_double_load_does_not_reload(self):
        clf = IntentClassifier()
        mock_manager = MagicMock()
        mock_manager.load.return_value = _make_artefacts()
        clf._manager = mock_manager
        clf.load()
        clf.load()
        mock_manager.load.assert_called_once()


# ---------------------------------------------------------------------------
# IntentClassifier — classify
# ---------------------------------------------------------------------------

class TestIntentClassifierClassify:
    def test_returns_classification_result(self):
        clf = _make_classifier()
        result = clf.classify("crop disease in wheat")
        assert isinstance(result, ClassificationResult)

    def test_correct_intent(self):
        clf = _make_classifier({"crop": 0.90, "disease": 0.05, "weather": 0.03, "market": 0.01, "general": 0.01})
        result = clf.classify("wheat crop problem")
        assert result.intent == "crop"

    def test_confidence_value(self):
        clf = _make_classifier({"crop": 0.85, "disease": 0.10, "weather": 0.03, "market": 0.01, "general": 0.01})
        result = clf.classify("crop issue")
        assert result.confidence == pytest.approx(0.85, abs=0.001)

    def test_is_unknown_false_above_threshold(self):
        clf = _make_classifier({"crop": 0.80, "disease": 0.10, "weather": 0.05, "market": 0.03, "general": 0.02})
        result = clf.classify("crop problem")
        assert result.is_unknown is False

    def test_is_unknown_true_below_threshold(self):
        low_proba = {"crop": 0.20, "disease": 0.20, "weather": 0.20, "market": 0.20, "general": 0.20}
        clf = _make_classifier(low_proba, threshold=0.30)
        result = clf.classify("some ambiguous text")
        assert result.is_unknown is True
        assert result.intent == UNKNOWN_INTENT

    def test_empty_text_returns_unknown(self):
        clf = _make_classifier()
        result = clf.classify("")
        assert result.is_unknown is True
        assert result.intent == UNKNOWN_INTENT

    def test_whitespace_only_returns_unknown(self):
        clf = _make_classifier()
        result = clf.classify("   ")
        assert result.is_unknown is True

    def test_top_predictions_length(self):
        clf = _make_classifier()
        result = clf.classify("crop disease")
        assert len(result.top_predictions) <= clf.top_n

    def test_top_predictions_sorted_descending(self):
        clf = _make_classifier()
        result = clf.classify("crop disease")
        confs = [c for _, c in result.top_predictions]
        assert confs == sorted(confs, reverse=True)

    def test_language_hint_latin(self):
        clf = _make_classifier()
        result = clf.classify("what is the weather today")
        assert result.language_hint == "latin"

    def test_language_hint_devanagari(self):
        clf = _make_classifier()
        result = clf.classify("मेरी फसल में बीमारी है")
        assert result.language_hint == "devanagari"

    def test_metadata_forwarded(self):
        clf = _make_classifier()
        meta = {"session_id": "abc123"}
        result = clf.classify("crop disease", metadata=meta)
        assert result.metadata["session_id"] == "abc123"

    def test_raw_text_preserved(self):
        clf = _make_classifier()
        raw = "  CROP DISEASE  "
        result = clf.classify(raw)
        assert result.raw_text == raw

    def test_timestamp_is_string(self):
        clf = _make_classifier()
        result = clf.classify("crop")
        assert isinstance(result.timestamp, str)
        assert "T" in result.timestamp


# ---------------------------------------------------------------------------
# IntentClassifier — classify_batch
# ---------------------------------------------------------------------------

class TestIntentClassifierBatch:
    def test_batch_returns_list(self):
        clf = _make_classifier()
        clf._artefacts.predict_proba.return_value = [
            {"crop": 0.80, "disease": 0.10, "weather": 0.05, "market": 0.03, "general": 0.02},
            {"crop": 0.10, "disease": 0.80, "weather": 0.05, "market": 0.03, "general": 0.02},
        ]
        results = clf.classify_batch(["crop problem", "disease in wheat"])
        assert len(results) == 2

    def test_batch_empty_input(self):
        clf = _make_classifier()
        assert clf.classify_batch([]) == []

    def test_batch_empty_text_in_list(self):
        clf = _make_classifier()
        clf._artefacts.predict_proba.return_value = [
            {"crop": 0.80, "disease": 0.10, "weather": 0.05, "market": 0.03, "general": 0.02},
        ]
        results = clf.classify_batch(["", "crop problem"])
        assert results[0].is_unknown is True
        assert results[1].intent == "crop"


# ---------------------------------------------------------------------------
# IntentClassifier — STT integration
# ---------------------------------------------------------------------------

class TestClassifyFromSTT:
    def test_stt_text_extracted(self):
        clf = _make_classifier()
        result = clf.classify_from_stt({"text": "crop disease", "language": "en"})
        assert result.intent == "crop"

    def test_stt_language_in_metadata(self):
        clf = _make_classifier()
        result = clf.classify_from_stt({"text": "crop disease", "language": "hi"})
        assert result.metadata["stt_language"] == "hi"

    def test_stt_confidence_in_metadata(self):
        clf = _make_classifier()
        result = clf.classify_from_stt({"text": "crop", "language": "en", "confidence": 0.95})
        assert result.metadata["stt_confidence"] == pytest.approx(0.95)

    def test_stt_source_in_metadata(self):
        clf = _make_classifier()
        result = clf.classify_from_stt({"text": "crop"})
        assert result.metadata["source"] == "stt"

    def test_stt_missing_text_returns_unknown(self):
        clf = _make_classifier()
        result = clf.classify_from_stt({"language": "hi"})
        assert result.is_unknown is True


# ---------------------------------------------------------------------------
# IntentClassifier — configuration
# ---------------------------------------------------------------------------

class TestClassifierConfiguration:
    def test_threshold_setter_valid(self):
        clf = _make_classifier()
        clf.confidence_threshold = 0.50
        assert clf.confidence_threshold == pytest.approx(0.50)

    def test_threshold_setter_invalid(self):
        clf = _make_classifier()
        with pytest.raises(ValueError):
            clf.confidence_threshold = 1.5

    def test_top_n_setter_valid(self):
        clf = _make_classifier()
        clf.top_n = 5
        assert clf.top_n == 5

    def test_top_n_setter_invalid(self):
        clf = _make_classifier()
        with pytest.raises(ValueError):
            clf.top_n = 0

    def test_get_supported_intents(self):
        clf = _make_classifier()
        intents = clf.get_supported_intents()
        assert "crop" in intents
        assert isinstance(intents, list)

    def test_get_model_metadata(self):
        clf = _make_classifier()
        meta = clf.get_model_metadata()
        assert "model_type" in meta
        assert "trained_at" in meta


# ---------------------------------------------------------------------------
# get_classifier singleton
# ---------------------------------------------------------------------------

class TestGetClassifier:
    def test_returns_intent_classifier(self):
        clf = get_classifier(force_rebuild=True)
        assert isinstance(clf, IntentClassifier)

    def test_singleton_same_instance(self):
        clf1 = get_classifier()
        clf2 = get_classifier()
        assert clf1 is clf2

    def test_force_rebuild_new_instance(self):
        clf1 = get_classifier()
        clf2 = get_classifier(force_rebuild=True)
        assert clf1 is not clf2
