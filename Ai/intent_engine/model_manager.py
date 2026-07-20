# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/model_manager.py
# Purpose: Saves, loads, and manages the trained intent classifier,
#          TF-IDF vectorizer, label encoder, and model metadata.
#          All artefacts are stored under intent_engine/models/.
# =============================================================================

from __future__ import annotations

import json
import logging
import pickle
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

from intent_engine.config import IntentEngineConfig, get_config


# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: IntentEngineConfig) -> logging.Logger:
    logger = logging.getLogger("akp.intent.model_manager")
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

    log_file = cfg.logs_dir / "model_manager.log"
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
# MODEL ARTEFACT BUNDLE
# ---------------------------------------------------------------------------

class ModelArtefacts:
    """
    Container for all artefacts produced by training.

    Attributes:
        classifier:    Trained sklearn classifier.
        vectorizer:    Fitted TfidfVectorizer.
        label_encoder: Fitted LabelEncoder.
        metadata:      Dict with training metrics and config snapshot.
    """

    def __init__(
        self,
        classifier:    Any,
        vectorizer:    Any,
        label_encoder: Any,
        metadata:      dict,
    ) -> None:
        self.classifier    = classifier
        self.vectorizer    = vectorizer
        self.label_encoder = label_encoder
        self.metadata      = metadata

    def predict(self, texts: list[str]) -> list[str]:
        """
        Predicts intent labels for a list of raw text strings.

        Args:
            texts: List of raw (un-normalised) text strings.

        Returns:
            List of predicted intent label strings.
        """
        import unicodedata, re
        normalised = []
        for t in texts:
            t = unicodedata.normalize("NFC", t).lower()
            # FIXED: use \s+ collapse only — do NOT strip_accents here
            t = re.sub(r"\s+", " ", t).strip()
            normalised.append(t)

        X = self.vectorizer.transform(normalised)
        encoded = self.classifier.predict(X)
        return list(self.label_encoder.inverse_transform(encoded))

    def predict_proba(self, texts: list[str]) -> list[dict[str, float]]:
        """
        Returns per-class probabilities for each input text.

        Args:
            texts: List of raw text strings.

        Returns:
            List of {intent_label: probability} dicts, one per input.
        """
        import unicodedata, re
        normalised = []
        for t in texts:
            t = unicodedata.normalize("NFC", t).lower()
            # FIXED: use \s+ collapse only — do NOT strip_accents here
            t = re.sub(r"\s+", " ", t).strip()
            normalised.append(t)

        X = self.vectorizer.transform(normalised)
        proba_matrix = self.classifier.predict_proba(X)
        classes = list(self.label_encoder.inverse_transform(
            range(len(self.label_encoder.classes_))
        ))
        return [
            {cls: round(float(p), 4) for cls, p in zip(classes, row)}
            for row in proba_matrix
        ]


# ---------------------------------------------------------------------------
# MODEL MANAGER
# ---------------------------------------------------------------------------

