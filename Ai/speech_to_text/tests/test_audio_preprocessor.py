# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/tests/test_audio_preprocessor.py
# Purpose: Unit tests for speech_to_text/audio_preprocessor.py
# Run:     pytest speech_to_text/tests/test_audio_preprocessor.py -v
# =============================================================================

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
import pytest

from speech_to_text.audio_preprocessor import (
    MIN_AUDIO_DURATION_S,
    SILENCE_FRAME_LEN,
    SILENCE_TOP_DB,
    SUPPORTED_EXTENSIONS,
    TARGET_SR,
    AudioPreprocessor,
    PreprocessedAudio,
    _normalise,
    _resample,
    _to_mono,
    _trim_silence,
    _validate_path,
    _validate_wav_header,
    get_preprocessor,
)
from speech_to_text.utils.audio_utils import (
    write_wav_file,
    write_wav_file_44k,
    write_wav_file_8k,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def wav_16k_mono(tmp_path) -> Path:
    return write_wav_file(tmp_path / "mono_16k.wav", sample_rate=16_000, n_channels=1)


@pytest.fixture()
def wav_44k_stereo(tmp_path) -> Path:
    return write_wav_file_44k(tmp_path / "stereo_44k.wav")


@pytest.fixture()
def wav_8k_mono(tmp_path) -> Path:
    return write_wav_file_8k(tmp_path / "mono_8k.wav")


@pytest.fixture()
def preprocessor() -> AudioPreprocessor:
    return AudioPreprocessor(trim_silence=False)


# ---------------------------------------------------------------------------
# _validate_path
# ---------------------------------------------------------------------------

class TestValidatePath:
    def test_raises_file_not_found(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            _validate_path(tmp_path / "missing.wav")

    def test_raises_for_directory(self, tmp_path):
        with pytest.raises(ValueError, match="not a file"):
            _validate_path(tmp_path)

    def test_raises_for_unsupported_extension(self, tmp_path):
        f = tmp_path / "audio.xyz"
        f.write_bytes(b"\x00")
        with pytest.raises(ValueError, match="Unsupported"):
            _validate_path(f)

    def test_raises_for_empty_file(self, tmp_path):
        f = tmp_path / "empty.wav"
        f.write_bytes(b"")
        with pytest.raises(ValueError, match="empty"):
            _validate_path(f)

    def test_passes_for_valid_wav(self, wav_16k_mono):
        _validate_path(wav_16k_mono)  # must not raise

    def test_all_supported_extensions_accepted(self, tmp_path):
        for ext in SUPPORTED_EXTENSIONS:
            f = tmp_path / f"audio{ext}"
            f.write_bytes(b"\x00")
            _validate_path(f)  # must not raise


# ---------------------------------------------------------------------------
# _validate_wav_header
# ---------------------------------------------------------------------------

class TestValidateWavHeader:
    def test_valid_wav_passes(self, wav_16k_mono):
        _validate_wav_header(wav_16k_mono)  # must not raise

    def test_non_wav_skipped(self, tmp_path):
        f = tmp_path / "audio.flac"
        f.write_bytes(b"\x00")
        _validate_wav_header(f)  # must not raise — non-WAV is skipped

    def test_malformed_wav_raises(self, tmp_path):
        f = tmp_path / "bad.wav"
        f.write_bytes(b"RIFF\x00\x00\x00\x00WAVE")  # truncated RIFF
        with pytest.raises(ValueError, match="Malformed"):
            _validate_wav_header(f)


# ---------------------------------------------------------------------------
# _to_mono
# ---------------------------------------------------------------------------

class TestToMono:
    def test_mono_unchanged(self):
        samples = np.array([0.1, 0.2, 0.3], dtype=np.float32)
        result = _to_mono(samples)
        np.testing.assert_array_almost_equal(result, samples)

    def test_stereo_averaged(self):
        left  = np.array([1.0, 0.0], dtype=np.float32)
        right = np.array([0.0, 1.0], dtype=np.float32)
        stereo = np.stack([left, right], axis=1)
        result = _to_mono(stereo)
        np.testing.assert_array_almost_equal(result, [0.5, 0.5])

    def test_output_is_float32(self):
        samples = np.ones((100, 2), dtype=np.float64)
        result = _to_mono(samples)
        assert result.dtype == np.float32

    def test_output_is_1d(self):
        samples = np.ones((100, 3), dtype=np.float32)
        result = _to_mono(samples)
        assert result.ndim == 1


# ---------------------------------------------------------------------------
# _resample
# ---------------------------------------------------------------------------

class TestResample:
    def test_same_rate_returns_unchanged(self):
        samples = np.random.rand(1600).astype(np.float32)
        result, was_resampled = _resample(samples, 16_000, 16_000)
        assert not was_resampled
        np.testing.assert_array_equal(result, samples)

    def test_downsample_reduces_length(self):
        samples = np.random.rand(44_100).astype(np.float32)
        result, was_resampled = _resample(samples, 44_100, 16_000)
        assert was_resampled
        expected_len = int(round(44_100 * 16_000 / 44_100))
        assert abs(len(result) - expected_len) <= 2

    def test_upsample_increases_length(self):
        samples = np.random.rand(8_000).astype(np.float32)
        result, was_resampled = _resample(samples, 8_000, 16_000)
        assert was_resampled
        assert len(result) > len(samples)

    def test_output_is_float32(self):
        samples = np.random.rand(16_000).astype(np.float32)
        result, _ = _resample(samples, 44_100, 16_000)
        assert result.dtype == np.float32


# ---------------------------------------------------------------------------
# _trim_silence
# ---------------------------------------------------------------------------

class TestTrimSilence:
    def test_empty_array_unchanged(self):
        samples = np.array([], dtype=np.float32)
        result, was_trimmed = _trim_silence(samples, SILENCE_TOP_DB, SILENCE_FRAME_LEN)
        assert len(result) == 0
        assert not was_trimmed

    def test_leading_silence_removed(self):
        silence = np.zeros(4096, dtype=np.float32)
        tone    = np.sin(np.linspace(0, 2 * np.pi * 10, 4096)).astype(np.float32)
        samples = np.concatenate([silence, tone])
        result, was_trimmed = _trim_silence(samples, SILENCE_TOP_DB, SILENCE_FRAME_LEN)
        assert was_trimmed
        assert len(result) < len(samples)

    def test_all_silence_returns_original(self):
        samples = np.zeros(4096, dtype=np.float32)
        result, was_trimmed = _trim_silence(samples, SILENCE_TOP_DB, SILENCE_FRAME_LEN)
        assert not was_trimmed


# ---------------------------------------------------------------------------
# _normalise
# ---------------------------------------------------------------------------

class TestNormalise:
    def test_peak_is_one(self):
        samples = np.array([0.1, 0.5, -0.3], dtype=np.float32)
        result = _normalise(samples)
        assert abs(np.abs(result).max() - 1.0) < 1e-6

    def test_silent_signal_unchanged(self):
        samples = np.zeros(100, dtype=np.float32)
        result = _normalise(samples)
        np.testing.assert_array_equal(result, samples)

    def test_output_is_float32(self):
        samples = np.array([0.1, 0.2], dtype=np.float64)
        result = _normalise(samples.astype(np.float32))
        assert result.dtype == np.float32


# ---------------------------------------------------------------------------
# AudioPreprocessor.process()
# ---------------------------------------------------------------------------

class TestAudioPreprocessorProcess:
    def test_returns_preprocessed_audio(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert isinstance(result, PreprocessedAudio)

    def test_sample_rate_is_target(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.sample_rate == TARGET_SR

    def test_samples_are_float32(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.samples.dtype == np.float32

    def test_samples_are_1d(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.samples.ndim == 1

    def test_source_path_is_absolute(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.source_path.is_absolute()

    def test_stereo_44k_converted_to_mono_16k(self, preprocessor, wav_44k_stereo):
        result = preprocessor.process(wav_44k_stereo)
        assert result.sample_rate == TARGET_SR
        assert result.original_channels == 2
        assert result.was_resampled is True
        assert result.samples.ndim == 1

    def test_8k_mono_upsampled(self, preprocessor, wav_8k_mono):
        result = preprocessor.process(wav_8k_mono)
        assert result.sample_rate == TARGET_SR
        assert result.was_resampled is True

    def test_16k_mono_not_resampled(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.was_resampled is False

    def test_duration_is_positive(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert result.duration_s > 0

    def test_peak_amplitude_is_one(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(wav_16k_mono)
        assert abs(np.abs(result.samples).max() - 1.0) < 1e-5

    def test_missing_file_raises_file_not_found(self, preprocessor, tmp_path):
        with pytest.raises(FileNotFoundError):
            preprocessor.process(tmp_path / "missing.wav")

    def test_string_path_accepted(self, preprocessor, wav_16k_mono):
        result = preprocessor.process(str(wav_16k_mono))
        assert isinstance(result, PreprocessedAudio)

    def test_too_short_raises_value_error(self, tmp_path):
        # Write a WAV that is only 0.01 s long (below MIN_AUDIO_DURATION_S)
        path = write_wav_file(
            tmp_path / "short.wav",
            duration_s=0.01,
            sample_rate=16_000,
        )
        pp = AudioPreprocessor(trim_silence=False)
        with pytest.raises(ValueError, match="too short"):
            pp.process(path)


# ---------------------------------------------------------------------------
# get_preprocessor singleton
# ---------------------------------------------------------------------------

class TestGetPreprocessor:
    def test_returns_audio_preprocessor(self):
        pp = get_preprocessor()
        assert isinstance(pp, AudioPreprocessor)

    def test_singleton_same_instance(self):
        a = get_preprocessor()
        b = get_preprocessor()
        assert a is b
