# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/__init__.py
# Purpose: Public API for the intent_engine package.
#          Heavy modules (classifier, predictor, trainer) are imported lazily
#          via __getattr__ so that `import intent_engine` never fails even
#          when sklearn is not installed in the current environment.
# =============================================================================

from __future__ import annotations

from typing import TYPE_CHECKING

# Always-safe imports (stdlib + config only)
from intent_engine.config import (
    INTENT_LABELS,
    IntentEngineConfig,
    get_config,
)

if TYPE_CHECKING:
    from intent_engine.intent_classifier import (
        ClassificationResult,
        IntentClassifier,
        get_classifier,
        normalise_text,
    )
    from intent_engine.predictor import (
        Predictor,
        PredictionResult,
        get_predictor,
        predict_intent,
    )
    from intent_engine.model_manager import (
        ModelArtefacts,
        ModelManager,
        get_model_manager,
    )
    from intent_engine.trainer import (
        Trainer,
        TrainingResult,
        train_intent_model,
    )
    from intent_engine.dataset_builder import (
        DatasetBuilder,
        BuildResult,
        build_dataset,
    )

_LAZY: dict[str, str] = {
    # intent_classifier
    "ClassificationResult": "intent_engine.intent_classifier",
    "IntentClassifier":     "intent_engine.intent_classifier",
    "get_classifier":       "intent_engine.intent_classifier",
    "normalise_text":       "intent_engine.intent_classifier",
    # predictor
    "Predictor":            "intent_engine.predictor",
    "PredictionResult":     "intent_engine.predictor",
    "get_predictor":        "intent_engine.predictor",
    "predict_intent":       "intent_engine.predictor",
    # model_manager
    "ModelArtefacts":       "intent_engine.model_manager",
    "ModelManager":         "intent_engine.model_manager",
    "get_model_manager":    "intent_engine.model_manager",
    # trainer
    "Trainer":              "intent_engine.trainer",
    "TrainingResult":       "intent_engine.trainer",
    "train_intent_model":   "intent_engine.trainer",
    # dataset_builder
    "DatasetBuilder":       "intent_engine.dataset_builder",
    "BuildResult":          "intent_engine.dataset_builder",
    "build_dataset":        "intent_engine.dataset_builder",
}


def __getattr__(name: str):
    if name in _LAZY:
        import importlib
        module = importlib.import_module(_LAZY[name])
        return getattr(module, name)
    raise AttributeError(f"module 'intent_engine' has no attribute {name!r}")


__all__ = [
    # config
    "INTENT_LABELS",
    "IntentEngineConfig",
    "get_config",
    # classifier
    "ClassificationResult",
    "IntentClassifier",
    "get_classifier",
    "normalise_text",
    # predictor
    "Predictor",
    "PredictionResult",
    "get_predictor",
    "predict_intent",
    # model_manager
    "ModelArtefacts",
    "ModelManager",
    "get_model_manager",
    # trainer
    "Trainer",
    "TrainingResult",
    "train_intent_model",
    # dataset_builder
    "DatasetBuilder",
    "BuildResult",
    "build_dataset",
]
