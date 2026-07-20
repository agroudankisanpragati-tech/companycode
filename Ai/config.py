# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: config.py
# Purpose: Resolves all absolute paths, detects hardware (CPU/GPU),
#          loads environment variables, and builds the complete runtime
#          configuration object used by every other module.
#
# RULE: No hardcoded paths anywhere in the project.
#       Every path is derived from AI_ROOT (this file's location).
#       This means the project works on ANY machine without changes.
# =============================================================================

from __future__ import annotations

import os
import platform
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Load .env file if it exists (optional — project works without it)
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass  # python-dotenv not installed — use system environment variables only

from constants import (
    AUG_BLUR_LIMIT,
    AUG_BLUR_P,
    AUG_BRIGHTNESS_LIMIT,
    AUG_BRIGHTNESS_P,
    AUG_CONTRAST_LIMIT,
    AUG_CROP_P,
    AUG_CROP_RATIO,
    AUG_CROP_SCALE,
    AUG_ENABLED,
    AUG_ERASE_P,
    AUG_ERASE_RATIO,
    AUG_ERASE_SCALE,
    AUG_HFLIP_P,
    AUG_HUE_SAT_P,
    AUG_HUE_SHIFT_LIMIT,
    AUG_NOISE_P,
    AUG_NOISE_VAR,
    AUG_PERSPECTIVE_P,
    AUG_PERSPECTIVE_SCALE,
    AUG_ROTATE_LIMIT,
    AUG_ROTATE_P,
    AUG_SAT_SHIFT_LIMIT,
    AUG_VAL_SHIFT_LIMIT,
    AUG_VFLIP_P,
    AUG_ZOOM_LIMIT,
    AUG_ZOOM_P,
    CLAHE_CLIP_LIMIT,
    CLAHE_TILE_GRID_SIZE,
    DEFAULT_BATCH_SIZE,
    DEFAULT_EPOCHS,
    DEFAULT_EXPORT_FORMAT,
    DEFAULT_INTERP,
    DEFAULT_LEARNING_RATE,
    DEFAULT_LOG_LEVEL,
    DEFAULT_MODEL_WEIGHTS,
    DEFAULT_NORM_MODE,
    DEFAULT_PATIENCE,
    DEFAULT_SPLIT_SEED,
    DEFAULT_TEST_SPLIT,
    DEFAULT_TRAIN_SPLIT,
    DEFAULT_VAL_SPLIT,
    DEFAULT_WORKERS,
    DENOISE_H,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    LETTERBOX_FILL_COLOR,
    ONNX_OPSET_VERSION,
    SUPPORTED_CROPS,
)


# =============================================================================
# SECTION 1 — ROOT PATH RESOLUTION
# =============================================================================
# AI_ROOT is the absolute path to the Ai/ folder.
# Everything else is derived from this single anchor point.
# This works correctly regardless of where Python is run from.

AI_ROOT: Path = Path(__file__).parent.resolve()
PROJECT_ROOT: Path = AI_ROOT.parent.resolve()


# =============================================================================
# SECTION 2 — HARDWARE DETECTION
# =============================================================================

def _detect_device() -> str:
    """
    Detects the best available compute device.

    Returns:
        "cuda"  — NVIDIA GPU is available and CUDA is properly installed
        "mps"   — Apple Silicon GPU (M1/M2/M3 Mac) is available
        "cpu"   — No GPU available, fall back to CPU

    This function is called once at startup. The result is stored in
    HardwareConfig.device and used throughout training and inference.
    """
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        # Apple Silicon GPU support (MPS = Metal Performance Shaders)
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def _get_gpu_info() -> dict[str, str | int | float]:
    """
    Returns GPU details if available. Returns empty dict on CPU-only machines.
    Used for logging and diagnostics — not for training logic.
    """
    info: dict[str, str | int | float] = {}
    try:
        import torch
        if torch.cuda.is_available():
            info["name"] = torch.cuda.get_device_name(0)
            info["count"] = torch.cuda.device_count()
            info["vram_gb"] = round(
                torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2
            )
    except ImportError:
        pass
    return info


def _get_system_ram_gb() -> float:
    """Returns total system RAM in GB. Used for batch size recommendations."""
    try:
        import psutil
        return round(psutil.virtual_memory().total / (1024 ** 3), 2)
    except ImportError:
        return 0.0


