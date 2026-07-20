# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/tests/test_transcriber.py
# Purpose: Unit tests for speech_to_text/transcriber.py and
#          speech_to_text/language_detector.py
#          All WhisperModel calls are mocked — no model download required.
# Run:     pytest speech_to_text/tests/test_transcriber.py -v
# =============================================================================

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from speech_to_text.audio_preprocessor import PreprocessedAudio
from speech_to_text.language_detector import LanguageDetectionResult, LanguageDetector
from speech_to_text.transcriber import (
    Transcriber,
    TranscriptionResult,
    TranscriptionSegment,
)
from speech_to_text.utils.audio_utils import write_wav_file


# ---------------------------------------------------------------------------
# Shared mock factories
# ---------------------------------------------------------------------------

def _make_segment(
    seg_id: int = 0,
    start: float = 0.0,
    end: float = 1.0,
    text: str = " hello world",
    avg_logprob: float = -0.3,
) -> SimpleNamespace:
    """Returns a mock Faster-Whisper segment object."""
    return SimpleNamespace(
        id=seg_id,
        start=start,
        end=end,
        text=text,
        avg_logprob=avg_logprob,
        words=None,
    )


def _make_info(language: str = "en", language_probability: float = 0.98) -> SimpleNamespace:
    return SimpleNamespace(language=language, language_probability=language_probability)


def _make_mock_model(segments=None, language="en", language_probability=0.98):
    """Returns a MagicMock WhisperModel whose transcribe() returns preset data."""
    if segments is None:
        segments = [_make_segment()]
    model = MagicMock()
    model.transcribe.return_value = (iter(segments), _make_info(language, language_probability))
    return model


def _make_preprocessed(tmp_path: Path, duration_s: float = 1.0) -> PreprocessedAudio:
    """Returns a PreprocessedAudio built from a real synthetic WAV."""
    from speech_to_text.audio_preprocessor import AudioPreprocessor
    wav = write_wav_file(tmp_path / "test.wav", duration_s=duration_s)
    return AudioPreprocessor(trim_silence=False).process(wav)


# ---------------------------------------------------------------------------
# Transcriber._collect_segments
# ---------------------------------------------------------------------------

class TestCollectSegments:
    def test_basic_segment_parsed(self):
        segs = [_make_segment(0, 0.0, 2.5, " hello", -0.2)]
        result = Transcriber._collect_segments(iter(segs), word_timestamps=False)
        assert len(result) == 1
        s = result[0]
        assert s.id == 0
        assert s.start == 0.0
        assert s.end == 2.5
        assert s.text == "hello"
        assert 0.0 < s.confidence <= 1.0

    def test_confidence_is_exp_of_avg_logprob(self):
        avg_logprob = -0.5
        segs = [_make_segment(avg_logprob=avg_logprob)]
        result = Transcriber._collect_segments(iter(segs), word_timestamps=False)
        expected = round(float(np.exp(avg_logprob)), 4)
        assert result[0].confidence == expected

    def test_multiple_segments(self):
        segs = [_make_segment(i, float(i), float(i + 1)) for i in range(5)]
        result = Transcriber._collect_segments(iter(segs), word_timestamps=False)
        assert len(result) == 5

    def test_word_timestamps_empty_when_disabled(self):
        seg = _make_segment()
        seg.words = [SimpleNamespace(word="hello", start=0.0, end=0.5, probability=0.9)]
        result = Transcriber._collect_segments(iter([seg]), word_timestamps=False)
        assert result[0].words == []

    def test_word_timestamps_populated_when_enabled(self):
        seg = _make_segment()
        seg.words = [SimpleNamespace(word="hello", start=0.0, end=0.5, probability=0.9)]
        result = Transcriber._collect_segments(iter([seg]), word_timestamps=True)
        assert len(result[0].words) == 1
        w = result[0].words[0]
        assert w["word"] == "hello"
        assert w["start"] == 0.0
        assert w["end"] == 0.5
        assert w["probability"] == 0.9

    def test_empty_iterator_returns_empty_list(self):
        result = Transcriber._collect_segments(iter([]), word_timestamps=False)
        assert result == []


# ---------------------------------------------------------------------------
# Transcriber.transcribe()
# ---------------------------------------------------------------------------

