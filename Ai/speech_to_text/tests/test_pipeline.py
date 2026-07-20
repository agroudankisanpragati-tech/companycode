# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/tests/test_pipeline.py
# Purpose: End-to-end pipeline integration tests.
#          Validates the complete flow:
#            WAV → AudioPreprocessor → (mocked) WhisperModel
#            → TranscriptionResult → TXT + JSON outputs
#            → BatchTranscriber summary
#
#          No real model is loaded — WhisperModel is mocked at the
#          ModelManager level so the full code path executes.
# Run:     pytest speech_to_text/tests/test_pipeline.py -v
# =============================================================================

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from speech_to_text.audio_preprocessor import AudioPreprocessor, TARGET_SR
from speech_to_text.batch_transcriber import BatchTranscriber, _write_json, _write_txt
from speech_to_text.config import get_config
from speech_to_text.language_detector import LanguageDetector
from speech_to_text.model_manager import ModelManager
from speech_to_text.transcriber import Transcriber, TranscriptionResult
from speech_to_text.utils.audio_utils import write_wav_file, write_wav_file_44k


# ---------------------------------------------------------------------------
# Shared mock helpers
# ---------------------------------------------------------------------------

def _mock_segment(seg_id=0, start=0.0, end=2.0, text=" test audio", avg_logprob=-0.25):
    return SimpleNamespace(
        id=seg_id, start=start, end=end, text=text,
        avg_logprob=avg_logprob, words=None,
    )


def _mock_info(language="hi", probability=0.96):
    return SimpleNamespace(language=language, language_probability=probability)


def _make_mock_whisper(segments=None, language="hi", probability=0.96):
    model = MagicMock()
    segs = segments or [_mock_segment()]
    model.transcribe.return_value = (iter(segs), _mock_info(language, probability))
    model.detect_language.return_value = (language, {language: probability, "en": 0.02})
    return model


def _make_mock_manager(mock_model) -> ModelManager:
    mm = MagicMock(spec=ModelManager)
    mm.load.return_value = mock_model
    return mm


# ---------------------------------------------------------------------------
# Stage 1: AudioPreprocessor
# ---------------------------------------------------------------------------

class TestPipelinePreprocessor:
    """Validates the preprocessing stage in isolation."""

    def test_16k_mono_wav_processed_correctly(self, tmp_path):
        wav = write_wav_file(tmp_path / "s1.wav", sample_rate=16_000, n_channels=1)
        pp = AudioPreprocessor(trim_silence=False)
        audio = pp.process(wav)
        assert audio.sample_rate == TARGET_SR
        assert audio.samples.ndim == 1
        assert audio.samples.dtype == np.float32
        assert audio.duration_s > 0
        assert audio.source_path.is_absolute()

    def test_44k_stereo_wav_normalised_to_16k_mono(self, tmp_path):
        wav = write_wav_file_44k(tmp_path / "s1_44k.wav")
        pp = AudioPreprocessor(trim_silence=False)
        audio = pp.process(wav)
        assert audio.sample_rate == TARGET_SR
        assert audio.original_channels == 2
        assert audio.was_resampled is True
        assert audio.samples.ndim == 1

    def test_peak_amplitude_normalised_to_one(self, tmp_path):
        wav = write_wav_file(tmp_path / "s1_norm.wav", amplitude=0.3)
        pp = AudioPreprocessor(trim_silence=False)
        audio = pp.process(wav)
        assert abs(np.abs(audio.samples).max() - 1.0) < 1e-5


# ---------------------------------------------------------------------------
# Stage 2: Transcription
# ---------------------------------------------------------------------------

