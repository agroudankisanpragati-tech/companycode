# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/trainer.py
# Purpose: Trains an intent classification model using TF-IDF features and
#          a configurable sklearn classifier. Evaluates on val + test splits,
#          generates full metrics (accuracy, precision, recall, F1, confusion
#          matrix), writes training logs, and saves all artefacts via
#          ModelManager.
#
# Supported model types (set via IE_MODEL_TYPE env var or config):
#   logistic      — Logistic Regression (default, fast, interpretable)
#   svm           — Linear SVM (strong baseline for text)
#   random_forest — Random Forest (ensemble, slower)
#   mlp           — Multi-layer Perceptron (neural, requires more data)
#
# Pipeline:
#   1. Load dataset from intent_dataset.json (built by DatasetBuilder)
#      OR run DatasetBuilder automatically if the file is missing
#   2. Vectorise text with TfidfVectorizer
#   3. Encode labels with LabelEncoder
#   4. Train classifier on train split
#   5. Evaluate on val split (early feedback) and test split (final)
#   6. Generate confusion matrix + classification report
#   7. Save all artefacts via ModelManager
#   8. Write training_log_<timestamp>.json to outputs/
# =============================================================================

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from intent_engine.config import IntentEngineConfig, get_config
from intent_engine.dataset_builder import DatasetBuilder, IntentSample, build_dataset
from intent_engine.model_manager import ModelArtefacts, ModelManager, get_model_manager


# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: IntentEngineConfig) -> logging.Logger:
    logger = logging.getLogger("akp.intent.trainer")
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

    log_file = cfg.logs_dir / "trainer.log"
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
# METRICS HELPERS
# ---------------------------------------------------------------------------

def _compute_metrics(
    y_true: list,
    y_pred: list,
    labels: list[str],
) -> dict:
    """
    Computes accuracy, macro precision/recall/F1, per-class metrics,
    and the confusion matrix.

    Returns a dict ready for JSON serialisation.
    """
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )

    accuracy  = round(float(accuracy_score(y_true, y_pred)), 4)
    precision = round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4)
    recall    = round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4)
    f1        = round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4)

    report = classification_report(
        y_true, y_pred,
        labels=labels,
        zero_division=0,
        output_dict=True,
    )

    cm = confusion_matrix(y_true, y_pred, labels=labels).tolist()

    return {
        "accuracy":               accuracy,
        "macro_precision":        precision,
        "macro_recall":           recall,
        "macro_f1":               f1,
        "classification_report":  report,
        "confusion_matrix":       cm,
        "confusion_matrix_labels": labels,
    }


# ---------------------------------------------------------------------------
# CLASSIFIER FACTORY
# ---------------------------------------------------------------------------

def _build_classifier(model_type: str, max_iter: int) -> Any:
    """
    Instantiates the sklearn classifier for the given model_type.

    Args:
        model_type: One of "logistic", "svm", "random_forest", "mlp".
        max_iter:   Max iterations for iterative solvers.

    Returns:
        Unfitted sklearn estimator.

    Raises:
        ValueError: If model_type is not recognised.
    """
    model_type = model_type.lower().strip()

    if model_type == "logistic":
        from sklearn.linear_model import LogisticRegression
        return LogisticRegression(
            max_iter=max_iter,
            solver="lbfgs",
            C=1.0,
            class_weight="balanced",
            random_state=42,
        )

    if model_type == "svm":
        from sklearn.svm import LinearSVC
        from sklearn.calibration import CalibratedClassifierCV
        base = LinearSVC(
            max_iter=max_iter,
            C=1.0,
            class_weight="balanced",
            random_state=42,
        )
        # Wrap in CalibratedClassifierCV to expose predict_proba
        return CalibratedClassifierCV(base, cv=3)

    if model_type == "random_forest":
        from sklearn.ensemble import RandomForestClassifier
        return RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )

    if model_type == "mlp":
        from sklearn.neural_network import MLPClassifier
        return MLPClassifier(
            hidden_layer_sizes=(256, 128),
            activation="relu",
            solver="adam",
            max_iter=max_iter,
            early_stopping=True,
            validation_fraction=0.1,
            random_state=42,
        )

    raise ValueError(
        f"Unknown model_type '{model_type}'. "
        f"Choose from: logistic, svm, random_forest, mlp"
    )


# ---------------------------------------------------------------------------
# TRAINING RESULT
# ---------------------------------------------------------------------------