# =============================================================================
# SECTION 3 — CONFIGURATION DATACLASSES
# =============================================================================
# Using dataclasses instead of plain dicts gives:
#   - Type hints and IDE autocomplete
#   - Immutable-by-default structure
#   - Clean repr() for logging
#   - No typo bugs (config["epcohs"] vs config.epochs)

@dataclass(frozen=True)
class HardwareConfig:
    """
    Describes the compute hardware available on this machine.
    frozen=True means this cannot be accidentally modified after creation.
    """
    device: str                              # "cpu", "cuda", or "mps"
    gpu_info: dict[str, str | int | float]   # GPU name, VRAM, count
    system_ram_gb: float                     # Total system RAM
    python_version: str                      # e.g. "3.11.8"
    os_name: str                             # e.g. "Windows", "Linux", "Darwin"
    os_version: str                          # e.g. "10.0.22631"
    cpu_count: int                           # Number of logical CPU cores

    @property
    def is_gpu(self) -> bool:
        """True if training will use a GPU (CUDA or MPS)."""
        return self.device in ("cuda", "mps")

    @property
    def is_cuda(self) -> bool:
        """True if NVIDIA CUDA GPU is available."""
        return self.device == "cuda"

    @property
    def recommended_batch_size(self) -> int:
        """
        Suggests a safe batch size based on available hardware.
        These are conservative estimates to prevent out-of-memory errors.
        """
        if self.is_cuda:
            vram = self.gpu_info.get("vram_gb", 0)
            if vram >= 16:
                return 64
            elif vram >= 8:
                return 32
            elif vram >= 4:
                return 16
            else:
                return 8
        # CPU: base recommendation on RAM
        if self.system_ram_gb >= 16:
            return 16
        elif self.system_ram_gb >= 8:
            return 8
        else:
            return 4

    @property
    def recommended_workers(self) -> int:
        """
        Suggests safe DataLoader worker count.
        On Windows, too many workers causes issues — cap at 4.
        """
        if self.os_name == "Windows":
            return min(self.cpu_count, 4)
        return min(self.cpu_count, 8)


@dataclass(frozen=True)
class PathConfig:
    """
    All absolute paths used by the AI module.
    Every path is derived from AI_ROOT — no hardcoded strings.
    """
    # Root directories
    ai_root: Path
    project_root: Path

    # Dataset
    dataset_root: Path

    # Module directories
    training_dir: Path
    inference_dir: Path
    models_dir: Path
    weights_dir: Path
    configs_dir: Path
    utils_dir: Path
    logs_dir: Path
    outputs_dir: Path
    knowledge_base_dir: Path

    # Weights subdirectories
    checkpoints_dir: Path
    exported_dir: Path
    pretrained_dir: Path

    # Output subdirectories
    predictions_dir: Path
    reports_dir: Path
    visualizations_dir: Path

    # Log subdirectories
    training_logs_dir: Path
    inference_logs_dir: Path

    def get_crop_dataset_path(self, crop_name: str) -> Path:
        """Returns the absolute path to a specific crop's dataset folder."""
        return self.dataset_root / crop_name

    def get_crop_diseases_path(self, crop_name: str, folder_override: Optional[str] = None) -> Path:
        """
        Returns the absolute path to a crop's diseases folder.
        Handles the Tomato edge case where the folder is named 'disease' not 'diseases'.
        """
        subfolder = folder_override or "diseases"
        return self.dataset_root / crop_name / subfolder

    def get_crop_pests_path(self, crop_name: str) -> Path:
        """Returns the absolute path to a crop's pests folder."""
        return self.dataset_root / crop_name / "pests"

    def get_crop_healthy_path(self, crop_name: str) -> Path:
        """Returns the absolute path to a crop's healthy folder."""
        return self.dataset_root / crop_name / "healthy"

    def get_weights_path(self, crop_name: str, model_type: str = "best") -> Path:
        """
        Returns the path where a trained model's weights should be saved.
        Example: weights/checkpoints/Black_gram_best.pt
        """
        return self.checkpoints_dir / f"{crop_name}_{model_type}.pt"

    def get_exported_model_path(self, crop_name: str, fmt: str = "onnx") -> Path:
        """
        Returns the path for an exported model.
        Example: weights/exported/Black_gram_model.onnx
        """
        return self.exported_dir / f"{crop_name}_model.{fmt}"

    def get_training_log_path(self, crop_name: str, timestamp: str) -> Path:
        """Returns the path for a training session log file."""
        return self.training_logs_dir / f"{crop_name}_{timestamp}.log"

    def get_report_path(self, crop_name: str, timestamp: str) -> Path:
        """Returns the path for an evaluation report."""
        return self.reports_dir / f"{crop_name}_report_{timestamp}.json"