class TestPipelineTranscription:
    """Validates the transcription stage with a mocked WhisperModel."""

    def test_transcription_result_fields_populated(self, tmp_path):
        wav = write_wav_file(tmp_path / "s2.wav")
        mock_model = _make_mock_whisper(language="hi", probability=0.96)
        mm = _make_mock_manager(mock_model)
        t = Transcriber(model_size="base", model_manager=mm)
        result = t.transcribe(wav)

        assert isinstance(result, TranscriptionResult)
        assert result.language == "hi"
        assert result.language_probability == 0.96
        assert result.model_size == "base"
        assert result.duration_s > 0
        assert result.transcription_time_s >= 0
        assert result.source_path.is_absolute()
        assert len(result.segments) == 1
        assert result.text == "test audio"

    def test_segment_confidence_in_range(self, tmp_path):
        wav = write_wav_file(tmp_path / "s2b.wav")
        mock_model = _make_mock_whisper()
        mm = _make_mock_manager(mock_model)
        t = Transcriber(model_size="base", model_manager=mm)
        result = t.transcribe(wav)
        for seg in result.segments:
            assert 0.0 < seg.confidence <= 1.0

    def test_multiple_segments_concatenated(self, tmp_path):
        wav = write_wav_file(tmp_path / "s2c.wav", duration_s=3.0)
        segs = [
            _mock_segment(0, 0.0, 1.0, " first"),
            _mock_segment(1, 1.0, 2.0, " second"),
            _mock_segment(2, 2.0, 3.0, " third"),
        ]
        mock_model = _make_mock_whisper(segments=segs)
        mm = _make_mock_manager(mock_model)
        t = Transcriber(model_size="base", model_manager=mm)
        result = t.transcribe(wav)
        assert result.text == "first second third"
        assert len(result.segments) == 3


# ---------------------------------------------------------------------------
# Stage 3: Language Detection
# ---------------------------------------------------------------------------

class TestPipelineLanguageDetection:
    """Validates the language detection stage."""

    def test_detect_returns_correct_language(self, tmp_path):
        wav = write_wav_file(tmp_path / "s3.wav")
        mock_model = _make_mock_whisper(language="hi", probability=0.97)
        mm = _make_mock_manager(mock_model)
        detector = LanguageDetector(model_size="base", model_manager=mm)
        result = detector.detect(wav)
        assert result.language == "hi"
        assert result.probability == pytest.approx(0.97, abs=0.01)

    def test_all_probs_contains_top_language(self, tmp_path):
        wav = write_wav_file(tmp_path / "s3b.wav")
        mock_model = _make_mock_whisper(language="hi", probability=0.97)
        mm = _make_mock_manager(mock_model)
        detector = LanguageDetector(model_size="base", model_manager=mm)
        result = detector.detect(wav)
        assert result.language in result.all_probs

    def test_detect_top_n_length(self, tmp_path):
        wav = write_wav_file(tmp_path / "s3c.wav")
        mock_model = MagicMock()
        mock_model.detect_language.return_value = (
            "hi",
            {f"l{i}": 1.0 / (i + 1) for i in range(8)},
        )
        mm = _make_mock_manager(mock_model)
        detector = LanguageDetector(model_size="base", model_manager=mm)
        top = detector.detect_top_n(wav, n=5)
        assert len(top) == 5


# ---------------------------------------------------------------------------
# Stage 4: Output Writers
# ---------------------------------------------------------------------------

