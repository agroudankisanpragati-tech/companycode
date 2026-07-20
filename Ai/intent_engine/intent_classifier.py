# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/intent_classifier.py
# Purpose: Core classification layer. Wraps ModelArtefacts with:
#   - Multilingual text normalisation (Hindi / English / mixed)
#   - Configurable confidence threshold → "unknown" intent fallback
#   - Single and batch prediction with top-N probabilities
#   - STT output integration (accepts TranscriptionResult-like dicts)
#   - Knowledge Router–ready output schema
#   - Rotating file + console logging
# =============================================================================

from __future__ import annotations

import logging
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from intent_engine.config import IntentEngineConfig, get_config
from intent_engine.model_manager import ModelArtefacts, ModelManager, get_model_manager


# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

UNKNOWN_INTENT: str = "unknown"
# FIXED: Lowered from 0.30 to 0.20 — with 13+ classes and mixed scripts,
# many valid queries score 0.22–0.29 and were incorrectly marked unknown.
# The alias resolver catches high-confidence cases before the ML model,
# so the ML model only sees ambiguous queries where a lower threshold is correct.
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.20
DEFAULT_TOP_N: int = 3


# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: IntentEngineConfig) -> logging.Logger:
    logger = logging.getLogger("akp.intent.classifier")
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

    log_file = cfg.logs_dir / "intent_classifier.log"
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
# DATA STRUCTURES
# ---------------------------------------------------------------------------

