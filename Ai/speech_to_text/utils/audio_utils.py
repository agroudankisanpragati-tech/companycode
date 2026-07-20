# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/utils/audio_utils.py
# Purpose: Shared helpers for generating synthetic audio used in unit tests
#          and pipeline validation.  No external dependencies beyond numpy
#          and the stdlib wave module.
# =============================================================================

from __future__ import annotations

import io
import struct
import wave
from pathlib import Path
from typing import Optional

import numpy as np


# ---------------------------------------------------------------------------
# SYNTHETIC AUDIO GENERATION
# ---------------------------------------------------------------------------

def make_sine_samples(
    frequency_hz: float = 440.0,
    duration_s:   float = 1.0,
    sample_rate:  int   = 16_000,
    amplitude:    float = 0.5,
) -> np.ndarray:
    """
    Returns a float32 numpy array containing a pure sine wave.

    Args:
        frequency_hz: Tone frequency in Hz (default 440 Hz = A4).
        duration_s:   Duration in seconds.
        sample_rate:  Samples per second.
        amplitude:    Peak amplitude in [0, 1].

    Returns:
        np.ndarray: float32 array, shape (N,), range [-amplitude, amplitude].
    """
    t = np.linspace(0, duration_s, int(sample_rate * duration_s), endpoint=False)
    return (amplitude * np.sin(2.0 * np.pi * frequency_hz * t)).astype(np.float32)


def make_wav_bytes(
    frequency_hz: float = 440.0,
    duration_s:   float = 1.0,
    sample_rate:  int   = 16_000,
    n_channels:   int   = 1,
    amplitude:    float = 0.5,
) -> bytes:
    """
    Returns the raw bytes of a valid PCM-16 WAV file in memory.

    Args:
        frequency_hz: Tone frequency in Hz.
        duration_s:   Duration in seconds.
        sample_rate:  Sample rate in Hz.
        n_channels:   1 = mono, 2 = stereo.
        amplitude:    Peak amplitude in [0, 1].

    Returns:
        bytes: Complete WAV file content.
    """
    samples = make_sine_samples(frequency_hz, duration_s, sample_rate, amplitude)

    if n_channels == 2:
        # Duplicate mono to stereo
        samples = np.stack([samples, samples], axis=1)

    # Convert float32 → int16
    pcm = (samples * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(2)          # 16-bit = 2 bytes
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())

    return buf.getvalue()


def write_wav_file(
    path: Path,
    frequency_hz: float = 440.0,
    duration_s:   float = 1.0,
    sample_rate:  int   = 16_000,
    n_channels:   int   = 1,
    amplitude:    float = 0.5,
) -> Path:
    """
    Writes a synthetic WAV file to disk and returns the resolved path.

    Args:
        path:         Destination file path (created if parent exists).
        frequency_hz: Tone frequency in Hz.
        duration_s:   Duration in seconds.
        sample_rate:  Sample rate in Hz.
        n_channels:   1 = mono, 2 = stereo.
        amplitude:    Peak amplitude in [0, 1].

    Returns:
        Path: Resolved absolute path to the written file.
    """
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        make_wav_bytes(frequency_hz, duration_s, sample_rate, n_channels, amplitude)
    )
    return path


def write_wav_file_44k(path: Path, duration_s: float = 1.0) -> Path:
    """Convenience: writes a 44.1 kHz stereo WAV (tests resampling + mono conversion)."""
    return write_wav_file(path, sample_rate=44_100, n_channels=2, duration_s=duration_s)


def write_wav_file_8k(path: Path, duration_s: float = 1.0) -> Path:
    """Convenience: writes an 8 kHz mono WAV (tests upsampling)."""
    return write_wav_file(path, sample_rate=8_000, n_channels=1, duration_s=duration_s)