class TestTranscriberTranscribe:
    def _make_transcriber(self, mock_model, tmp_path) -> Transcriber:
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = mock_model
        t = Transcriber(model_size="base", model_manager=mm)
        return t

    def test_returns_transcription_result(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        preprocessed = _make_preprocessed(tmp_path)
        result = t.transcribe(preprocessed)
        assert isinstance(result, TranscriptionResult)

    def test_full_text_concatenated(self, tmp_path):
        segs = [
            _make_segment(0, 0.0, 1.0, " hello"),
            _make_segment(1, 1.0, 2.0, " world"),
        ]
        model = _make_mock_model(segments=segs)
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.text == "hello world"

    def test_language_and_probability_set(self, tmp_path):
        model = _make_mock_model(language="hi", language_probability=0.95)
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.language == "hi"
        assert result.language_probability == 0.95

    def test_model_size_stored(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.model_size == "base"

    def test_source_path_is_absolute(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.source_path.is_absolute()

    def test_duration_positive(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.duration_s > 0

    def test_transcription_time_positive(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert result.transcription_time_s >= 0

    def test_accepts_file_path(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        wav = write_wav_file(tmp_path / "input.wav")
        result = t.transcribe(wav)
        assert isinstance(result, TranscriptionResult)

    def test_accepts_string_path(self, tmp_path):
        model = _make_mock_model()
        t = self._make_transcriber(model, tmp_path)
        wav = write_wav_file(tmp_path / "input.wav")
        result = t.transcribe(str(wav))
        assert isinstance(result, TranscriptionResult)

    def test_model_error_raises_runtime_error(self, tmp_path):
        model = MagicMock()
        model.transcribe.side_effect = RuntimeError("model exploded")
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = model
        t = Transcriber(model_size="base", model_manager=mm)
        with pytest.raises(RuntimeError, match="Transcription failed"):
            t.transcribe(_make_preprocessed(tmp_path))

    def test_segments_list_populated(self, tmp_path):
        segs = [_make_segment(i) for i in range(3)]
        model = _make_mock_model(segments=segs)
        t = self._make_transcriber(model, tmp_path)
        result = t.transcribe(_make_preprocessed(tmp_path))
        assert len(result.segments) == 3
        assert all(isinstance(s, TranscriptionSegment) for s in result.segments)


# ---------------------------------------------------------------------------
# Transcriber.detect_language()
# ---------------------------------------------------------------------------

class TestTranscriberDetectLanguage:
    def test_returns_language_and_probability(self, tmp_path):
        model = _make_mock_model(language="hi", language_probability=0.97)
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = model
        t = Transcriber(model_size="base", model_manager=mm)
        lang, prob = t.detect_language(_make_preprocessed(tmp_path))
        assert lang == "hi"
        assert prob == 0.97


# ---------------------------------------------------------------------------
# LanguageDetector
# ---------------------------------------------------------------------------

class TestLanguageDetector:
    def _make_detector(self, mock_model) -> LanguageDetector:
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = mock_model
        return LanguageDetector(model_size="base", model_manager=mm)

    def test_returns_language_detection_result(self, tmp_path):
        model = _make_mock_model(language="en", language_probability=0.99)
        detector = self._make_detector(model)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert isinstance(result, LanguageDetectionResult)

    def test_language_set_correctly(self, tmp_path):
        model = _make_mock_model(language="hi", language_probability=0.95)
        detector = self._make_detector(model)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert result.language == "hi"

    def test_probability_in_range(self, tmp_path):
        model = _make_mock_model(language_probability=0.88)
        detector = self._make_detector(model)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert 0.0 <= result.probability <= 1.0

    def test_all_probs_sorted_descending(self, tmp_path):
        # Simulate native detect_language returning multiple candidates
        model = MagicMock()
        model.detect_language.return_value = (
            "hi",
            {"hi": 0.9, "en": 0.05, "ur": 0.03},
        )
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = model
        detector = LanguageDetector(model_size="base", model_manager=mm)
        result = detector.detect(_make_preprocessed(tmp_path))
        probs = list(result.all_probs.values())
        assert probs == sorted(probs, reverse=True)

    def test_detect_top_n_returns_n_items(self, tmp_path):
        model = MagicMock()
        model.detect_language.return_value = (
            "hi",
            {f"lang{i}": 1.0 / (i + 1) for i in range(10)},
        )
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = model
        detector = LanguageDetector(model_size="base", model_manager=mm)
        top = detector.detect_top_n(_make_preprocessed(tmp_path), n=3)
        assert len(top) == 3

    def test_fallback_when_detect_language_missing(self, tmp_path):
        # Model without detect_language attribute → falls back to transcribe()
        model = MagicMock(spec=[])  # no attributes
        model.transcribe = MagicMock(
            return_value=(iter([]), _make_info("en", 0.85))
        )
        from speech_to_text.model_manager import ModelManager
        mm = MagicMock(spec=ModelManager)
        mm.load.return_value = model
        detector = LanguageDetector(model_size="base", model_manager=mm)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert result.language == "en"

    def test_source_path_is_absolute(self, tmp_path):
        model = _make_mock_model()
        detector = self._make_detector(model)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert result.source_path.is_absolute()

    def test_detection_time_non_negative(self, tmp_path):
        model = _make_mock_model()
        detector = self._make_detector(model)
        result = detector.detect(_make_preprocessed(tmp_path))
        assert result.detection_time_s >= 0