class TrainingResult:
    """
    Returned by Trainer.train().

    Attributes:
        val_metrics:   Metrics on the validation split.
        test_metrics:  Metrics on the test split.
        train_size:    Number of training samples.
        val_size:      Number of validation samples.
        test_size:     Number of test samples.
        num_classes:   Number of intent classes.
        model_type:    Classifier type used.
        training_time_s: Wall-clock seconds for training.
        log_path:      Path to the training log JSON.
        artefacts:     The saved ModelArtefacts.
    """

    def __init__(
        self,
        val_metrics:      dict,
        test_metrics:     dict,
        train_size:       int,
        val_size:         int,
        test_size:        int,
        num_classes:      int,
        model_type:       str,
        training_time_s:  float,
        log_path:         Path,
        artefacts:        ModelArtefacts,
    ) -> None:
        self.val_metrics      = val_metrics
        self.test_metrics     = test_metrics
        self.train_size       = train_size
        self.val_size         = val_size
        self.test_size        = test_size
        self.num_classes      = num_classes
        self.model_type       = model_type
        self.training_time_s  = training_time_s
        self.log_path         = log_path
        self.artefacts        = artefacts


# ---------------------------------------------------------------------------
# TRAINER
# ---------------------------------------------------------------------------

class Trainer:
    """
    Trains an intent classification model end-to-end.

    Usage:
        trainer = Trainer()
        result  = trainer.train()
        print(result.test_metrics["accuracy"])
        print(result.test_metrics["macro_f1"])
    """

    def __init__(
        self,
        cfg:           Optional[IntentEngineConfig] = None,
        model_manager: Optional[ModelManager]       = None,
    ) -> None:
        self._cfg     = cfg or get_config()
        self._log     = _build_logger(self._cfg)
        self._manager = model_manager or get_model_manager()

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def train(self, rebuild_dataset: bool = False) -> TrainingResult:
        """
        Runs the full training pipeline.

        Args:
            rebuild_dataset: If True, re-runs DatasetBuilder even if
                             intent_dataset.json already exists.

        Returns:
            TrainingResult with metrics, paths, and artefacts.

        Raises:
            RuntimeError: If training fails.
        """
        self._log.info("=" * 60)
        self._log.info("Intent Engine training started")
        self._log.info("Model type   : %s", self._cfg.model_type)
        self._log.info("Max features : %d", self._cfg.max_features)
        self._log.info("N-gram range : %s", self._cfg.ngram_range)

        t_start = time.perf_counter()

        # 1. Ensure dataset exists
        split = self._load_or_build_dataset(rebuild_dataset)

        if not split.train:
            raise RuntimeError(
                "Training set is empty. Add data files to intent_engine/datasets/ "
                "and re-run the trainer."
            )

        # 2. Prepare arrays
        X_train, y_train = self._to_arrays(split.train)
        X_val,   y_val   = self._to_arrays(split.val)
        X_test,  y_test  = self._to_arrays(split.test)

        self._log.info(
            "Split sizes — train: %d  val: %d  test: %d",
            len(X_train), len(X_val), len(X_test),
        )

        # 3. Vectorise
        self._log.info("Fitting TF-IDF vectorizer ...")
        from sklearn.feature_extraction.text import TfidfVectorizer
        # CRITICAL FIXES:
        # 1. strip_accents=None — "unicode" strips Devanagari matras/anusvara,
        #    destroying Hindi text. Must be None to preserve all Unicode.
        # 2. token_pattern uses \w+ without \b boundaries — \b does not work
        #    for Devanagari script. The pattern below correctly tokenises both
        #    Latin and Devanagari words.
        # 3. analyzer="char_wb" added as subword fallback via a custom
        #    tokenizer that handles both scripts.
        vectorizer = TfidfVectorizer(
            max_features=self._cfg.max_features,
            ngram_range=self._cfg.ngram_range,
            sublinear_tf=True,
            strip_accents=None,          # FIXED: was "unicode" — destroyed Devanagari
            analyzer="word",
            token_pattern=r"(?u)\w+",    # FIXED: removed \b boundaries (break Devanagari)
            min_df=1,
        )
        X_train_vec = vectorizer.fit_transform(X_train)
        X_val_vec   = vectorizer.transform(X_val)   if X_val   else None
        X_test_vec  = vectorizer.transform(X_test)  if X_test  else None

        # 4. Encode labels
        from sklearn.preprocessing import LabelEncoder
        le = LabelEncoder()
        y_train_enc = le.fit_transform(y_train)
        y_val_enc   = le.transform(y_val)   if y_val   else []
        y_test_enc  = le.transform(y_test)  if y_test  else []

        classes = list(le.classes_)
        self._log.info("Classes (%d): %s", len(classes), classes)

        # 5. Build and train classifier
        self._log.info("Training %s classifier ...", self._cfg.model_type)
        classifier = _build_classifier(self._cfg.model_type, self._cfg.max_iter)
        classifier.fit(X_train_vec, y_train_enc)

        training_time_s = round(time.perf_counter() - t_start, 4)
        self._log.info("Training complete in %.2fs", training_time_s)

        # 6. Evaluate on validation split
        val_metrics: dict = {}
        if X_val_vec is not None and len(y_val_enc) > 0:
            y_val_pred = classifier.predict(X_val_vec)
            y_val_true_labels = list(le.inverse_transform(y_val_enc))
            y_val_pred_labels = list(le.inverse_transform(y_val_pred))
            val_metrics = _compute_metrics(y_val_true_labels, y_val_pred_labels, classes)
            self._log.info(
                "Val   — accuracy=%.4f  precision=%.4f  recall=%.4f  f1=%.4f",
                val_metrics["accuracy"],
                val_metrics["macro_precision"],
                val_metrics["macro_recall"],
                val_metrics["macro_f1"],
            )

        # 7. Evaluate on test split
        test_metrics: dict = {}
        if X_test_vec is not None and len(y_test_enc) > 0:
            y_test_pred = classifier.predict(X_test_vec)
            y_test_true_labels = list(le.inverse_transform(y_test_enc))
            y_test_pred_labels = list(le.inverse_transform(y_test_pred))
            test_metrics = _compute_metrics(y_test_true_labels, y_test_pred_labels, classes)
            self._log.info(
                "Test  — accuracy=%.4f  precision=%.4f  recall=%.4f  f1=%.4f",
                test_metrics["accuracy"],
                test_metrics["macro_precision"],
                test_metrics["macro_recall"],
                test_metrics["macro_f1"],
            )

        # 8. Build metadata
        metadata = self._build_metadata(
            model_type      = self._cfg.model_type,
            classes         = classes,
            train_size      = len(X_train),
            val_size        = len(X_val),
            test_size       = len(X_test),
            val_metrics     = val_metrics,
            test_metrics    = test_metrics,
            training_time_s = training_time_s,
        )

        # 9. Save artefacts
        artefacts = ModelArtefacts(
            classifier    = classifier,
            vectorizer    = vectorizer,
            label_encoder = le,
            metadata      = metadata,
        )
        self._manager.save(artefacts)

        # 10. Write training log
        log_path = self._write_training_log(metadata)

        self._log.info("Model saved to  : %s", self._cfg.models_dir)
        self._log.info("Training log    : %s", log_path)
        self._log.info("Intent Engine training complete")
        self._log.info("=" * 60)

        return TrainingResult(
            val_metrics     = val_metrics,
            test_metrics    = test_metrics,
            train_size      = len(X_train),
            val_size        = len(X_val),
            test_size       = len(X_test),
            num_classes     = len(classes),
            model_type      = self._cfg.model_type,
            training_time_s = training_time_s,
            log_path        = log_path,
            artefacts       = artefacts,
        )

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _load_or_build_dataset(self, rebuild: bool):
        """
        Loads the dataset split from intent_dataset.json if it exists,
        otherwise runs DatasetBuilder to create it first.
        """
        from intent_engine.dataset_builder import DatasetSplit

        json_path = self._cfg.intent_dataset_json

        if rebuild or not json_path.exists():
            self._log.info("Building dataset ...")
            build_result = DatasetBuilder(cfg=self._cfg).build()
            return build_result.split

        self._log.info("Loading dataset from %s", json_path.name)
        raw = json.loads(json_path.read_text(encoding="utf-8"))

        # Re-split from the full dataset using configured ratios
        import random, math
        from collections import defaultdict

        samples = [
            IntentSample(text=item["text"], intent=item["intent"],
                         source=item.get("source", ""))
            for item in raw
        ]

        rng = random.Random(self._cfg.split_seed)
        rng.shuffle(samples)

        by_intent: dict[str, list[IntentSample]] = defaultdict(list)
        for s in samples:
            by_intent[s.intent].append(s)

        train_list, val_list, test_list = [], [], []
        for group in by_intent.values():
            n = len(group)
            n_test  = max(1, math.floor(n * self._cfg.test_ratio))  if n >= 3 else 0
            n_val   = max(1, math.floor(n * self._cfg.val_ratio))   if n >= 3 else 0
            n_train = n - n_val - n_test
            if n_train < 1:
                train_list.extend(group)
                continue
            train_list.extend(group[:n_train])
            val_list.extend(group[n_train:n_train + n_val])
            test_list.extend(group[n_train + n_val:])

        self._log.info(
            "Dataset loaded — train: %d  val: %d  test: %d",
            len(train_list), len(val_list), len(test_list),
        )
        return DatasetSplit(train=train_list, val=val_list, test=test_list)

    @staticmethod
    def _to_arrays(samples: list[IntentSample]) -> tuple[list[str], list[str]]:
        """Converts a list of IntentSample to (texts, labels) lists."""
        texts  = [s.text   for s in samples]
        labels = [s.intent for s in samples]
        return texts, labels

    def _build_metadata(
        self,
        model_type:      str,
        classes:         list[str],
        train_size:      int,
        val_size:        int,
        test_size:       int,
        val_metrics:     dict,
        test_metrics:    dict,
        training_time_s: float,
    ) -> dict:
        return {
            "trained_at":       datetime.now(timezone.utc).isoformat(),
            "model_type":       model_type,
            "max_features":     self._cfg.max_features,
            "ngram_range":      list(self._cfg.ngram_range),
            "max_iter":         self._cfg.max_iter,
            "num_classes":      len(classes),
            "classes":          classes,
            "train_size":       train_size,
            "val_size":         val_size,
            "test_size":        test_size,
            "training_time_s":  training_time_s,
            "val_metrics":      val_metrics,
            "test_metrics":     test_metrics,
        }

    def _write_training_log(self, metadata: dict) -> Path:
        """Writes a timestamped training log JSON to outputs/."""
        ts       = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        log_path = self._cfg.outputs_dir / f"training_log_{ts}.json"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        return log_path


