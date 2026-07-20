# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/transcriber.py
# Purpose: Transcribes preprocessed audio using Faster-Whisper.
#          Produces full text, per-segment timestamps, per-segment confidence,
#          detected language, and language detection probability.
#
# Pipeline:
#   1. Accept a file path  OR  a PreprocessedAudio object
#   2. Preprocess (if raw path given) via AudioPreprocessor
#   3. Run WhisperModel.transcribe() — fully offline, no network calls
#   4. Collect segments → TranscriptionSegment list
#   5. Return TranscriptionResult
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

from speech_to_text.audio_preprocessor import AudioPreprocessor, PreprocessedAudio, get_preprocessor
from speech_to_text.config import STTConfig, get_config
from speech_to_text.model_manager import ModelManager, get_model_manager


# =============================================================================
# RESULT DATACLASSES
# =============================================================================

@dataclass
class TranscriptionSegment:
    """
    A single time-aligned segment from the transcription.

    Attributes:
        id:          Zero-based segment index.
        start:       Segment start time in seconds.
        end:         Segment end time in seconds.
        text:        Transcribed text for this segment (stripped).
        confidence:  Average log-probability converted to a [0, 1] score.
                     Computed as exp(avg_logprob). Higher is better.
        words:       Optional word-level timestamps (populated when
                     word_timestamps=True is passed to Transcriber).
    """
    id: int
    start: float
    end: float
    text: str
    confidence: float
    words: list[dict] = field(default_factory=list)


@dataclass
class TranscriptionResult:
    """
    Complete result returned by Transcriber.transcribe().

    Attributes:
        text:               Full concatenated transcript.
        segments:           Ordered list of TranscriptionSegment objects.
        language:           BCP-47 language code detected by Whisper (e.g. 'hi', 'en').
        language_probability: Confidence of the language detection in [0, 1].
        duration_s:         Audio duration in seconds (after preprocessing).
        transcription_time_s: Wall-clock seconds spent in transcription.
        model_size:         Whisper model size used (e.g. 'base').
        source_path:        Absolute path to the original audio file.
    """
    text: str
    segments: list[TranscriptionSegment]
    language: str
    language_probability: float
    duration_s: float
    transcription_time_s: float
    model_size: str
    source_path: Path


# =============================================================================
# MODULE LOGGER
# =============================================================================

def _build_logger(cfg: STTConfig) -> logging.Logger:
    logger = logging.getLogger("akp.stt.transcriber")
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

    log_file = cfg.logs_dir / "stt_transcriber.log"
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
# TRANSCRIBER
# =============================================================================

