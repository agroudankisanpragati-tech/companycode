# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/config.py
# Purpose: All paths, constants, and runtime configuration for the
#          Intent Engine module. Every path is derived from this file's
#          location — no hardcoded absolute paths anywhere.
# =============================================================================

from __future__ import annotations

import os
import platform
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# ROOT RESOLUTION
# IE_ROOT  → Ai/intent_engine/
# AI_ROOT  → Ai/
# ---------------------------------------------------------------------------
IE_ROOT: Path = Path(__file__).parent.resolve()
AI_ROOT: Path = IE_ROOT.parent.resolve()

# ---------------------------------------------------------------------------
# INTENT LABELS — derived from dataset folder names
# These are the canonical intent names. The dataset builder auto-discovers
# folders and maps them to these labels (case-insensitive match).
# ---------------------------------------------------------------------------
INTENT_LABELS: tuple[str, ...] = (
    "crop",
    "disease",
    "pest",
    "weather",
    "market",
    "government",
    "soil",
    "fertilizer",
    "irrigation",
    "seed",
    "machinery",
    "general",
    "greeting",
    "emergency",
    # NOTE: pest is now a first-class intent with its own dataset folder
)

# ---------------------------------------------------------------------------
# SUPPORTED FILE EXTENSIONS
# ---------------------------------------------------------------------------
SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(
    {".json", ".csv", ".txt", ".docx"}
)

# ---------------------------------------------------------------------------
# DATASET CONSTANTS
# ---------------------------------------------------------------------------
MIN_TEXT_LENGTH: int = 3          # Minimum characters for a valid sample
MAX_TEXT_LENGTH: int = 2048       # Maximum characters per sample
MIN_SAMPLES_PER_INTENT: int = 1   # Warn if an intent has fewer samples

# ---------------------------------------------------------------------------
# SPLIT RATIOS
# ---------------------------------------------------------------------------
DEFAULT_TRAIN_RATIO: float = 0.70
DEFAULT_VAL_RATIO:   float = 0.15
DEFAULT_TEST_RATIO:  float = 0.15
DEFAULT_SPLIT_SEED:  int   = 42

# ---------------------------------------------------------------------------
# MODEL CONSTANTS
# ---------------------------------------------------------------------------
DEFAULT_MODEL_TYPE: str   = "logistic"   # "logistic" | "svm" | "random_forest" | "mlp"
DEFAULT_MAX_FEATURES: int = 100_000      # Increased for multilingual Devanagari + Latin TF-IDF
DEFAULT_NGRAM_RANGE: tuple[int, int] = (1, 3)  # trigrams capture Hindi compound phrases
DEFAULT_MAX_ITER: int = 3_000            # More iterations for convergence on multilingual data

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
DEFAULT_LOG_LEVEL: str = "INFO"
LOG_MAX_BYTES: int     = 10 * 1024 * 1024   # 10 MB
LOG_BACKUP_COUNT: int  = 5
LOG_DATE_FORMAT: str   = "%Y-%m-%d %H:%M:%S"


# ---------------------------------------------------------------------------
# CONFIGURATION DATACLASS
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class IntentEngineConfig:
    """
    Complete runtime configuration for the Intent Engine module.
    All paths are absolute and derived from IE_ROOT.
    frozen=True — immutable after construction.

    Usage:
        from intent_engine.config import get_config
        cfg = get_config()
        print(cfg.datasets_dir)
        print(cfg.models_dir)
    """
    # Roots
    ie_root:  Path
    ai_root:  Path

    # Core directories
    datasets_dir:  Path   # intent_engine/datasets/
    models_dir:    Path   # intent_engine/models/
    outputs_dir:   Path   # intent_engine/outputs/
    logs_dir:      Path   # intent_engine/logs/
    configs_dir:   Path   # intent_engine/configs/

    # Intent labels
    intent_labels: tuple[str, ...]

    # Supported file types
    supported_extensions: frozenset[str]

    # Dataset settings
    min_text_length:       int
    max_text_length:       int
    min_samples_per_intent: int

    # Split settings
    train_ratio: float
    val_ratio:   float
    test_ratio:  float
    split_seed:  int

    # Model settings
    model_type:    str
    max_features:  int
    ngram_range:   tuple[int, int]
    max_iter:      int

    # Logging
    log_level: str

    # Derived output file paths
    @property
    def intent_dataset_json(self) -> Path:
        return self.outputs_dir / "intent_dataset.json"

    @property
    def intent_dataset_csv(self) -> Path:
        return self.outputs_dir / "intent_dataset.csv"

    @property
    def dataset_statistics_json(self) -> Path:
        return self.outputs_dir / "dataset_statistics.json"

    @property
    def label_map_json(self) -> Path:
        return self.outputs_dir / "label_map.json"

    # Derived model file paths
    @property
    def model_file(self) -> Path:
        return self.models_dir / "intent_classifier.pkl"

    @property
    def vectorizer_file(self) -> Path:
        return self.models_dir / "tfidf_vectorizer.pkl"

    @property
    def label_encoder_file(self) -> Path:
        return self.models_dir / "label_encoder.pkl"

    @property
    def model_metadata_file(self) -> Path:
        return self.models_dir / "model_metadata.json"

    def intent_dataset_dir(self, intent: str) -> Path:
        """Returns the dataset folder for a specific intent label."""
        return self.datasets_dir / intent


