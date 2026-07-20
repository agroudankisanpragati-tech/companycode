# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/audio_preprocessor.py
# Purpose: Validates, converts, resamples, trims, and normalises audio
#          before it is passed to the Faster-Whisper transcription engine.
#
# Pipeline (in order):
#   1. Validate — file exists, readable WAV header, PCM format
#   2. Load     — read raw samples + native sample rate via soundfile
#   3. Mono     — average multi-channel audio to a single channel
#   4. Resample — convert any sample rate to TARGET_SR (16 000 Hz)
#   5. Trim     — strip leading/trailing silence below energy threshold
#   6. Normalise— scale peak amplitude to [-1.0, 1.0] float32
#
# Output: PreprocessedAudio dataclass consumed by transcriber.py
# =============================================================================

from __future__ import annotations

import logging
import sys
import wave
from dataclasses import dataclass
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

from speech_to_text.config import STTConfig, get_config, SUPPORTED_AUDIO_EXTENSIONS

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------
TARGET_SR: int = 16_000          # Faster-Whisper requires 16 kHz mono float32
SILENCE_TOP_DB: float = 40.0     # dB below peak considered silence
SILENCE_FRAME_LEN: int = 512     # samples per silence-detection frame
MIN_AUDIO_DURATION_S: float = 0.1
MAX_AUDIO_DURATION_S: float = 3600.0   # 1 hour hard cap
# Alias kept for backward compatibility with existing imports
SUPPORTED_EXTENSIONS: frozenset[str] = SUPPORTED_AUDIO_EXTENSIONS


# ---------------------------------------------------------------------------
# RESULT DATACLASS
# ---------------------------------------------------------------------------
@dataclass
class PreprocessedAudio:
    """
    Holds the fully preprocessed audio ready for transcription.

    Attributes:
        samples:        float32 numpy array, shape (N,), range [-1.0, 1.0]
        sample_rate:    always TARGET_SR (16 000)
        duration_s:     audio length in seconds after trimming
        source_path:    original file path (resolved, absolute)
        original_sr:    sample rate of the source file before resampling
        original_channels: channel count of the source file
        was_resampled:  True if resampling was applied
        was_trimmed:    True if silence was removed from either end
    """
    samples: np.ndarray
    sample_rate: int
    duration_s: float
    source_path: Path
    original_sr: int
    original_channels: int
    was_resampled: bool
    was_trimmed: bool


# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------
def _build_logger(cfg: STTConfig) -> logging.Logger:
    logger = logging.getLogger("akp.stt.audio_preprocessor")
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    log_file = cfg.logs_dir / "stt_audio_preprocessor.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# VALIDATION HELPERS
# ---------------------------------------------------------------------------
def _validate_path(path: Path) -> None:
    """Raises FileNotFoundError or ValueError for unusable paths."""
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")
    if not path.is_file():
        raise ValueError(f"Path is not a file: {path}")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported audio format '{path.suffix}'. "
            f"Supported: {sorted(SUPPORTED_EXTENSIONS)}"
        )
    if path.stat().st_size == 0:
        raise ValueError(f"Audio file is empty (0 bytes): {path}")


def _validate_wav_header(path: Path) -> None:
    """
    For .wav files only: opens the RIFF header and confirms the file is
    a valid PCM or IEEE-float WAV. Raises ValueError on malformed files.
    soundfile handles non-WAV formats natively without this check.
    """
    if path.suffix.lower() != ".wav":
        return
    try:
        with wave.open(str(path), "rb") as wf:
            if wf.getnframes() == 0:
                raise ValueError(f"WAV file contains zero frames: {path}")
            comp_type = wf.getcomptype()
            if comp_type not in ("NONE", ""):
                raise ValueError(
                    f"Compressed WAV not supported (compression='{comp_type}'): {path}"
                )
    except wave.Error as exc:
        raise ValueError(f"Malformed WAV file '{path}': {exc}") from exc


# ---------------------------------------------------------------------------
# AUDIO PROCESSING STEPS
# ---------------------------------------------------------------------------
def _to_mono(samples: np.ndarray) -> np.ndarray:
    """
    Converts multi-channel audio to mono by averaging all channels.
    Input shape: (N,) for mono, (N, C) for multi-channel.
    Output shape: (N,) float32.
    """
    if samples.ndim == 1:
        return samples.astype(np.float32)
    return samples.mean(axis=1).astype(np.float32)


def _resample(samples: np.ndarray, orig_sr: int, target_sr: int) -> tuple[np.ndarray, bool]:
    """
    Resamples audio from orig_sr to target_sr using scipy.signal.resample_poly.
    Falls back to numpy linear interpolation if scipy is unavailable.

    Returns:
        (resampled_samples, was_resampled)
    """
    if orig_sr == target_sr:
        return samples, False

    try:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(target_sr, orig_sr)
        up, down = target_sr // g, orig_sr // g
        resampled = resample_poly(samples, up, down).astype(np.float32)
    except ImportError:
        # Fallback: linear interpolation via numpy
        orig_len = len(samples)
        new_len = int(round(orig_len * target_sr / orig_sr))
        old_indices = np.linspace(0, orig_len - 1, orig_len)
        new_indices = np.linspace(0, orig_len - 1, new_len)
        resampled = np.interp(new_indices, old_indices, samples).astype(np.float32)

    return resampled, True