@dataclass
class TrainingConfig:
    """
    Training hyperparameters. Not frozen — can be overridden per crop
    via YAML configs or command-line arguments.
    """
    epochs: int = DEFAULT_EPOCHS
    batch_size: int = DEFAULT_BATCH_SIZE
    learning_rate: float = DEFAULT_LEARNING_RATE
    patience: int = DEFAULT_PATIENCE
    image_size: int = IMAGE_SIZE
    workers: int = DEFAULT_WORKERS
    model_weights: str = DEFAULT_MODEL_WEIGHTS
    device: str = "cpu"                    # Overridden at runtime by HardwareConfig
    augment: bool = True                   # Enable data augmentation
    pretrained: bool = True                # Use ImageNet pretrained weights
    resume: bool = False                   # Resume from last checkpoint
    save_period: int = 10                  # Save checkpoint every N epochs
    verbose: bool = True                   # Print training progress


@dataclass(frozen=True)
class AugmentationConfig:
    """
    Controls every augmentation transform applied to training images.

    frozen=True — pipeline is fixed per run; override via env vars.
    All transforms are applied ONLY to training data. Validation and
    test data are NEVER augmented.

    Each transform has an independent probability (p) field.
    Setting p=0.0 disables that transform entirely.

    Fields:
        enabled           — Master switch. False disables all augmentation.
        hflip_p           — Horizontal flip probability.
        vflip_p           — Vertical flip probability.
        rotate_p          — Random rotation probability.
        rotate_limit      — Max rotation in degrees (±).
        perspective_p     — Perspective distortion probability.
        perspective_scale — Distortion scale range (min, max).
        zoom_p            — Random zoom probability.
        zoom_limit        — Zoom scale range (min, max).
        crop_p            — Random crop probability.
        crop_scale        — Crop area fraction range (min, max).
        crop_ratio        — Crop aspect ratio range (min, max).
        brightness_p      — Brightness/contrast adjust probability.
        brightness_limit  — Brightness change limit (±).
        contrast_limit    — Contrast change limit (±).
        hue_sat_p         — Hue-saturation-value shift probability.
        hue_shift_limit   — Hue shift limit (±degrees).
        sat_shift_limit   — Saturation shift limit (±).
        val_shift_limit   — Value (brightness) shift limit (±).
        blur_p            — Gaussian blur probability.
        blur_limit        — Blur kernel size range (odd integers).
        noise_p           — Gaussian noise probability.
        noise_var         — Noise variance range (min, max).
        erase_p           — Random erasing probability.
        erase_scale       — Erased area fraction range (min, max).
        erase_ratio       — Erased region aspect ratio range (min, max).
    """
    enabled:           bool                        = AUG_ENABLED
    hflip_p:           float                       = AUG_HFLIP_P
    vflip_p:           float                       = AUG_VFLIP_P
    rotate_p:          float                       = AUG_ROTATE_P
    rotate_limit:      int                         = AUG_ROTATE_LIMIT
    perspective_p:     float                       = AUG_PERSPECTIVE_P
    perspective_scale: tuple[float, float]         = AUG_PERSPECTIVE_SCALE
    zoom_p:            float                       = AUG_ZOOM_P
    zoom_limit:        tuple[float, float]         = AUG_ZOOM_LIMIT
    crop_p:            float                       = AUG_CROP_P
    crop_scale:        tuple[float, float]         = AUG_CROP_SCALE
    crop_ratio:        tuple[float, float]         = AUG_CROP_RATIO
    brightness_p:      float                       = AUG_BRIGHTNESS_P
    brightness_limit:  float                       = AUG_BRIGHTNESS_LIMIT
    contrast_limit:    float                       = AUG_CONTRAST_LIMIT
    hue_sat_p:         float                       = AUG_HUE_SAT_P
    hue_shift_limit:   int                         = AUG_HUE_SHIFT_LIMIT
    sat_shift_limit:   int                         = AUG_SAT_SHIFT_LIMIT
    val_shift_limit:   int                         = AUG_VAL_SHIFT_LIMIT
    blur_p:            float                       = AUG_BLUR_P
    blur_limit:        tuple[int, int]             = AUG_BLUR_LIMIT
    noise_p:           float                       = AUG_NOISE_P
    noise_var:         tuple[float, float]         = AUG_NOISE_VAR
    erase_p:           float                       = AUG_ERASE_P
    erase_scale:       tuple[float, float]         = AUG_ERASE_SCALE
    erase_ratio:       tuple[float, float]         = AUG_ERASE_RATIO