class Transcriber:
    """
    Transcribes audio files or PreprocessedAudio objects using Faster-Whisper.

    All transcription is performed locally — no network calls after the model
    is downloaded. Language detection is automatic unless `language` is forced.

    Usage:
        transcriber = Transcriber()
        result = transcriber.transcribe("recording.wav")
        print(result.text)
        for seg in result.segments:
            print(f"[{seg.start:.2f}s → {seg.end:.2f}s] {seg.text}  (conf={seg.confidence:.2f})")
    """

    def __init__(
        self,
        model_size: Optional[str] = None,
        cfg: Optional[STTConfig] = None,
        model_manager: Optional[ModelManager] = None,
        preprocessor: Optional[AudioPreprocessor] = None,
    ) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)
        self._model_manager = model_manager or get_model_manager()
        self._preprocessor = preprocessor or get_preprocessor()
        self._model_size = model_size or self._cfg.default_model
        self._model = None  # lazy-loaded on first transcribe call

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def transcribe(
        self,
        audio: str | Path | PreprocessedAudio,
        *,
        language: Optional[str] = None,
        word_timestamps: bool = False,
        beam_size: int = 5,
        best_of: int = 5,
        temperature: float | list[float] = 0.0,
        vad_filter: bool = True,
        condition_on_previous_text: bool = True,
    ) -> TranscriptionResult:
        """
        Transcribes audio and returns a structured result with segments,
        timestamps, confidence scores, and detected language.

        Args:
            audio:                    File path (str/Path) or PreprocessedAudio.
            language:                 Force a specific language code (e.g. 'hi').
                                      None = auto-detect (default).
            word_timestamps:          Include word-level timestamps in segments.
            beam_size:                Beam search width (higher = more accurate, slower).
            best_of:                  Number of candidates for stochastic sampling.
            temperature:              Sampling temperature. 0.0 = greedy decoding.
            vad_filter:               Apply Silero VAD to skip non-speech frames.
            condition_on_previous_text: Feed previous segment text as prompt.

        Returns:
            TranscriptionResult

        Raises:
            FileNotFoundError: If a path is given and the file does not exist.
            ValueError:        If the audio is invalid or too short/long.
            RuntimeError:      If the model fails to load or transcription errors.
        """
        preprocessed = self._ensure_preprocessed(audio)
        model = self._ensure_model()

        self._log.info(
            "Transcribing '%s' | %.2fs | model=%s | lang=%s | vad=%s",
            preprocessed.source_path.name,
            preprocessed.duration_s,
            self._model_size,
            language or "auto",
            vad_filter,
        )

        t0 = time.perf_counter()

        try:
            segments_iter, info = model.transcribe(
                preprocessed.samples,
                language=language,
                beam_size=beam_size,
                best_of=best_of,
                temperature=temperature,
                word_timestamps=word_timestamps,
                vad_filter=vad_filter,
                condition_on_previous_text=condition_on_previous_text,
            )
            segments = self._collect_segments(segments_iter, word_timestamps)
        except Exception as exc:
            raise RuntimeError(
                f"Transcription failed for '{preprocessed.source_path.name}': {exc}"
            ) from exc

        elapsed = time.perf_counter() - t0
        full_text = " ".join(seg.text for seg in segments).strip()

        result = TranscriptionResult(
            text=full_text,
            segments=segments,
            language=info.language,
            language_probability=round(float(info.language_probability), 4),
            duration_s=round(preprocessed.duration_s, 4),
            transcription_time_s=round(elapsed, 4),
            model_size=self._model_size,
            source_path=preprocessed.source_path,
        )

        self._log.info(
            "Done '%s' | lang=%s (%.0f%%) | %d segments | %.2fs transcription time",
            preprocessed.source_path.name,
            result.language,
            result.language_probability * 100,
            len(segments),
            elapsed,
        )
        return result

    def detect_language(self, audio: str | Path | PreprocessedAudio) -> tuple[str, float]:
        """
        Detects the spoken language without performing full transcription.
        Uses Whisper's first-30-second language detection pass.

        Args:
            audio: File path or PreprocessedAudio.

        Returns:
            (language_code, probability) — e.g. ('hi', 0.97)

        Raises:
            RuntimeError: If language detection fails.
        """
        preprocessed = self._ensure_preprocessed(audio)
        model = self._ensure_model()

        try:
            # Whisper language detection uses the first 30 s of audio
            clip = preprocessed.samples[: 30 * preprocessed.sample_rate]
            _, info = model.transcribe(
                clip,
                beam_size=1,
                best_of=1,
                temperature=0.0,
                vad_filter=False,
                without_timestamps=True,
            )
            lang = info.language
            prob = round(float(info.language_probability), 4)
            self._log.info(
                "Language detected for '%s': %s (%.0f%%)",
                preprocessed.source_path.name, lang, prob * 100,
            )
            return lang, prob
        except Exception as exc:
            raise RuntimeError(
                f"Language detection failed for '{preprocessed.source_path.name}': {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _ensure_preprocessed(self, audio: str | Path | PreprocessedAudio) -> PreprocessedAudio:
        """Returns a PreprocessedAudio, running the preprocessor if needed."""
        if isinstance(audio, PreprocessedAudio):
            return audio
        return self._preprocessor.process(Path(audio))

    def _ensure_model(self):
        """Lazy-loads the WhisperModel on first call."""
        if self._model is None:
            self._model = self._model_manager.load(self._model_size)
        return self._model

    @staticmethod
    def _collect_segments(
        segments_iter,
        word_timestamps: bool,
    ) -> list[TranscriptionSegment]:
        """
        Materialises the lazy segment generator from Faster-Whisper into a
        list of TranscriptionSegment objects.

        avg_logprob from Faster-Whisper is in (-∞, 0].
        confidence = exp(avg_logprob) maps it to (0, 1].
        """
        result: list[TranscriptionSegment] = []
        for seg in segments_iter:
            confidence = round(float(np.exp(seg.avg_logprob)), 4)
            words: list[dict] = []
            if word_timestamps and seg.words:
                words = [
                    {
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(float(w.probability), 4),
                    }
                    for w in seg.words
                ]
            result.append(
                TranscriptionSegment(
                    id=seg.id,
                    start=round(seg.start, 3),
                    end=round(seg.end, 3),
                    text=seg.text.strip(),
                    confidence=confidence,
                    words=words,
                )
            )
        return result


# =============================================================================
# MODULE-LEVEL SINGLETON
# =============================================================================

_transcriber_instance: Optional[Transcriber] = None


def get_transcriber(model_size: Optional[str] = None) -> Transcriber:
    """
    Returns the module-level singleton Transcriber.
    Instantiated once per process; reused on subsequent calls.

    Args:
        model_size: Whisper model size. Defaults to STTConfig.default_model.
                    Ignored after the first call (singleton is already built).

    Returns:
        Transcriber: Ready-to-use transcriber instance.

    Usage:
        from speech_to_text.transcriber import get_transcriber
        result = get_transcriber().transcribe("audio.wav")
    """
    global _transcriber_instance
    if _transcriber_instance is None:
        _transcriber_instance = Transcriber(model_size=model_size)
    return _transcriber_instance


# =============================================================================
# SELF-TEST
# =============================================================================
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m speech_to_text.transcriber <audio_file> [model_size]")
        sys.exit(1)

    audio_path = sys.argv[1]
    size = sys.argv[2] if len(sys.argv) > 2 else None

    t = Transcriber(model_size=size)
    res = t.transcribe(audio_path, word_timestamps=True)

    print("\n" + "=" * 60)
    print("  AKP STT — Transcription Result")
    print("=" * 60)
    print(f"\n  File     : {res.source_path.name}")
    print(f"  Language : {res.language} ({res.language_probability * 100:.1f}%)")
    print(f"  Duration : {res.duration_s:.2f}s")
    print(f"  Model    : {res.model_size}")
    print(f"  Time     : {res.transcription_time_s:.2f}s")
    print(f"\n  Full Text:\n  {res.text}")
    print(f"\n  Segments ({len(res.segments)}):")
    for seg in res.segments:
        print(f"    [{seg.start:.2f}s → {seg.end:.2f}s] (conf={seg.confidence:.2f}) {seg.text}")
    print("\n" + "=" * 60 + "\n")