def _trim_silence(samples: np.ndarray, top_db: float, frame_len: int) -> tuple[np.ndarray, bool]:
    """
    Removes leading and trailing silence using a frame-energy threshold.

    A frame is considered silent when its RMS energy is more than `top_db`
    decibels below the peak RMS across all frames.

    Returns:
        (trimmed_samples, was_trimmed)
    """
    if len(samples) == 0:
        return samples, False

    # Pad to a multiple of frame_len
    pad = (frame_len - len(samples) % frame_len) % frame_len
    padded = np.pad(samples, (0, pad))
    frames = padded.reshape(-1, frame_len)

    rms = np.sqrt((frames ** 2).mean(axis=1))
    rms_db = 20.0 * np.log10(np.maximum(rms, 1e-10))
    threshold_db = rms_db.max() - top_db

    non_silent = np.where(rms_db >= threshold_db)[0]
    if len(non_silent) == 0:
        return samples, False

    start_frame = non_silent[0]
    end_frame = non_silent[-1] + 1

    start_sample = start_frame * frame_len
    end_sample = min(end_frame * frame_len, len(samples))

    trimmed = samples[start_sample:end_sample]
    was_trimmed = (start_sample > 0) or (end_sample < len(samples))
    return trimmed, was_trimmed


def _normalise(samples: np.ndarray) -> np.ndarray:
    """
    Peak-normalises samples to the range [-1.0, 1.0].
    If the signal is silent (all zeros), returns it unchanged.
    """
    peak = np.abs(samples).max()
    if peak < 1e-10:
        return samples
    return (samples / peak).astype(np.float32)


# ---------------------------------------------------------------------------
# AUDIO PREPROCESSOR CLASS
# ---------------------------------------------------------------------------
class AudioPreprocessor:
    """
    Validates and preprocesses audio files for Faster-Whisper transcription.

    All processing steps are applied in a fixed, deterministic order:
    validate → load → mono → resample → trim → normalise.

    Usage:
        preprocessor = AudioPreprocessor()
        audio = preprocessor.process(Path("recording.wav"))
        # audio.samples is ready for WhisperModel.transcribe()
    """

    def __init__(
        self,
        cfg: Optional[STTConfig] = None,
        target_sr: int = TARGET_SR,
        silence_top_db: float = SILENCE_TOP_DB,
        trim_silence: bool = True,
    ) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)
        self._target_sr = target_sr
        self._silence_top_db = silence_top_db
        self._trim_silence = trim_silence

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def process(self, audio_path: str | Path) -> PreprocessedAudio:
        """
        Runs the full preprocessing pipeline on the given audio file.

        Args:
            audio_path: Path to the audio file. Resolved to absolute path.

        Returns:
            PreprocessedAudio: Processed audio ready for transcription.

        Raises:
            FileNotFoundError: If the file does not exist.
            ValueError: If the file is invalid, empty, or unsupported.
            RuntimeError: If audio loading or processing fails.
        """
        path = Path(audio_path).resolve()
        self._log.info("Preprocessing audio: %s", path.name)

        _validate_path(path)
        _validate_wav_header(path)

        samples, orig_sr = self._load(path)
        orig_channels = 1 if samples.ndim == 1 else samples.shape[1]

        samples = _to_mono(samples)
        samples, was_resampled = _resample(samples, orig_sr, self._target_sr)

        was_trimmed = False
        if self._trim_silence:
            samples, was_trimmed = _trim_silence(
                samples, self._silence_top_db, SILENCE_FRAME_LEN
            )

        samples = _normalise(samples)

        duration_s = len(samples) / self._target_sr
        self._validate_duration(duration_s, path)

        self._log.info(
            "Preprocessed '%s' | %.2fs | sr=%d→%d | ch=%d | "
            "resampled=%s | trimmed=%s",
            path.name, duration_s, orig_sr, self._target_sr,
            orig_channels, was_resampled, was_trimmed,
        )

        return PreprocessedAudio(
            samples=samples,
            sample_rate=self._target_sr,
            duration_s=duration_s,
            source_path=path,
            original_sr=orig_sr,
            original_channels=orig_channels,
            was_resampled=was_resampled,
            was_trimmed=was_trimmed,
        )

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _load(self, path: Path) -> tuple[np.ndarray, int]:
        """
        Loads audio samples and sample rate from disk using soundfile.
        Returns float32 samples in range [-1.0, 1.0] and the native SR.

        Raises:
            RuntimeError: If soundfile cannot read the file.
        """
        try:
            samples, sr = sf.read(str(path), dtype="float32", always_2d=False)
            return samples, int(sr)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to load audio file '{path}': {exc}"
            ) from exc

    def _validate_duration(self, duration_s: float, path: Path) -> None:
        if duration_s < MIN_AUDIO_DURATION_S:
            raise ValueError(
                f"Audio too short ({duration_s:.3f}s < {MIN_AUDIO_DURATION_S}s): {path}"
            )
        if duration_s > MAX_AUDIO_DURATION_S:
            raise ValueError(
                f"Audio too long ({duration_s:.1f}s > {MAX_AUDIO_DURATION_S}s): {path}"
            )


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------
_preprocessor_instance: Optional[AudioPreprocessor] = None


def get_preprocessor(
    trim_silence: bool = True,
    silence_top_db: float = SILENCE_TOP_DB,
) -> AudioPreprocessor:
    """
    Returns the module-level singleton AudioPreprocessor.

    Args:
        trim_silence:    Enable silence trimming (default True).
        silence_top_db:  dB threshold for silence detection (default 40.0).

    Returns:
        AudioPreprocessor: Ready-to-use preprocessor instance.
    """
    global _preprocessor_instance
    if _preprocessor_instance is None:
        _preprocessor_instance = AudioPreprocessor(
            trim_silence=trim_silence,
            silence_top_db=silence_top_db,
        )
    return _preprocessor_instance
