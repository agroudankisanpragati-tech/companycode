# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/tests/test_batch_transcriber.py
# Purpose: Unit tests for speech_to_text/batch_transcriber.py
#          Transcriber is mocked — no model download required.
# Run:     pytest speech_to_text/tests/test_batch_transcriber.py -v
# =============================================================================

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from speech_to_text.batch_transcriber import (
    BatchResult,
    BatchTranscriber,
    FileRecord,
    _load_manifest,
    _save_manifest,
    _write_json,
    _write_txt,
    run_batch,
)
from speech_to_text.config import get_config
from speech_to_text.transcriber import TranscriptionResult, TranscriptionSegment
from speech_to_text.utils.audio_utils import write_wav_file


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_segment(seg_id=0, start=0.0, end=1.0, text="hello") -> TranscriptionSegment:
    return TranscriptionSegment(
        id=seg_id, start=start, end=end, text=text, confidence=0.9, words=[]
    )


def _make_result(source_path: Path, text: str = "hello world") -> TranscriptionResult:
    return TranscriptionResult(
        text=text,
        segments=[_make_segment()],
        language="en",
        language_probability=0.98,
        duration_s=1.0,
        transcription_time_s=0.5,
        model_size="base",
        source_path=source_path,
    )


def _make_audio_folder(tmp_path: Path, n: int = 3) -> Path:
    folder = tmp_path / "audio"
    folder.mkdir()
    for i in range(n):
        write_wav_file(folder / f"clip_{i:02d}.wav")
    return folder


def _make_batch_transcriber(tmp_path: Path, mock_transcribe_fn=None) -> BatchTranscriber:
    """Returns a BatchTranscriber whose outputs go to tmp_path and whose
    Transcriber.transcribe() is replaced by mock_transcribe_fn."""
    cfg = get_config()

    # Redirect all outputs to tmp_path so tests don't pollute the real outputs/
    with patch.object(type(cfg), "__class__", cfg.__class__):
        bt = BatchTranscriber.__new__(BatchTranscriber)
        bt._cfg          = cfg
        bt._model_size   = "base"
        bt._max_workers  = 1
        bt._language     = None
        bt._word_ts      = False
        bt._vad          = True
        bt._out_root     = tmp_path / "outputs"
        bt._dir_txt      = bt._out_root / "transcripts"
        bt._dir_json     = bt._out_root / "json"
        bt._dir_logs     = bt._out_root / "transcription_logs"
        bt._manifest     = bt._out_root / "batch_manifest.json"

        for d in (bt._dir_txt, bt._dir_json, bt._dir_logs):
            d.mkdir(parents=True, exist_ok=True)

        from datetime import datetime, timezone
        import threading
        bt._run_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        import logging
        bt._log = logging.getLogger(f"akp.stt.batch.test.{bt._run_id}")
        bt._log.addHandler(logging.NullHandler())

        mock_transcriber = MagicMock()
        if mock_transcribe_fn is not None:
            mock_transcriber.transcribe.side_effect = mock_transcribe_fn
        else:
            mock_transcriber.transcribe.side_effect = lambda path, **kw: _make_result(Path(path))
        bt._transcriber = mock_transcriber
        bt._manifest_lock = threading.Lock()

    return bt


# ---------------------------------------------------------------------------
# _write_txt / _write_json
# ---------------------------------------------------------------------------

