# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/language_detector.py
# Purpose: Detects the spoken language of an audio file using Faster-Whisper's
#          built-in language identification — no full transcription required.
#
# Strategy:
#   1. Preprocess audio (validate, mono, resample, trim, normalise)
#   2. Clip to first 30 s (Whisper's language-detection window)
#   3. Call WhisperModel.detect_language() if available (faster-whisper ≥ 1.x)
#      OR fall back to a single-segment transcribe() with beam_size=1
#   4. Return LanguageDetectionResult with ranked candidates
# =============================================================================

from __future__ import annotations

import logging
import sys
import time
from dataclasses import dataclass, field
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

import numpy as np

from speech_to_text.audio_preprocessor import (
    AudioPreprocessor,
    PreprocessedAudio,
    TARGET_SR,
    get_preprocessor,
)
from speech_to_text.config import STTConfig, get_config
from speech_to_text.model_manager import ModelManager, get_model_manager

# Language-detection clip length — matches Whisper's internal window
_DETECT_CLIP_S: int = 30


# =============================================================================
# RESULT DATACLASS
# =============================================================================

@dataclass
class LanguageDetectionResult:
    """
    Result returned by LanguageDetector.detect().

    Attributes:
        language:       Most-likely BCP-47 language code (e.g. 'hi', 'en').
        probability:    Confidence of the top language in [0, 1].
        all_probs:      Dict of {lang_code: probability} for all candidates,
                        sorted descending by probability.
        duration_s:     Length of the audio clip used for detection (≤ 30 s).
        detection_time_s: Wall-clock seconds spent on detection.
        source_path:    Absolute path to the original audio file.
        model_size:     Whisper model size used.
    """
    language:          str
    probability:       float
    all_probs:         dict[str, float]
    duration_s:        float
    detection_time_s:  float
    source_path:       Path
    model_size:        str


# =============================================================================
# LOGGER
# =============================================================================

def _build_logger(cfg: STTConfig) -> logging.Logger:
    logger = logging.getLogger("akp.stt.language_detector")
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

    log_file = cfg.logs_dir / "stt_language_detector.log"
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


# =============================================================================
# LANGUAGE DETECTOR
# =============================================================================