@dataclass(frozen=True)
class SplitConfig:
    """
    Controls how the dataset is split into train / validation / test sets.

    All three ratios must sum to 1.0. Validated at construction time.
    frozen=True — ratios are fixed for the lifetime of a training run.
    """
    train_ratio: float = DEFAULT_TRAIN_SPLIT   # Fraction of data for training
    val_ratio:   float = DEFAULT_VAL_SPLIT     # Fraction for validation
    test_ratio:  float = DEFAULT_TEST_SPLIT    # Fraction for test
    seed:        int   = DEFAULT_SPLIT_SEED    # Random seed for reproducibility

    def __post_init__(self) -> None:
        total = round(self.train_ratio + self.val_ratio + self.test_ratio, 6)
        if abs(total - 1.0) > 1e-5:
            raise ValueError(
                f"Split ratios must sum to 1.0, got {total:.6f} "
                f"(train={self.train_ratio}, val={self.val_ratio}, test={self.test_ratio})"
            )


@dataclass(frozen=True)
class PreprocessingConfig:
    """
    Controls the image preprocessing pipeline applied before training
    and inference. All options are read by preprocessing.py.

    frozen=True — pipeline is fixed per run; change via env vars or subclass.

    Fields:
        image_size        — Target square size in pixels (width = height).
        interpolation     — Resize interpolation: "bilinear"|"bicubic"|"nearest".
        normalize_mode    — "imagenet" | "minmax" | "none".
        imagenet_mean     — Per-channel mean for ImageNet normalisation.
        imagenet_std      — Per-channel std for ImageNet normalisation.
        letterbox         — If True, pad to preserve aspect ratio instead of
                            stretching. Recommended for non-square images.
        fill_color        — RGB fill colour used for letterbox padding.
        apply_clahe       — Apply CLAHE contrast enhancement (L channel in LAB).
        clahe_clip_limit  — CLAHE clip limit (higher = more contrast).
        clahe_tile_grid   — CLAHE tile grid size (rows, cols).
        apply_hist_eq     — Apply global histogram equalisation (grayscale only).
        apply_denoise     — Apply fast non-local means denoising.
        denoise_h         — Denoising filter strength (h parameter).
    """
    image_size:       int                        = IMAGE_SIZE
    interpolation:    str                        = DEFAULT_INTERP
    normalize_mode:   str                        = DEFAULT_NORM_MODE
    imagenet_mean:    tuple[float, float, float] = IMAGENET_MEAN
    imagenet_std:     tuple[float, float, float] = IMAGENET_STD
    letterbox:        bool                       = True
    fill_color:       tuple[int, int, int]       = LETTERBOX_FILL_COLOR
    apply_clahe:      bool                       = False
    clahe_clip_limit: float                      = CLAHE_CLIP_LIMIT
    clahe_tile_grid:  tuple[int, int]            = CLAHE_TILE_GRID_SIZE
    apply_hist_eq:    bool                       = False
    apply_denoise:    bool                       = False
    denoise_h:        int                        = DENOISE_H


@dataclass(frozen=True)
class ExportConfig:
    """Configuration for model export to deployment formats."""
    format: str = DEFAULT_EXPORT_FORMAT
    opset_version: int = ONNX_OPSET_VERSION
    simplify: bool = True                  # Run onnxsim after export
    dynamic_axes: bool = False             # Fixed input shape for browser compat
    half_precision: bool = False           # FP16 — only for GPU inference


@dataclass(frozen=True)
class AKPConfig:
    """
    Master configuration object.
    This is the single object passed around the entire AI module.
    Import this from config.py — never construct it manually.

    Usage:
        from config import get_config
        cfg = get_config()
        print(cfg.hardware.device)
        print(cfg.paths.dataset_root)
        print(cfg.preprocessing.image_size)
        print(cfg.split.train_ratio)
        print(cfg.augmentation.enabled)
    """
    hardware:       HardwareConfig
    paths:          PathConfig
    training:       TrainingConfig
    export:         ExportConfig
    preprocessing:  PreprocessingConfig
    augmentation:   AugmentationConfig
    split:          SplitConfig
    log_level:      str
    debug_mode:     bool
    supported_crops: list[str]


