# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: speech_to_text/__init__.py
# Purpose: Public API surface for the speech_to_text package.
#          Import from here; never import internal sub-modules directly
#          in application code.
# =============================================================================

from __future__ import annotations

__version__: str = "1.0.0"
__author__:  str = "AKP Engineering"

# ---------------------------------------------------------------------------
# Only stdlib + pathlib constants are imported eagerly.
# All modules that depend on numpy / soundfile / faster_whisper are lazy.
# This ensures `import speech_to_text` succeeds in any environment.
# ---------------------------------------------------------------------------
from speech_to_text.config import (
    STTConfig,
    get_config,
    STT_ROOT,
    AI_ROOT,
    SUPPORTED_MODELS,
    DEFAULT_MODEL,
    SUPPORTED_AUDIO_EXTENSIONS,
)


def __getattr__(name: str):  # PEP 562 — module-level __getattr__
    _lazy: dict[str, tuple[str, str]] = {
        # audio preprocessing
        "AudioPreprocessor":  ("speech_to_text.audio_preprocessor", "AudioPreprocessor"),
        "PreprocessedAudio":  ("speech_to_text.audio_preprocessor", "PreprocessedAudio"),
        "get_preprocessor":   ("speech_to_text.audio_preprocessor", "get_preprocessor"),
        "SUPPORTED_EXTENSIONS": ("speech_to_text.audio_preprocessor", "SUPPORTED_EXTENSIONS"),
        "TARGET_SR":          ("speech_to_text.audio_preprocessor", "TARGET_SR"),        # model management
        "ModelManager":       ("speech_to_text.model_manager",   "ModelManager"),
        "get_model_manager":  ("speech_to_text.model_manager",   "get_model_manager"),
        # language detection
        "LanguageDetector":        ("speech_to_text.language_detector", "LanguageDetector"),
        "LanguageDetectionResult": ("speech_to_text.language_detector", "LanguageDetectionResult"),
        "get_language_detector":   ("speech_to_text.language_detector", "get_language_detector"),
        # transcription
        "Transcriber":          ("speech_to_text.transcriber", "Transcriber"),
        "TranscriptionResult":  ("speech_to_text.transcriber", "TranscriptionResult"),
        "TranscriptionSegment": ("speech_to_text.transcriber", "TranscriptionSegment"),
        "get_transcriber":      ("speech_to_text.transcriber", "get_transcriber"),
        # batch
        "BatchTranscriber": ("speech_to_text.batch_transcriber", "BatchTranscriber"),
        "BatchResult":      ("speech_to_text.batch_transcriber", "BatchResult"),
        "FileRecord":       ("speech_to_text.batch_transcriber", "FileRecord"),
        "run_batch":        ("speech_to_text.batch_transcriber", "run_batch"),
    }
    if name in _lazy:
        import importlib
        module_name, attr = _lazy[name]
        module = importlib.import_module(module_name)
        value  = getattr(module, attr)
        globals()[name] = value   # cache for subsequent accesses
        return value
    raise AttributeError(f"module 'speech_to_text' has no attribute {name!r}")

__all__ = [
    # config
    "STTConfig", "get_config", "STT_ROOT", "AI_ROOT",
    "SUPPORTED_MODELS", "DEFAULT_MODEL",
    # model
    "ModelManager", "get_model_manager",
    # audio
    "AudioPreprocessor", "PreprocessedAudio", "get_preprocessor",
    "SUPPORTED_EXTENSIONS", "TARGET_SR",
    # language
    "LanguageDetector", "LanguageDetectionResult", "get_language_detector",
    # transcription
    "Transcriber", "TranscriptionResult", "TranscriptionSegment", "get_transcriber",
    # batch
    "BatchTranscriber", "BatchResult", "FileRecord", "run_batch",
]