class TestPipelineOutputWriters:
    """Validates TXT and JSON output file content."""

    def _make_result(self, tmp_path: Path) -> TranscriptionResult:
        from speech_to_text.transcriber import TranscriptionSegment
        return TranscriptionResult(
            text="नमस्ते दुनिया",
            segments=[
                TranscriptionSegment(0, 0.0, 1.5, "नमस्ते दुनिया", 0.88, [])
            ],
            language="hi",
            language_probability=0.97,
            duration_s=1.5,
            transcription_time_s=0.4,
            model_size="base",
            source_path=tmp_path / "audio.wav",
        )

    def test_txt_file_contains_full_text(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_txt(tmp_path, "audio", result)
        content = path.read_text(encoding="utf-8")
        assert "नमस्ते दुनिया" in content

    def test_txt_file_contains_language_header(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_txt(tmp_path, "audio", result)
        content = path.read_text(encoding="utf-8")
        assert "hi" in content

    def test_txt_file_contains_segment_timestamps(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_txt(tmp_path, "audio", result)
        content = path.read_text(encoding="utf-8")
        assert "0.00s --> 1.50s" in content

    def test_json_file_unicode_preserved(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_json(tmp_path, "audio", result)
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["text"] == "नमस्ते दुनिया"

    def test_json_file_segments_have_all_fields(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_json(tmp_path, "audio", result)
        data = json.loads(path.read_text(encoding="utf-8"))
        seg = data["segments"][0]
        assert all(k in seg for k in ("id", "start", "end", "text", "confidence", "words"))

    def test_json_language_probability_stored(self, tmp_path):
        result = self._make_result(tmp_path)
        path = _write_json(tmp_path, "audio", result)
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["language_probability"] == pytest.approx(0.97, abs=0.001)


# ---------------------------------------------------------------------------
# Stage 5: Full Batch Pipeline
# ---------------------------------------------------------------------------

class TestPipelineFullBatch:
    """Validates the complete batch pipeline end-to-end."""

    def _make_bt(self, tmp_path: Path, mock_model) -> BatchTranscriber:
        import threading
        import logging
        from datetime import datetime, timezone

        cfg = get_config()
        mm  = _make_mock_manager(mock_model)

        bt = BatchTranscriber.__new__(BatchTranscriber)
        bt._cfg         = cfg
        bt._model_size  = "base"
        bt._max_workers = 1
        bt._language    = None
        bt._word_ts     = False
        bt._vad         = True
        bt._out_root    = tmp_path / "outputs"
        bt._dir_txt     = bt._out_root / "transcripts"
        bt._dir_json    = bt._out_root / "json"
        bt._dir_logs    = bt._out_root / "transcription_logs"
        bt._manifest    = bt._out_root / "batch_manifest.json"

        for d in (bt._dir_txt, bt._dir_json, bt._dir_logs):
            d.mkdir(parents=True, exist_ok=True)

        bt._run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        bt._log    = logging.getLogger(f"akp.stt.batch.pipeline.{bt._run_id}")
        bt._log.addHandler(logging.NullHandler())

        # Use a real Transcriber backed by the mock model
        t = Transcriber(model_size="base", model_manager=mm)
        bt._transcriber     = t
        bt._manifest_lock   = threading.Lock()
        return bt

    def test_full_pipeline_produces_outputs(self, tmp_path):
        folder = tmp_path / "audio"
        folder.mkdir()
        for i in range(3):
            write_wav_file(folder / f"clip_{i}.wav")

        mock_model = _make_mock_whisper(language="hi", probability=0.95)
        bt = self._make_bt(tmp_path, mock_model)
        result = bt.run(folder, resume=False)

        assert result.completed == 3
        assert result.failed == 0
        assert result.total_files == 3
        assert len(list(bt._dir_txt.glob("*.txt"))) == 3
        assert len(list(bt._dir_json.glob("*.json"))) == 3

    def test_full_pipeline_language_in_json(self, tmp_path):
        folder = tmp_path / "audio"
        folder.mkdir()
        write_wav_file(folder / "clip.wav")

        mock_model = _make_mock_whisper(language="hi", probability=0.95)
        bt = self._make_bt(tmp_path, mock_model)
        bt.run(folder, resume=False)

        json_files = list(bt._dir_json.glob("*.json"))
        assert len(json_files) == 1
        data = json.loads(json_files[0].read_text(encoding="utf-8"))
        assert data["language"] == "hi"

    def test_full_pipeline_summary_wer_note_present(self, tmp_path):
        folder = tmp_path / "audio"
        folder.mkdir()
        write_wav_file(folder / "clip.wav")

        mock_model = _make_mock_whisper()
        bt = self._make_bt(tmp_path, mock_model)
        result = bt.run(folder, resume=False)

        summary = json.loads(Path(result.summary_json_path).read_text(encoding="utf-8"))
        assert "wer_note" in summary
        assert summary["wer_note"]  # non-empty string

    def test_full_pipeline_resume_skips_on_second_run(self, tmp_path):
        folder = tmp_path / "audio"
        folder.mkdir()
        for i in range(2):
            write_wav_file(folder / f"clip_{i}.wav")

        mock_model = _make_mock_whisper()
        bt1 = self._make_bt(tmp_path, mock_model)
        bt1.run(folder, resume=False)

        # Second run with same manifest
        call_count = {"n": 0}
        original_transcribe = bt1._transcriber.transcribe

        def counting_transcribe(path, **kw):
            call_count["n"] += 1
            return original_transcribe(path, **kw)

        bt2 = self._make_bt(tmp_path, mock_model)
        bt2._manifest = bt1._manifest
        bt2._transcriber.transcribe = counting_transcribe
        result2 = bt2.run(folder, resume=True)

        assert result2.skipped == 2
        assert call_count["n"] == 0

    def test_full_pipeline_realtime_factor_computed(self, tmp_path):
        folder = tmp_path / "audio"
        folder.mkdir()
        write_wav_file(folder / "clip.wav", duration_s=2.0)

        mock_model = _make_mock_whisper()
        bt = self._make_bt(tmp_path, mock_model)
        result = bt.run(folder, resume=False)

        # RTF = total_audio_s / total_processing_s — just verify it's a number
        assert isinstance(result.realtime_factor, float)
        assert result.realtime_factor >= 0