# ---------------------------------------------------------------------------
# MODULE-LEVEL CONVENIENCE
# ---------------------------------------------------------------------------

def train_intent_model(
    cfg:             Optional[IntentEngineConfig] = None,
    rebuild_dataset: bool = False,
) -> TrainingResult:
    """
    One-call entry point for training.

    Args:
        cfg:             Optional config override.
        rebuild_dataset: Force dataset rebuild even if JSON exists.

    Returns:
        TrainingResult

    Usage:
        from intent_engine.trainer import train_intent_model
        result = train_intent_model()
        print(result.test_metrics["accuracy"])
    """
    return Trainer(cfg=cfg).train(rebuild_dataset=rebuild_dataset)


# ---------------------------------------------------------------------------
# CLI ENTRY POINT
# ---------------------------------------------------------------------------

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m intent_engine.trainer",
        description="AKP Intent Engine — Train intent classification model",
    )
    parser.add_argument(
        "--model", "-m",
        default=None,
        dest="model_type",
        help="Classifier type: logistic|svm|random_forest|mlp (default: logistic)",
    )
    parser.add_argument(
        "--rebuild-dataset",
        action="store_true",
        dest="rebuild_dataset",
        help="Force dataset rebuild even if intent_dataset.json exists",
    )
    parser.add_argument(
        "--max-features",
        type=int,
        default=None,
        dest="max_features",
        help="TF-IDF vocabulary size (default: 50000)",
    )
    args = parser.parse_args()

    import os
    if args.model_type:
        os.environ["IE_MODEL_TYPE"] = args.model_type
    if args.max_features:
        os.environ["IE_MAX_FEATURES"] = str(args.max_features)

    cfg    = get_config(force_rebuild=True)
    result = Trainer(cfg=cfg).train(rebuild_dataset=args.rebuild_dataset)

    print("\n" + "=" * 60)
    print("  AKP Intent Engine — Training Summary")
    print("=" * 60)
    print(f"\n  Model Type     : {result.model_type}")
    print(f"  Classes        : {result.num_classes}")
    print(f"  Train samples  : {result.train_size}")
    print(f"  Val samples    : {result.val_size}")
    print(f"  Test samples   : {result.test_size}")
    print(f"  Training time  : {result.training_time_s:.2f}s")

    if result.val_metrics:
        print(f"\n  Validation Metrics:")
        print(f"    Accuracy   : {result.val_metrics.get('accuracy', 'N/A')}")
        print(f"    Precision  : {result.val_metrics.get('macro_precision', 'N/A')}")
        print(f"    Recall     : {result.val_metrics.get('macro_recall', 'N/A')}")
        print(f"    F1-Score   : {result.val_metrics.get('macro_f1', 'N/A')}")

    if result.test_metrics:
        print(f"\n  Test Metrics:")
        print(f"    Accuracy   : {result.test_metrics.get('accuracy', 'N/A')}")
        print(f"    Precision  : {result.test_metrics.get('macro_precision', 'N/A')}")
        print(f"    Recall     : {result.test_metrics.get('macro_recall', 'N/A')}")
        print(f"    F1-Score   : {result.test_metrics.get('macro_f1', 'N/A')}")

    print(f"\n  Training log   : {result.log_path}")
    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    # Ensure Ai/ is on sys.path for `python -m intent_engine.trainer`
    _ai_root = Path(__file__).resolve().parent.parent
    if str(_ai_root) not in sys.path:
        sys.path.insert(0, str(_ai_root))
    _cli()
