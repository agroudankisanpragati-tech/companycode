# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/predictor.py
# Purpose: High-level prediction API for the Intent Engine.
#   - Auto-loads trained model on first call
#   - predict()       — single text → PredictionResult
#   - predict_batch() — list of texts → list[PredictionResult]
#   - predict_from_stt() — STT output dict → PredictionResult
#   - Knowledge Router–ready output (to_router_payload())
#   - Configurable confidence threshold via env var IE_CONFIDENCE_THRESHOLD
#   - Rotating file + console logging
#   - CLI: python -m intent_engine.predictor
# =============================================================================

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

# Ensure Ai/ is on sys.path when run as __main__ or via -m
_AI_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from intent_engine.config import IntentEngineConfig, get_config
from intent_engine.intent_alias_resolver import resolve_alias
from intent_engine.intent_classifier import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_TOP_N,
    ClassificationResult,
    IntentClassifier,
    get_classifier,
)


# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: IntentEngineConfig) -> logging.Logger:
    logger = logging.getLogger("akp.intent.predictor")
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

    log_file = cfg.logs_dir / "predictor.log"
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
# PREDICTION RESULT
# ---------------------------------------------------------------------------

@dataclass
class PredictionResult:
    """
    Final output of the Predictor.

    Attributes:
        intent:          Top predicted intent label (or "unknown").
        confidence:      Probability of the top intent (0.0 – 1.0).
        is_unknown:      True when confidence < threshold.
        top_predictions: List of {"intent": str, "confidence": float} dicts.
        text:            Normalised input text.
        raw_text:        Original un-normalised input.
        language_hint:   Detected script: "latin" | "devanagari" | "mixed".
        timestamp:       UTC ISO-8601 prediction timestamp.
        model_version:   "trained_at" field from model metadata.
        metadata:        Pass-through metadata (session_id, stt data, etc.).
    """
    intent:          str
    confidence:      float
    is_unknown:      bool
    top_predictions: list[dict[str, Any]]
    text:            str
    raw_text:        str
    language_hint:   str
    timestamp:       str
    model_version:   str
    metadata:        dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Returns a JSON-serialisable dict."""
        return {
            "intent":          self.intent,
            "confidence":      self.confidence,
            "is_unknown":      self.is_unknown,
            "top_predictions": self.top_predictions,
            "text":            self.text,
            "raw_text":        self.raw_text,
            "language_hint":   self.language_hint,
            "timestamp":       self.timestamp,
            "model_version":   self.model_version,
            "metadata":        self.metadata,
        }

    def to_router_payload(self) -> dict[str, Any]:
        """
        Returns a minimal payload for the Knowledge Router.

        Schema:
            {
                "intent":      str,
                "confidence":  float,
                "is_unknown":  bool,
                "text":        str,
                "language":    str,
                "timestamp":   str,
                "top":         [{"intent": str, "confidence": float}, ...]
            }
        """
        return {
            "intent":     self.intent,
            "confidence": self.confidence,
            "is_unknown": self.is_unknown,
            "text":       self.text,
            "language":   self.language_hint,
            "timestamp":  self.timestamp,
            "top":        self.top_predictions,
        }


# ---------------------------------------------------------------------------
# PREDICTOR
# ---------------------------------------------------------------------------

class Predictor:
    """
    High-level intent prediction API.

    Automatically loads the trained model on first prediction call.
    Wraps IntentClassifier and converts ClassificationResult →
    PredictionResult with model version and router-ready payload.

    Usage:
        predictor = Predictor()

        # Single prediction
        result = predictor.predict("मेरी फसल में बीमारी है")
        print(result.intent, result.confidence)

        # Batch prediction
        results = predictor.predict_batch(["crop disease", "weather today"])

        # From STT output
        result = predictor.predict_from_stt({"text": "...", "language": "hi"})

        # Knowledge Router payload
        payload = result.to_router_payload()
    """

    def __init__(
        self,
        cfg:                  Optional[IntentEngineConfig] = None,
        confidence_threshold: Optional[float]              = None,
        top_n:                int                          = DEFAULT_TOP_N,
    ) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)

        # Env var override: IE_CONFIDENCE_THRESHOLD
        if confidence_threshold is None:
            confidence_threshold = float(
                os.getenv("IE_CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE_THRESHOLD)
            )

        self._classifier = IntentClassifier(
            cfg=self._cfg,
            confidence_threshold=confidence_threshold,
            top_n=top_n,
        )
        self._model_version: str = ""

    # ------------------------------------------------------------------
    # MODEL LOADING
    # ------------------------------------------------------------------

    def load(self) -> "Predictor":
        """
        Pre-warms the classifier by loading model artefacts from disk.
        Called automatically on first predict() call.

        Returns:
            self — for chaining: predictor = Predictor().load()

        Raises:
            FileNotFoundError: If model artefacts are missing.
        """
        self._classifier.load()
        self._model_version = (
            self._classifier.get_model_metadata().get("trained_at", "unknown")
        )
        self._log.info("Predictor ready — model_version=%s", self._model_version)
        return self

    def is_ready(self) -> bool:
        """Returns True if the model is loaded and ready."""
        return self._classifier.is_loaded()

    # ------------------------------------------------------------------
    # SINGLE PREDICTION
    # ------------------------------------------------------------------

    def predict(
        self,
        text:     str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> PredictionResult:
        """
        Predicts the intent of a single text string.

        Args:
            text:     Raw input text (Hindi, English, or mixed).
            metadata: Optional dict forwarded to PredictionResult.metadata.

        Returns:
            PredictionResult
        """
        # ── Alias resolver: runs BEFORE ML model ─────────────────────
        alias_intent = resolve_alias(text)
        if alias_intent:
            self._log.info(
                "predict | intent=%-15s conf=1.0000 lang=alias       text='%s' [ALIAS]",
                alias_intent, text[:60],
            )
            return self._alias_result(text, alias_intent, metadata)

        self._ensure_loaded()
        clf_result = self._classifier.classify(text, metadata=metadata)
        result = self._to_prediction_result(clf_result)
        self._log.info(
            "predict | intent=%-15s conf=%.4f lang=%-11s text='%s'",
            result.intent,
            result.confidence,
            result.language_hint,
            result.text[:60],
        )
        return result

    # ------------------------------------------------------------------
    # BATCH PREDICTION
    # ------------------------------------------------------------------

    def predict_batch(
        self,
        texts:    list[str],
        metadata: Optional[list[dict[str, Any]]] = None,
    ) -> list[PredictionResult]:
        """
        Predicts intents for a list of text strings in a single pass.

        Args:
            texts:    List of raw input strings.
            metadata: Optional list of metadata dicts, one per text.

        Returns:
            List of PredictionResult, one per input text.
        """
        self._ensure_loaded()

        if not texts:
            return []

        meta_list  = metadata or []
        results: list[PredictionResult] = []
        ml_indices: list[int] = []
        ml_texts:   list[str] = []
        ml_metas:   list[dict[str, Any]] = []

        # Alias-resolve what we can; queue the rest for ML
        for i, t in enumerate(texts):
            meta = meta_list[i] if i < len(meta_list) else {}
            alias_intent = resolve_alias(t)
            if alias_intent:
                results.append(self._alias_result(t, alias_intent, meta))
            else:
                results.append(None)  # type: ignore[arg-type]
                ml_indices.append(i)
                ml_texts.append(t)
                ml_metas.append(meta)

        if ml_texts:
            clf_results = self._classifier.classify_batch(ml_texts, metadata=ml_metas)
            for idx, clf in zip(ml_indices, clf_results):
                results[idx] = self._to_prediction_result(clf)

        unknown_count = sum(1 for r in results if r.is_unknown)
        self._log.info(
            "predict_batch | count=%d  unknown=%d",
            len(results), unknown_count,
        )
        return results

    # ------------------------------------------------------------------
    # STT INTEGRATION
    # ------------------------------------------------------------------

    def predict_from_stt(
        self,
        stt_output: dict[str, Any],
    ) -> PredictionResult:
        """
        Predicts intent from a Speech-to-Text output dict.

        Accepts the schema produced by speech_to_text.transcriber:
            {
                "text":       "transcribed text",
                "language":   "hi",        # optional
                "confidence": 0.95,        # optional STT confidence
                "segments":   [...],       # optional, ignored
            }

        STT language and confidence are forwarded in PredictionResult.metadata.

        Args:
            stt_output: Dict with at least a "text" key.

        Returns:
            PredictionResult
        """
        text = str(stt_output.get("text") or "").strip()
        alias_intent = resolve_alias(text)
        if alias_intent:
            meta = {
                "stt_language":   stt_output.get("language", ""),
                "stt_confidence": stt_output.get("confidence", None),
                "source":         "stt",
            }
            self._log.info(
                "predict_from_stt | intent=%-15s conf=1.0000 [ALIAS] stt_lang=%s",
                alias_intent, meta["stt_language"],
            )
            return self._alias_result(text, alias_intent, meta)

        self._ensure_loaded()
        clf_result = self._classifier.classify_from_stt(stt_output)
        result     = self._to_prediction_result(clf_result)
        self._log.info(
            "predict_from_stt | intent=%-15s conf=%.4f stt_lang=%s",
            result.intent,
            result.confidence,
            result.metadata.get("stt_language", "?"),
        )
        return result

    # ------------------------------------------------------------------
    # CONFIGURATION
    # ------------------------------------------------------------------

    @property
    def confidence_threshold(self) -> float:
        return self._classifier.confidence_threshold

    @confidence_threshold.setter
    def confidence_threshold(self, value: float) -> None:
        self._classifier.confidence_threshold = value

    def get_supported_intents(self) -> list[str]:
        """Returns the list of intent labels the model was trained on."""
        self._ensure_loaded()
        return self._classifier.get_supported_intents()

    def get_model_info(self) -> dict[str, Any]:
        """
        Returns a summary of the loaded model.

        Returns:
            Dict with model_type, num_classes, classes, trained_at,
            train_size, test_accuracy, confidence_threshold.
        """
        self._ensure_loaded()
        meta = self._classifier.get_model_metadata()
        test_acc = (
            meta.get("test_metrics", {}).get("accuracy")
            or meta.get("val_metrics", {}).get("accuracy")
        )
        return {
            "model_type":           meta.get("model_type", "?"),
            "num_classes":          meta.get("num_classes", 0),
            "classes":              meta.get("classes", []),
            "trained_at":           meta.get("trained_at", "?"),
            "train_size":           meta.get("train_size", 0),
            "test_accuracy":        test_acc,
            "confidence_threshold": self.confidence_threshold,
        }

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _ensure_loaded(self) -> None:
        if not self._classifier.is_loaded():
            self.load()

    def _to_prediction_result(self, clf: ClassificationResult) -> PredictionResult:
        return PredictionResult(
            intent          = clf.intent,
            confidence      = clf.confidence,
            is_unknown      = clf.is_unknown,
            top_predictions = [
                {"intent": i, "confidence": c} for i, c in clf.top_predictions
            ],
            text            = clf.text,
            raw_text        = clf.raw_text,
            language_hint   = clf.language_hint,
            timestamp       = clf.timestamp,
            model_version   = self._model_version,
            metadata        = clf.metadata,
        )

    def _alias_result(self, raw_text: str, intent: str, metadata: Optional[dict[str, Any]]) -> PredictionResult:
        from datetime import datetime, timezone
        from intent_engine.intent_classifier import normalise_text, _detect_script
        norm = normalise_text(raw_text)
        return PredictionResult(
            intent          = intent,
            confidence      = 1.0,
            is_unknown      = False,
            top_predictions = [{"intent": intent, "confidence": 1.0}],
            text            = norm,
            raw_text        = raw_text,
            language_hint   = _detect_script(raw_text),
            timestamp       = datetime.now(timezone.utc).isoformat(),
            model_version   = self._model_version or "alias",
            metadata        = metadata or {},
        )


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_predictor_instance: Optional[Predictor] = None


def get_predictor(
    confidence_threshold: Optional[float] = None,
    top_n:                int              = DEFAULT_TOP_N,
    force_rebuild:        bool             = False,
) -> Predictor:
    """
    Returns the module-level singleton Predictor.
    Loads model artefacts on first call.

    Args:
        confidence_threshold: Minimum confidence to accept a prediction.
                              Defaults to IE_CONFIDENCE_THRESHOLD env var or 0.30.
        top_n:                Number of top predictions to include.
        force_rebuild:        Create a fresh instance (useful in tests).

    Returns:
        Predictor: Ready-to-use, model loaded.

    Usage:
        from intent_engine.predictor import get_predictor
        predictor = get_predictor()
        result = predictor.predict("मेरी फसल में बीमारी है")
    """
    global _predictor_instance
    if _predictor_instance is None or force_rebuild:
        _predictor_instance = Predictor(
            confidence_threshold=confidence_threshold,
            top_n=top_n,
        )
    return _predictor_instance


# ---------------------------------------------------------------------------
# CONVENIENCE FUNCTION
# ---------------------------------------------------------------------------

def predict_intent(
    text:                 str,
    confidence_threshold: Optional[float]       = None,
    metadata:             Optional[dict[str, Any]] = None,
) -> PredictionResult:
    """
    One-call intent prediction.

    Args:
        text:                 Raw input text.
        confidence_threshold: Optional threshold override.
        metadata:             Optional metadata dict.

    Returns:
        PredictionResult

    Usage:
        from intent_engine.predictor import predict_intent
        result = predict_intent("what is the weather today?")
        print(result.intent, result.confidence)
    """
    predictor = get_predictor(confidence_threshold=confidence_threshold)
    return predictor.predict(text, metadata=metadata)


# ---------------------------------------------------------------------------
# CLI ENTRY POINT
# ---------------------------------------------------------------------------

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m intent_engine.predictor",
        description="AKP Intent Engine — Predict intent from text",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # --- predict ---
    p_predict = subparsers.add_parser("predict", help="Predict intent for one text")
    p_predict.add_argument("text", help="Input text to classify")
    p_predict.add_argument(
        "--threshold", "-t",
        type=float,
        default=None,
        help="Confidence threshold (default: 0.30 or IE_CONFIDENCE_THRESHOLD)",
    )
    p_predict.add_argument(
        "--top-n", "-n",
        type=int,
        default=DEFAULT_TOP_N,
        dest="top_n",
        help=f"Number of top predictions to show (default: {DEFAULT_TOP_N})",
    )
    p_predict.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output full result as JSON",
    )

    # --- batch ---
    p_batch = subparsers.add_parser("batch", help="Predict intents for texts in a file")
    p_batch.add_argument(
        "input_file",
        help="Path to a .txt file with one text per line",
    )
    p_batch.add_argument(
        "--output", "-o",
        default=None,
        dest="output_file",
        help="Path to write JSON results (default: stdout)",
    )
    p_batch.add_argument(
        "--threshold", "-t",
        type=float,
        default=None,
    )
    p_batch.add_argument(
        "--top-n", "-n",
        type=int,
        default=DEFAULT_TOP_N,
        dest="top_n",
    )

    # --- info ---
    subparsers.add_parser("info", help="Show loaded model information")

    args = parser.parse_args()

    # Default command: show help
    if args.command is None:
        parser.print_help()
        sys.exit(0)

    # ---- info ----
    if args.command == "info":
        predictor = Predictor(confidence_threshold=args.threshold if hasattr(args, "threshold") else None)
        predictor.load()
        info = predictor.get_model_info()
        print("\n" + "=" * 60)
        print("  AKP Intent Engine — Model Info")
        print("=" * 60)
        for k, v in info.items():
            if k == "classes":
                print(f"\n  Supported intents ({len(v)}):")
                for cls in v:
                    print(f"    • {cls}")
            else:
                print(f"  {k:<25}: {v}")
        print("\n" + "=" * 60 + "\n")
        return

    # ---- predict ----
    if args.command == "predict":
        predictor = Predictor(
            confidence_threshold=args.threshold,
            top_n=args.top_n,
        )
        result = predictor.predict(args.text)

        if args.as_json:
            print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
            return

        print("\n" + "=" * 60)
        print("  AKP Intent Engine — Prediction Result")
        print("=" * 60)
        print(f"\n  Input text     : {result.raw_text}")
        print(f"  Normalised     : {result.text}")
        print(f"  Language hint  : {result.language_hint}")
        print(f"\n  Intent         : {result.intent}")
        print(f"  Confidence     : {result.confidence:.4f}")
        print(f"  Unknown        : {result.is_unknown}")
        print(f"\n  Top predictions:")
        for pred in result.top_predictions:
            marker = "→" if pred["intent"] == result.intent else " "
            print(f"    {marker} {pred['intent']:<15} {pred['confidence']:.4f}")
        print(f"\n  Model version  : {result.model_version}")
        print(f"  Timestamp      : {result.timestamp}")
        print("\n" + "=" * 60 + "\n")
        return

    # ---- batch ----
    if args.command == "batch":
        input_path = Path(args.input_file)
        if not input_path.exists():
            print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
            sys.exit(1)

        lines = [
            line.strip()
            for line in input_path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]

        if not lines:
            print("ERROR: No valid lines found in input file.", file=sys.stderr)
            sys.exit(1)

        predictor = Predictor(
            confidence_threshold=args.threshold,
            top_n=args.top_n,
        )
        results = predictor.predict_batch(lines)
        payload = [r.to_dict() for r in results]

        if args.output_file:
            out_path = Path(args.output_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"Results written to: {out_path}")
        else:
            print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _cli()