# =============================================================================
# SECTION 4 — CONFIG FACTORY FUNCTION
# =============================================================================

def _build_path_config() -> PathConfig:
    """Constructs PathConfig by deriving all paths from AI_ROOT."""
    weights = AI_ROOT / "weights"
    outputs = AI_ROOT / "outputs"
    logs = AI_ROOT / "logs"

    return PathConfig(
        ai_root=AI_ROOT,
        project_root=PROJECT_ROOT,
        dataset_root=AI_ROOT / "crop_dataset",
        training_dir=AI_ROOT / "training",
        inference_dir=AI_ROOT / "inference",
        models_dir=AI_ROOT / "models",
        weights_dir=weights,
        configs_dir=AI_ROOT / "configs",
        utils_dir=AI_ROOT / "utils",
        logs_dir=logs,
        outputs_dir=outputs,
        knowledge_base_dir=AI_ROOT / "knowledge_base",
        checkpoints_dir=weights / "checkpoints",
        exported_dir=weights / "exported",
        pretrained_dir=weights / "pretrained",
        predictions_dir=outputs / "predictions",
        reports_dir=outputs / "reports",
        visualizations_dir=outputs / "visualizations",
        training_logs_dir=logs / "training",
        inference_logs_dir=logs / "inference",
    )


def _build_hardware_config() -> HardwareConfig:
    """Detects hardware and builds HardwareConfig."""
    device = _detect_device()
    return HardwareConfig(
        device=device,
        gpu_info=_get_gpu_info(),
        system_ram_gb=_get_system_ram_gb(),
        python_version=platform.python_version(),
        os_name=platform.system(),
        os_version=platform.version(),
        cpu_count=os.cpu_count() or 1,
    )


def _build_training_config(hardware: HardwareConfig) -> TrainingConfig:
    """
    Builds TrainingConfig, adjusting defaults based on detected hardware.
    Environment variables can override any value:
        AKP_EPOCHS=100
        AKP_BATCH_SIZE=32
        AKP_LR=0.0005
    """
    return TrainingConfig(
        epochs=int(os.getenv("AKP_EPOCHS", DEFAULT_EPOCHS)),
        batch_size=int(os.getenv("AKP_BATCH_SIZE", hardware.recommended_batch_size)),
        learning_rate=float(os.getenv("AKP_LR", DEFAULT_LEARNING_RATE)),
        patience=int(os.getenv("AKP_PATIENCE", DEFAULT_PATIENCE)),
        image_size=int(os.getenv("AKP_IMAGE_SIZE", IMAGE_SIZE)),
        workers=int(os.getenv("AKP_WORKERS", hardware.recommended_workers)),
        model_weights=os.getenv("AKP_MODEL_WEIGHTS", DEFAULT_MODEL_WEIGHTS),
        device=hardware.device,
        augment=os.getenv("AKP_AUGMENT", "true").lower() == "true",
        pretrained=os.getenv("AKP_PRETRAINED", "true").lower() == "true",
        resume=os.getenv("AKP_RESUME", "false").lower() == "true",
    )


# Module-level singleton — built once, reused everywhere
_config_instance: Optional[AKPConfig] = None