# ---------------------------------------------------------------------------
# DIRECTORY BOOTSTRAP
# ---------------------------------------------------------------------------
def _ensure_dirs(cfg: IntentEngineConfig) -> None:
    """Creates all required directories if they do not exist."""
    for directory in (
        cfg.datasets_dir,
        cfg.models_dir,
        cfg.outputs_dir,
        cfg.logs_dir,
        cfg.configs_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    # Create one sub-folder per intent label inside datasets/
    for label in cfg.intent_labels:
        (cfg.datasets_dir / label).mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# CONFIG FACTORY
# ---------------------------------------------------------------------------
_instance: Optional[IntentEngineConfig] = None


def get_config(force_rebuild: bool = False) -> IntentEngineConfig:
    """
    Returns the singleton IntentEngineConfig instance.
    Builds once on first call; cached for all subsequent calls.
    Auto-creates all required directories on first build.

    Args:
        force_rebuild: Rebuild from scratch (useful in tests).

    Returns:
        IntentEngineConfig: Immutable runtime configuration object.
    """
    global _instance

    if _instance is not None and not force_rebuild:
        return _instance

    _instance = IntentEngineConfig(
        ie_root  = IE_ROOT,
        ai_root  = AI_ROOT,
        datasets_dir  = IE_ROOT / "datasets",
        models_dir    = IE_ROOT / "models",
        outputs_dir   = IE_ROOT / "outputs",
        logs_dir      = IE_ROOT / "logs",
        configs_dir   = IE_ROOT / "configs",
        intent_labels = INTENT_LABELS,
        supported_extensions = SUPPORTED_EXTENSIONS,
        min_text_length       = int(os.getenv("IE_MIN_TEXT_LEN",  MIN_TEXT_LENGTH)),
        max_text_length       = int(os.getenv("IE_MAX_TEXT_LEN",  MAX_TEXT_LENGTH)),
        min_samples_per_intent = int(os.getenv("IE_MIN_SAMPLES",  MIN_SAMPLES_PER_INTENT)),
        train_ratio = float(os.getenv("IE_TRAIN_RATIO", DEFAULT_TRAIN_RATIO)),
        val_ratio   = float(os.getenv("IE_VAL_RATIO",   DEFAULT_VAL_RATIO)),
        test_ratio  = float(os.getenv("IE_TEST_RATIO",  DEFAULT_TEST_RATIO)),
        split_seed  = int(os.getenv("IE_SPLIT_SEED",    DEFAULT_SPLIT_SEED)),
        model_type   = os.getenv("IE_MODEL_TYPE",    DEFAULT_MODEL_TYPE),
        max_features = int(os.getenv("IE_MAX_FEATURES", DEFAULT_MAX_FEATURES)),
        ngram_range  = DEFAULT_NGRAM_RANGE,
        max_iter     = int(os.getenv("IE_MAX_ITER",     DEFAULT_MAX_ITER)),
        log_level    = os.getenv("IE_LOG_LEVEL",        DEFAULT_LOG_LEVEL),
    )

    _ensure_dirs(_instance)
    return _instance


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cfg = get_config()
    print("\n" + "=" * 60)
    print("  AKP Intent Engine — Configuration Diagnostic")
    print("=" * 60)
    print(f"\n  IE Root      : {cfg.ie_root}")
    print(f"  Datasets Dir : {cfg.datasets_dir}")
    print(f"  Models Dir   : {cfg.models_dir}")
    print(f"  Outputs Dir  : {cfg.outputs_dir}")
    print(f"  Logs Dir     : {cfg.logs_dir}")
    print(f"\n  Model Type   : {cfg.model_type}")
    print(f"  Max Features : {cfg.max_features}")
    print(f"  N-gram Range : {cfg.ngram_range}")
    print(f"\n  Split Ratios : train={cfg.train_ratio}  val={cfg.val_ratio}  test={cfg.test_ratio}")
    print(f"  Split Seed   : {cfg.split_seed}")
    print(f"\n  Intent Labels ({len(cfg.intent_labels)}):")
    for label in cfg.intent_labels:
        folder = cfg.intent_dataset_dir(label)
        status = "exists" if folder.exists() else "missing"
        print(f"    {label:<15} — {status}")
    print("\n" + "=" * 60 + "\n")