class LanguageDetector:
    """
    Detects the spoken language of an audio file using Faster-Whisper.

    Uses only the first 30 seconds of audio (Whisper's detection window).
    Does NOT perform full transcription — significantly faster than transcribe().

    Usage:
        detector = LanguageDetector()
        result = detector.detect("recording.wav")
        print(result.language, result.probability)
    """

    def __init__(
        self,
        model_size:   Optional[str] = None,
        cfg:          Optional[STTConfig] = None,
        model_manager: Optional[ModelManager] = None,
        preprocessor: Optional[AudioPreprocessor] = None,
    ) -> None:
        self._cfg          = cfg or get_config()
        self._log          = _build_logger(self._cfg)
        self._model_manager = model_manager or get_model_manager()
        self._preprocessor  = preprocessor or get_preprocessor()
        self._model_size    = model_size or self._cfg.default_model
        self._model         = None  # lazy-loaded

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def detect(
        self,
        audio: str | Path | PreprocessedAudio,
    ) -> LanguageDetectionResult:
        """
        Detects the spoken language of the given audio.

        Args:
            audio: File path (str/Path) or a PreprocessedAudio object.

        Returns:
            LanguageDetectionResult

        Raises:
            FileNotFoundError: If a path is given and the file does not exist.
            ValueError:        If the audio is invalid or too short.
            RuntimeError:      If the model fails to load or detection errors.
        """
        preprocessed = self._ensure_preprocessed(audio)
        model        = self._ensure_model()

        clip_samples = preprocessed.samples[: _DETECT_CLIP_S * TARGET_SR]
        clip_duration = len(clip_samples) / TARGET_SR

        self._log.info(
            "Detecting language for '%s' | clip=%.2fs | model=%s",
            preprocessed.source_path.name, clip_duration, self._model_size,
        )

        t0 = time.perf_counter()

        try:
            language, all_probs = self._run_detection(model, clip_samples)
        except Exception as exc:
            raise RuntimeError(
                f"Language detection failed for '{preprocessed.source_path.name}': {exc}"
            ) from exc

        elapsed     = time.perf_counter() - t0
        probability = round(float(all_probs.get(language, 0.0)), 4)
        sorted_probs = dict(
            sorted(all_probs.items(), key=lambda kv: kv[1], reverse=True)
        )

        self._log.info(
            "Detected '%s' | lang=%s (%.0f%%) | %.3fs",
            preprocessed.source_path.name, language, probability * 100, elapsed,
        )

        return LanguageDetectionResult(
            language         = language,
            probability      = probability,
            all_probs        = sorted_probs,
            duration_s       = round(clip_duration, 4),
            detection_time_s = round(elapsed, 4),
            source_path      = preprocessed.source_path,
            model_size       = self._model_size,
        )

    def detect_top_n(
        self,
        audio: str | Path | PreprocessedAudio,
        n: int = 5,
    ) -> list[tuple[str, float]]:
        """
        Returns the top-N language candidates as (lang_code, probability) tuples.

        Args:
            audio: File path or PreprocessedAudio.
            n:     Number of top candidates to return (default 5).

        Returns:
            List of (language_code, probability) sorted by probability descending.
        """
        result = self.detect(audio)
        return list(result.all_probs.items())[:n]

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _run_detection(
        self,
        model,
        clip_samples: np.ndarray,
    ) -> tuple[str, dict[str, float]]:
        """
        Runs language detection using the best available API.

        Faster-Whisper ≥ 1.0 exposes model.detect_language(audio) which
        returns (language, {lang: prob}).  Older builds only have transcribe().
        We try the native API first and fall back gracefully.

        Returns:
            (top_language, {lang_code: probability})
        """
        # --- native detect_language (faster-whisper ≥ 1.0) ---------------
        if hasattr(model, "detect_language"):
            try:
                lang, probs = model.detect_language(clip_samples)
                # probs may be a list of (lang, prob) tuples or a dict
                if isinstance(probs, (list, tuple)) and probs and isinstance(probs[0], (list, tuple)):
                    probs_dict = {k: float(v) for k, v in probs}
                elif isinstance(probs, dict):
                    probs_dict = {k: float(v) for k, v in probs.items()}
                else:
                    probs_dict = {lang: 1.0}
                return lang, probs_dict
            except Exception:
                pass  # fall through to transcribe-based detection

        # --- fallback: single-pass transcribe with beam_size=1 ------------
        segments_iter, info = model.transcribe(
            clip_samples,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            vad_filter=False,
            without_timestamps=True,
            condition_on_previous_text=False,
        )
        # Materialise the generator so Whisper actually runs the detection pass
        _ = list(segments_iter)

        lang  = info.language
        prob  = float(info.language_probability)
        return lang, {lang: prob}

    def _ensure_preprocessed(self, audio: str | Path | PreprocessedAudio) -> PreprocessedAudio:
        if isinstance(audio, PreprocessedAudio):
            return audio
        return self._preprocessor.process(Path(audio))

    def _ensure_model(self):
        if self._model is None:
            self._model = self._model_manager.load(self._model_size)
        return self._model


# =============================================================================
# MODULE-LEVEL SINGLETON
# =============================================================================

_detector_instance: Optional[LanguageDetector] = None


def get_language_detector(model_size: Optional[str] = None) -> LanguageDetector:
    """
    Returns the module-level singleton LanguageDetector.

    Args:
        model_size: Whisper model size. Defaults to STTConfig.default_model.
                    Ignored after the first call.

    Returns:
        LanguageDetector: Ready-to-use detector instance.

    Usage:
        from speech_to_text.language_detector import get_language_detector
        result = get_language_detector().detect("audio.wav")
        print(result.language, result.probability)
    """
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = LanguageDetector(model_size=model_size)
    return _detector_instance


# =============================================================================
# SELF-TEST
# =============================================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m speech_to_text.language_detector <audio_file> [model_size]")
        sys.exit(1)

    audio_path = sys.argv[1]
    size       = sys.argv[2] if len(sys.argv) > 2 else None

    detector = LanguageDetector(model_size=size)
    res      = detector.detect(audio_path)

    print("\n" + "=" * 60)
    print("  AKP STT — Language Detection Result")
    print("=" * 60)
    print(f"\n  File       : {res.source_path.name}")
    print(f"  Language   : {res.language}")
    print(f"  Confidence : {res.probability * 100:.1f}%")
    print(f"  Clip       : {res.duration_s:.2f}s")
    print(f"  Model      : {res.model_size}")
    print(f"  Time       : {res.detection_time_s:.3f}s")
    print(f"\n  Top candidates:")
    for lang, prob in list(res.all_probs.items())[:10]:
        bar = "█" * int(prob * 30)
        print(f"    {lang:<6} {prob * 100:5.1f}%  {bar}")
    print("\n" + "=" * 60 + "\n")