def get_config(force_rebuild: bool = False) -> AKPConfig:
    """
    Returns the singleton AKPConfig instance.
    Built once on first call, cached for all subsequent calls.

    Args:
        force_rebuild: If True, rebuilds config from scratch (useful in tests).

    Returns:
        AKPConfig: The complete runtime configuration object.

    Usage:
        from config import get_config
        cfg = get_config()
    """
    global _config_instance

    if _config_instance is None or force_rebuild:
        hardware = _build_hardware_config()
        paths = _build_path_config()
        training = _build_training_config(hardware)
        export = ExportConfig()

        _config_instance = AKPConfig(
            hardware=hardware,
            paths=paths,
            training=training,
            export=export,
            preprocessing=PreprocessingConfig(
                image_size=int(os.getenv("AKP_IMAGE_SIZE", IMAGE_SIZE)),
                letterbox=os.getenv("AKP_LETTERBOX", "true").lower() == "true",
                normalize_mode=os.getenv("AKP_NORM_MODE", DEFAULT_NORM_MODE),
                apply_clahe=os.getenv("AKP_CLAHE", "false").lower() == "true",
                apply_hist_eq=os.getenv("AKP_HIST_EQ", "false").lower() == "true",
                apply_denoise=os.getenv("AKP_DENOISE", "false").lower() == "true",
            ),
            augmentation=AugmentationConfig(
                enabled=os.getenv("AKP_AUGMENT", "true").lower() == "true",
                hflip_p=float(os.getenv("AKP_AUG_HFLIP_P", AUG_HFLIP_P)),
                vflip_p=float(os.getenv("AKP_AUG_VFLIP_P", AUG_VFLIP_P)),
                rotate_p=float(os.getenv("AKP_AUG_ROTATE_P", AUG_ROTATE_P)),
                blur_p=float(os.getenv("AKP_AUG_BLUR_P", AUG_BLUR_P)),
                noise_p=float(os.getenv("AKP_AUG_NOISE_P", AUG_NOISE_P)),
                erase_p=float(os.getenv("AKP_AUG_ERASE_P", AUG_ERASE_P)),
            ),
            split=SplitConfig(
                train_ratio=float(os.getenv("AKP_TRAIN_SPLIT", DEFAULT_TRAIN_SPLIT)),
                val_ratio=float(os.getenv("AKP_VAL_SPLIT", DEFAULT_VAL_SPLIT)),
                test_ratio=float(os.getenv("AKP_TEST_SPLIT", DEFAULT_TEST_SPLIT)),
                seed=int(os.getenv("AKP_SPLIT_SEED", DEFAULT_SPLIT_SEED)),
            ),
            log_level=os.getenv("AKP_LOG_LEVEL", DEFAULT_LOG_LEVEL),
            debug_mode=os.getenv("AKP_DEBUG", "false").lower() == "true",
            supported_crops=SUPPORTED_CROPS,
        )

    return _config_instance


# =============================================================================
# SECTION 5 — SELF-TEST (run this file directly to verify config)
# =============================================================================
# Run: python config.py
# This will print a full diagnostic report of your environment.

if __name__ == "__main__":
    cfg = get_config()

    print("\n" + "=" * 60)
    print(f"  AKP AI Module — Configuration Diagnostic")
    print("=" * 60)

    print(f"\n[HARDWARE]")
    print(f"  Device       : {cfg.hardware.device.upper()}")
    print(f"  OS           : {cfg.hardware.os_name} {cfg.hardware.os_version[:20]}")
    print(f"  Python       : {cfg.hardware.python_version}")
    print(f"  CPU Cores    : {cfg.hardware.cpu_count}")
    print(f"  RAM          : {cfg.hardware.system_ram_gb} GB")
    if cfg.hardware.is_gpu:
        print(f"  GPU          : {cfg.hardware.gpu_info.get('name', 'Unknown')}")
        print(f"  VRAM         : {cfg.hardware.gpu_info.get('vram_gb', '?')} GB")

    print(f"\n[TRAINING DEFAULTS]")
    print(f"  Model        : {cfg.training.model_weights}")
    print(f"  Epochs       : {cfg.training.epochs}")
    print(f"  Batch Size   : {cfg.training.batch_size}")
    print(f"  Image Size   : {cfg.training.image_size}x{cfg.training.image_size}")
    print(f"  Learning Rate: {cfg.training.learning_rate}")
    print(f"  Workers      : {cfg.training.workers}")
    print(f"  Augmentation : {cfg.training.augment}")

    print(f"\n[PATHS]")
    print(f"  AI Root      : {cfg.paths.ai_root}")
    print(f"  Dataset      : {cfg.paths.dataset_root}")
    print(f"  Weights      : {cfg.paths.weights_dir}")
    print(f"  Logs         : {cfg.paths.logs_dir}")
    print(f"  Outputs      : {cfg.paths.outputs_dir}")

    print(f"\n[CROPS REGISTERED]")
    for crop in cfg.supported_crops:
        crop_path = cfg.paths.get_crop_dataset_path(crop)
        exists = "✓" if crop_path.exists() else "✗ NOT FOUND"
        print(f"  {exists}  {crop}")

    print(f"\n[EXPORT]")
    print(f"  Format       : {cfg.export.format.upper()}")
    print(f"  ONNX Opset   : {cfg.export.opset_version}")
    print(f"  Simplify     : {cfg.export.simplify}")

    print("\n" + "=" * 60)
    print("  Configuration OK — Ready for training setup")
    print("=" * 60 + "\n")