class ModelManager:
    """
    Manages the lifecycle of intent classification model artefacts:
      - Save classifier, vectorizer, label encoder, and metadata to disk
      - Load artefacts from disk
      - Check whether a trained model exists
      - Delete artefacts

    Usage:
        manager = ModelManager()
        manager.save(artefacts)
        loaded = manager.load()
        labels = loaded.predict(["what is the weather today?"])
    """

    def __init__(self, cfg: Optional[IntentEngineConfig] = None) -> None:
        self._cfg = cfg or get_config()
        self._log = _build_logger(self._cfg)
        self._cfg.models_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def save(self, artefacts: ModelArtefacts) -> None:
        """
        Persists all model artefacts to intent_engine/models/.

        Files written:
          - intent_classifier.pkl
          - tfidf_vectorizer.pkl
          - label_encoder.pkl
          - model_metadata.json

        Args:
            artefacts: ModelArtefacts instance from the trainer.

        Raises:
            RuntimeError: If any file cannot be written.
        """
        try:
            self._pickle(artefacts.classifier,    self._cfg.model_file)
            self._pickle(artefacts.vectorizer,    self._cfg.vectorizer_file)
            self._pickle(artefacts.label_encoder, self._cfg.label_encoder_file)
            self._write_metadata(artefacts.metadata)
            self._log.info("Model artefacts saved to %s", self._cfg.models_dir)
        except Exception as exc:
            raise RuntimeError(f"Failed to save model artefacts: {exc}") from exc

    def load(self) -> ModelArtefacts:
        """
        Loads all model artefacts from intent_engine/models/.

        Returns:
            ModelArtefacts: Ready-to-use artefacts.

        Raises:
            FileNotFoundError: If any required artefact file is missing.
            RuntimeError:      If loading fails.
        """
        self._assert_exists(self._cfg.model_file)
        self._assert_exists(self._cfg.vectorizer_file)
        self._assert_exists(self._cfg.label_encoder_file)

        try:
            classifier    = self._unpickle(self._cfg.model_file)
            vectorizer    = self._unpickle(self._cfg.vectorizer_file)
            label_encoder = self._unpickle(self._cfg.label_encoder_file)
            metadata      = self._read_metadata()
            self._log.info("Model artefacts loaded from %s", self._cfg.models_dir)
            return ModelArtefacts(
                classifier=classifier,
                vectorizer=vectorizer,
                label_encoder=label_encoder,
                metadata=metadata,
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to load model artefacts: {exc}") from exc

    def is_trained(self) -> bool:
        """Returns True if all required artefact files exist."""
        return (
            self._cfg.model_file.exists()
            and self._cfg.vectorizer_file.exists()
            and self._cfg.label_encoder_file.exists()
        )

    def delete(self) -> None:
        """Removes all artefact files from models/."""
        for path in (
            self._cfg.model_file,
            self._cfg.vectorizer_file,
            self._cfg.label_encoder_file,
            self._cfg.model_metadata_file,
        ):
            if path.exists():
                path.unlink()
                self._log.info("Deleted: %s", path.name)

    def get_metadata(self) -> dict:
        """Returns the stored model metadata dict, or empty dict if not found."""
        if not self._cfg.model_metadata_file.exists():
            return {}
        return self._read_metadata()

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

    def _pickle(self, obj: Any, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            pickle.dump(obj, f, protocol=pickle.HIGHEST_PROTOCOL)
        self._log.debug("Saved: %s", path.name)

    def _unpickle(self, path: Path) -> Any:
        with path.open("rb") as f:
            return pickle.load(f)

    def _write_metadata(self, metadata: dict) -> None:
        path = self._cfg.model_metadata_file
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        self._log.debug("Saved: %s", path.name)

    def _read_metadata(self) -> dict:
        path = self._cfg.model_metadata_file
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _assert_exists(self, path: Path) -> None:
        if not path.exists():
            raise FileNotFoundError(
                f"Required model artefact not found: {path}\n"
                f"Run the trainer first: python -m intent_engine.trainer"
            )


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_manager_instance: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """
    Returns the module-level singleton ModelManager.

    Usage:
        from intent_engine.model_manager import get_model_manager
        manager = get_model_manager()
        artefacts = manager.load()
    """
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ModelManager()
    return _manager_instance


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    manager = get_model_manager()
    print("\n" + "=" * 60)
    print("  AKP Intent Engine — Model Manager Diagnostic")
    print("=" * 60)
    print(f"\n  Models Dir   : {manager._cfg.models_dir}")
    print(f"  Model trained: {manager.is_trained()}")
    if manager.is_trained():
        meta = manager.get_metadata()
        print(f"\n  Metadata:")
        for k, v in meta.items():
            if k not in ("confusion_matrix", "classification_report"):
                print(f"    {k:<25}: {v}")
    print("\n" + "=" * 60 + "\n")