@dataclass
class ClassificationResult:
    """
    Output of a single intent classification.

    Attributes:
        text:           Normalised input text.
        raw_text:       Original un-normalised input.
        intent:         Top predicted intent label (or "unknown").
        confidence:     Probability of the top intent (0.0 – 1.0).
        is_unknown:     True when confidence < threshold.
        top_predictions: List of (intent, confidence) tuples, descending.
        language_hint:  Detected script family: "latin", "devanagari", "mixed".
        timestamp:      UTC ISO-8601 timestamp of prediction.
        metadata:       Arbitrary key-value pairs for downstream consumers
                        (e.g. Knowledge Router, session ID, STT segment ID).
    """
    text:            str
    raw_text:        str
    intent:          str
    confidence:      float
    is_unknown:      bool
    top_predictions: list[tuple[str, float]]
    language_hint:   str
    timestamp:       str
    metadata:        dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialisable dict — safe for JSON / API responses."""
        return {
            "text":            self.text,
            "raw_text":        self.raw_text,
            "intent":          self.intent,
            "confidence":      self.confidence,
            "is_unknown":      self.is_unknown,
            "top_predictions": [
                {"intent": i, "confidence": c} for i, c in self.top_predictions
            ],
            "language_hint":   self.language_hint,
            "timestamp":       self.timestamp,
            "metadata":        self.metadata,
        }


# ---------------------------------------------------------------------------
# TEXT NORMALISATION
# ---------------------------------------------------------------------------

# Devanagari Unicode block: U+0900 – U+097F
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
# Basic Latin letters
_LATIN_RE = re.compile(r"[a-zA-Z]")
# Other Indian scripts (Gujarati, Punjabi/Gurmukhi, Bengali, Tamil, Telugu,
# Kannada, Malayalam, Odia, Urdu/Arabic)
_INDIC_RE = re.compile(
    r"[\u0A80-\u0AFF"   # Gujarati
    r"\u0A00-\u0A7F"   # Gurmukhi (Punjabi)
    r"\u0980-\u09FF"   # Bengali
    r"\u0B80-\u0BFF"   # Tamil
    r"\u0C00-\u0C7F"   # Telugu
    r"\u0C80-\u0CFF"   # Kannada
    r"\u0D00-\u0D7F"   # Malayalam
    r"\u0B00-\u0B7F"   # Odia
    r"\u0600-\u06FF"   # Arabic/Urdu
    r"]"
)


def _detect_script(text: str) -> str:
    """
    Returns the dominant script family of the text.

    Returns:
        "devanagari" — text is predominantly Devanagari (Hindi/regional)
        "latin"      — text is predominantly Latin (English)
        "mixed"      — significant presence of both scripts
        "indic"      — other Indian script (Gujarati, Punjabi, Bengali, etc.)
        "unknown"    — no recognisable script characters
    """
    deva_count  = len(_DEVANAGARI_RE.findall(text))
    latin_count = len(_LATIN_RE.findall(text))
    indic_count = len(_INDIC_RE.findall(text))
    total = deva_count + latin_count + indic_count

    if total == 0:
        return "unknown"

    # Indic scripts other than Devanagari
    if indic_count > 0 and deva_count == 0 and latin_count == 0:
        return "indic"

    deva_ratio = deva_count / total
    if deva_ratio >= 0.60:
        return "devanagari"
    if deva_ratio <= 0.20 and latin_count > 0:
        return "latin"
    return "mixed"


def normalise_text(text: str) -> str:
    """
    Normalises input text for classification.

    Steps:
      1. Unicode NFC — handles composed Devanagari characters correctly
      2. Lowercase (Latin characters only; Devanagari is case-insensitive)
      3. Collapse all whitespace to single space
      4. Strip leading/trailing whitespace

    Preserves Devanagari, Latin, digits, and common punctuation.
    Does NOT strip Devanagari characters or transliterate.

    Args:
        text: Raw input string (Hindi, English, or mixed).

    Returns:
        Normalised string ready for TF-IDF vectorisation.
    """
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# INTENT CLASSIFIER
# ---------------------------------------------------------------------------

class IntentClassifier:
    """
    Classifies user intent from text.

    Supports:
      - Hindi (Devanagari script)
      - English (Latin script)
      - Mixed Hindi-English (code-switching)
      - Future regional languages (Rajasthani dialects, etc.)

    Usage:
        classifier = IntentClassifier()
        result = classifier.classify("मेरी फसल में बीमारी है")
        print(result.intent, result.confidence)

        # Batch
        results = classifier.classify_batch(["crop disease", "weather today"])

        # From STT output
        result = classifier.classify_from_stt({"text": "...", "language": "hi"})
    """

    def __init__(
        self,
        cfg:                  Optional[IntentEngineConfig] = None,
        model_manager:        Optional[ModelManager]       = None,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
        top_n:                int   = DEFAULT_TOP_N,
    ) -> None:
        self._cfg       = cfg or get_config()
        self._log       = _build_logger(self._cfg)
        self._manager   = model_manager or get_model_manager()
        self._threshold = confidence_threshold
        self._top_n     = top_n
        self._artefacts: Optional[ModelArtefacts] = None

    # ------------------------------------------------------------------
    # MODEL LOADING
    # ------------------------------------------------------------------

    def load(self) -> "IntentClassifier":
        """
        Loads model artefacts from disk. Called lazily on first classify()
        call, or explicitly to pre-warm the classifier.

        Returns:
            self — for chaining: classifier = IntentClassifier().load()

        Raises:
            FileNotFoundError: If model artefacts are missing.
            RuntimeError:      If loading fails.
        """
        if self._artefacts is not None:
            return self
        self._log.info("Loading intent model from %s", self._cfg.models_dir)
        self._artefacts = self._manager.load()
        meta = self._artefacts.metadata
        self._log.info(
            "Model loaded — type=%s  classes=%d  trained_at=%s",
            meta.get("model_type", "?"),
            meta.get("num_classes", "?"),
            meta.get("trained_at", "?"),
        )
        return self

    def is_loaded(self) -> bool:
        """Returns True if model artefacts are in memory."""
        return self._artefacts is not None

    # ------------------------------------------------------------------
    # SINGLE PREDICTION
    # ------------------------------------------------------------------

    def classify(
        self,
        text:     str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> ClassificationResult:
        """
        Classifies a single text string.

        Args:
            text:     Raw input text (Hindi, English, or mixed).
            metadata: Optional dict attached to the result (e.g. session_id,
                      stt_segment_id) — passed through to ClassificationResult.

        Returns:
            ClassificationResult with intent, confidence, top predictions,
            language hint, and timestamp.
        """
        self._ensure_loaded()

        raw_text      = text
        norm_text     = normalise_text(text)
        language_hint = _detect_script(text)

        if not norm_text:
            self._log.warning("Empty text after normalisation — returning unknown")
            return self._unknown_result(raw_text, norm_text, language_hint, metadata)

        proba_list = self._artefacts.predict_proba([norm_text])  # type: ignore[union-attr]
        proba_dict = proba_list[0]

        top_preds = sorted(proba_dict.items(), key=lambda x: x[1], reverse=True)
        top_intent, top_conf = top_preds[0]

        is_unknown = top_conf < self._threshold
        intent     = UNKNOWN_INTENT if is_unknown else top_intent

        if is_unknown:
            self._log.debug(
                "Low confidence (%.4f < %.4f) for '%s' → unknown",
                top_conf, self._threshold, norm_text[:60],
            )
        else:
            self._log.debug(
                "Classified '%s' → %s (%.4f)",
                norm_text[:60], intent, top_conf,
            )

        return ClassificationResult(
            text            = norm_text,
            raw_text        = raw_text,
            intent          = intent,
            confidence      = round(top_conf, 4),
            is_unknown      = is_unknown,
            top_predictions = [(i, round(c, 4)) for i, c in top_preds[: self._top_n]],
            language_hint   = language_hint,
            timestamp       = datetime.now(timezone.utc).isoformat(),
            metadata        = metadata or {},
        )

    # ------------------------------------------------------------------
    # BATCH PREDICTION
    # ------------------------------------------------------------------

    def classify_batch(
        self,
        texts:    list[str],
        metadata: Optional[list[dict[str, Any]]] = None,
    ) -> list[ClassificationResult]:
        """
        Classifies a list of text strings in a single vectoriser pass.

        Args:
            texts:    List of raw input strings.
            metadata: Optional list of metadata dicts, one per text.
                      If shorter than texts, missing entries default to {}.

        Returns:
            List of ClassificationResult, one per input text.
        """
        self._ensure_loaded()

        if not texts:
            return []

        meta_list = metadata or []
        results: list[ClassificationResult] = []

        # Separate empty from non-empty to avoid vectoriser issues
        norm_texts    = [normalise_text(t) for t in texts]
        non_empty_idx = [i for i, t in enumerate(norm_texts) if t]

        # Batch vectorise only non-empty texts
        proba_map: dict[int, dict[str, float]] = {}
        if non_empty_idx:
            batch_texts = [norm_texts[i] for i in non_empty_idx]
            proba_list  = self._artefacts.predict_proba(batch_texts)  # type: ignore[union-attr]
            for idx, proba_dict in zip(non_empty_idx, proba_list):
                proba_map[idx] = proba_dict

        for i, (raw_text, norm_text) in enumerate(zip(texts, norm_texts)):
            meta      = meta_list[i] if i < len(meta_list) else {}
            lang_hint = _detect_script(raw_text)

            if not norm_text or i not in proba_map:
                results.append(self._unknown_result(raw_text, norm_text, lang_hint, meta))
                continue

            proba_dict = proba_map[i]
            top_preds  = sorted(proba_dict.items(), key=lambda x: x[1], reverse=True)
            top_intent, top_conf = top_preds[0]
            is_unknown = top_conf < self._threshold
            intent     = UNKNOWN_INTENT if is_unknown else top_intent

            results.append(ClassificationResult(
                text            = norm_text,
                raw_text        = raw_text,
                intent          = intent,
                confidence      = round(top_conf, 4),
                is_unknown      = is_unknown,
                top_predictions = [(i2, round(c, 4)) for i2, c in top_preds[: self._top_n]],
                language_hint   = lang_hint,
                timestamp       = datetime.now(timezone.utc).isoformat(),
                metadata        = meta,
            ))

        self._log.debug("Batch classified %d texts", len(results))
        return results

    # ------------------------------------------------------------------
    # STT INTEGRATION
    # ------------------------------------------------------------------

    def classify_from_stt(
        self,
        stt_output: dict[str, Any],
    ) -> ClassificationResult:
        """
        Classifies intent from a Speech-to-Text output dict.

        Accepts the output schema produced by speech_to_text.transcriber:
            {
                "text":     "transcribed text",
                "language": "hi",          # optional
                "segments": [...],         # optional
                "confidence": 0.95,        # optional STT confidence
            }

        The STT language code and confidence are forwarded as metadata
        so downstream consumers (Knowledge Router) can use them.

        Args:
            stt_output: Dict from transcriber.TranscriptionResult.to_dict()
                        or any dict with at least a "text" key.

        Returns:
            ClassificationResult with stt_language and stt_confidence in metadata.
        """
        text = str(stt_output.get("text") or "").strip()
        meta = {
            "stt_language":   stt_output.get("language", ""),
            "stt_confidence": stt_output.get("confidence", None),
            "source":         "stt",
        }
        return self.classify(text, metadata=meta)

    # ------------------------------------------------------------------
    # CONFIGURATION
    # ------------------------------------------------------------------

    @property
    def confidence_threshold(self) -> float:
        return self._threshold

    @confidence_threshold.setter
    def confidence_threshold(self, value: float) -> None:
        if not 0.0 <= value <= 1.0:
            raise ValueError(f"confidence_threshold must be in [0, 1], got {value}")
        self._threshold = value
        self._log.info("Confidence threshold updated to %.4f", value)

    @property
    def top_n(self) -> int:
        return self._top_n

    @top_n.setter
    def top_n(self, value: int) -> None:
        if value < 1:
            raise ValueError(f"top_n must be >= 1, got {value}")
        self._top_n = value

    def get_model_metadata(self) -> dict:
        """Returns the training metadata dict from the loaded model."""
        self._ensure_loaded()
        return dict(self._artefacts.metadata)  # type: ignore[union-attr]

    def get_supported_intents(self) -> list[str]:
        """Returns the list of intent labels the model was trained on."""
        self._ensure_loaded()
        meta = self._artefacts.metadata  # type: ignore[union-attr]
        return list(meta.get("classes", self._cfg.intent_labels))

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _ensure_loaded(self) -> None:
        if self._artefacts is None:
            self.load()

    def _unknown_result(
        self,
        raw_text:      str,
        norm_text:     str,
        language_hint: str,
        metadata:      Optional[dict[str, Any]],
    ) -> ClassificationResult:
        return ClassificationResult(
            text            = norm_text,
            raw_text        = raw_text,
            intent          = UNKNOWN_INTENT,
            confidence      = 0.0,
            is_unknown      = True,
            top_predictions = [],
            language_hint   = language_hint,
            timestamp       = datetime.now(timezone.utc).isoformat(),
            metadata        = metadata or {},
        )


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_classifier_instance: Optional[IntentClassifier] = None


def get_classifier(
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    top_n:                int   = DEFAULT_TOP_N,
    force_rebuild:        bool  = False,
) -> IntentClassifier:
    """
    Returns the module-level singleton IntentClassifier.
    Loads model artefacts on first call.

    Args:
        confidence_threshold: Minimum confidence to accept a prediction.
        top_n:                Number of top predictions to include.
        force_rebuild:        Create a fresh instance (useful in tests).

    Returns:
        IntentClassifier: Ready-to-use, model loaded.
    """
    global _classifier_instance
    if _classifier_instance is None or force_rebuild:
        _classifier_instance = IntentClassifier(
            confidence_threshold=confidence_threshold,
            top_n=top_n,
        )
    return _classifier_instance