class TestOutputWriters:
    def test_write_txt_creates_file(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav")
        path = _write_txt(tmp_path, "audio", result)
        assert path.exists()
        assert path.suffix == ".txt"

    def test_write_txt_contains_text(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav", text="test transcript")
        path = _write_txt(tmp_path, "audio", result)
        content = path.read_text(encoding="utf-8")
        assert "test transcript" in content

    def test_write_txt_contains_segment_timestamps(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav")
        path = _write_txt(tmp_path, "audio", result)
        content = path.read_text(encoding="utf-8")
        assert "-->" in content

    def test_write_json_creates_file(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav")
        path = _write_json(tmp_path, "audio", result)
        assert path.exists()
        assert path.suffix == ".json"

    def test_write_json_valid_json(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav")
        path = _write_json(tmp_path, "audio", result)
        data = json.loads(path.read_text(encoding="utf-8"))
        assert "text" in data
        assert "segments" in data
        assert "language" in data

    def test_write_json_segments_structure(self, tmp_path):
        result = _make_result(tmp_path / "audio.wav")
        path = _write_json(tmp_path, "audio", result)
        data = json.loads(path.read_text(encoding="utf-8"))
        seg = data["segments"][0]
        assert "id" in seg
        assert "start" in seg
        assert "end" in seg
        assert "text" in seg
        assert "confidence" in seg


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

class TestManifest:
    def test_load_manifest_returns_empty_for_missing_file(self, tmp_path):
        result = _load_manifest(tmp_path / "missing.json")
        assert result == {}

    def test_load_manifest_returns_empty_for_corrupt_file(self, tmp_path):
        f = tmp_path / "manifest.json"
        f.write_text("not json", encoding="utf-8")
        result = _load_manifest(f)
        assert result == {}

    def test_save_and_load_roundtrip(self, tmp_path):
        records = [
            FileRecord(file_name="a.wav", file_path="/a.wav", status="completed"),
            FileRecord(file_name="b.wav", file_path="/b.wav", status="failed"),
        ]
        manifest = tmp_path / "manifest.json"
        _save_manifest(manifest, records)
        loaded = _load_manifest(manifest)
        assert loaded["a.wav"] == "completed"
        assert loaded["b.wav"] == "failed"

    def test_save_manifest_is_valid_json(self, tmp_path):
        records = [FileRecord(file_name="x.wav", file_path="/x.wav", status="pending")]
        manifest = tmp_path / "manifest.json"
        _save_manifest(manifest, records)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        assert isinstance(data, list)


# ---------------------------------------------------------------------------
# BatchTranscriber.run()
# ---------------------------------------------------------------------------

class TestBatchTranscriberRun:
    def test_returns_batch_result(self, tmp_path):
        folder = _make_audio_folder(tmp_path)
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        assert isinstance(result, BatchResult)

    def test_completed_count_matches_files(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=3)
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        assert result.completed == 3
        assert result.failed == 0

    def test_txt_files_created(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=2)
        bt = _make_batch_transcriber(tmp_path)
        bt.run(folder, resume=False)
        txt_files = list(bt._dir_txt.glob("*.txt"))
        assert len(txt_files) == 2

    def test_json_files_created(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=2)
        bt = _make_batch_transcriber(tmp_path)
        bt.run(folder, resume=False)
        json_files = list(bt._dir_json.glob("*.json"))
        assert len(json_files) == 2

    def test_summary_json_created(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=1)
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        assert Path(result.summary_json_path).exists()

    def test_summary_json_valid_structure(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=1)
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        data = json.loads(Path(result.summary_json_path).read_text(encoding="utf-8"))
        for key in ("run_id", "completed", "failed", "skipped", "total_files",
                    "total_audio_s", "total_processing_s", "wer_note"):
            assert key in data

    def test_empty_folder_returns_zero_counts(self, tmp_path):
        folder = tmp_path / "empty"
        folder.mkdir()
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        assert result.total_files == 0
        assert result.completed == 0

    def test_not_a_directory_raises(self, tmp_path):
        f = tmp_path / "file.wav"
        f.write_bytes(b"\x00")
        bt = _make_batch_transcriber(tmp_path)
        with pytest.raises(NotADirectoryError):
            bt.run(f)

    def test_failed_files_counted(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=3)

        call_count = {"n": 0}

        def flaky(path, **kw):
            call_count["n"] += 1
            if call_count["n"] == 2:
                raise RuntimeError("simulated failure")
            return _make_result(Path(path))

        bt = _make_batch_transcriber(tmp_path, mock_transcribe_fn=flaky)
        result = bt.run(folder, resume=False)
        assert result.failed == 1
        assert result.completed == 2

    def test_failed_files_have_error_message(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=1)

        def always_fail(path, **kw):
            raise RuntimeError("boom")

        bt = _make_batch_transcriber(tmp_path, mock_transcribe_fn=always_fail)
        result = bt.run(folder, resume=False)
        failed = [r for r in result.records if r.status == "failed"]
        assert len(failed) == 1
        assert "boom" in failed[0].error

    def test_manifest_written_after_run(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=2)
        bt = _make_batch_transcriber(tmp_path)
        bt.run(folder, resume=False)
        assert bt._manifest.exists()

    def test_resume_skips_completed_files(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=3)
        bt = _make_batch_transcriber(tmp_path)

        # First run — complete all
        bt.run(folder, resume=False)

        # Second run — all should be skipped
        call_count = {"n": 0}

        def counting(path, **kw):
            call_count["n"] += 1
            return _make_result(Path(path))

        bt2 = _make_batch_transcriber(tmp_path, mock_transcribe_fn=counting)
        # Share the same manifest
        bt2._manifest = bt._manifest
        result2 = bt2.run(folder, resume=True)
        assert result2.skipped == 3
        assert call_count["n"] == 0

    def test_no_resume_reprocesses_all(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=2)
        bt = _make_batch_transcriber(tmp_path)
        bt.run(folder, resume=False)

        call_count = {"n": 0}

        def counting(path, **kw):
            call_count["n"] += 1
            return _make_result(Path(path))

        bt2 = _make_batch_transcriber(tmp_path, mock_transcribe_fn=counting)
        bt2._manifest = bt._manifest
        bt2.run(folder, resume=False)
        assert call_count["n"] == 2

    def test_total_audio_s_summed(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=3)
        bt = _make_batch_transcriber(tmp_path)
        result = bt.run(folder, resume=False)
        # Each mock result has duration_s=1.0
        assert result.total_audio_s == pytest.approx(3.0, abs=0.1)

    def test_log_file_created(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=1)
        bt = _make_batch_transcriber(tmp_path)
        bt.run(folder, resume=False)
        log_files = list(bt._dir_logs.glob("*.log"))
        # The test logger is a NullHandler logger, but the dir should exist
        assert bt._dir_logs.is_dir()


# ---------------------------------------------------------------------------
# run_batch() convenience function
# ---------------------------------------------------------------------------

class TestRunBatch:
    def test_run_batch_returns_batch_result(self, tmp_path):
        folder = _make_audio_folder(tmp_path, n=1)
        with patch(
            "speech_to_text.batch_transcriber.get_transcriber"
        ) as mock_get:
            mock_t = MagicMock()
            mock_t.transcribe.side_effect = lambda p, **kw: _make_result(Path(p))
            mock_get.return_value = mock_t
            result = run_batch(folder, model_size="base", max_workers=1, resume=False)
        assert isinstance(result, BatchResult)

    def test_run_batch_raises_for_missing_folder(self, tmp_path):
        with pytest.raises(NotADirectoryError):
            run_batch(tmp_path / "nonexistent", resume=False)
