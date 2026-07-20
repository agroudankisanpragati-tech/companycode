# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: preprocessing.py
# Purpose: Image preprocessing pipeline applied to every image before it
#          enters the model. Converts raw image files into normalised
#          float32 tensors (or numpy arrays) ready for training/inference.
#
# DESIGN PRINCIPLES:
#   • Fully configurable through PreprocessingConfig in config.py.
#     No magic numbers anywhere in this file.
#   • Single responsibility: this module ONLY preprocesses images.
#     It does NOT augment, split, train, or run inference.
#   • Graceful failure: corrupted or unreadable images return None with
#     a logged warning — they never crash the pipeline.
#   • Letterbox resize preserves aspect ratio by padding with a fill
#     colour instead of stretching, which prevents distortion.
#   • Optional enhancements (CLAHE, histogram equalisation, denoising)
#     are applied before normalisation and are off by default.
#
# Dependencies:
#   pip install pillow numpy opencv-python-headless
#
# Run: python preprocessing.py   (self-test on a sample image)
# =============================================================================

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from config import PreprocessingConfig, get_config
from constants import (
    NORM_MODE_IMAGENET,
    NORM_MODE_MINMAX,
    NORM_MODE_NONE,
)
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — OPTIONAL DEPENDENCY GUARDS
# =============================================================================
# cv2 is required for CLAHE, denoising, and letterbox padding.
# Pillow is the primary image loader.
# Both are checked lazily so the module can be imported without crashing
# on machines where only one library is installed.

def _require_cv2(feature: str) -> "cv2":  # type: ignore[name-defined]
    """
    Imports and returns the cv2 module, raising a clear error if missing.

    Args:
        feature: Human-readable name of the feature that needs cv2.

    Returns:
        The cv2 module.

    Raises:
        ImportError: If opencv-python or opencv-python-headless is not installed.
    """
    try:
        import cv2
        return cv2
    except ImportError:
        raise ImportError(
            f"{feature} requires OpenCV. "
            "Install it with: pip install opencv-python-headless"
        )


def _require_pillow() -> "PIL.Image":  # type: ignore[name-defined]
    """
    Imports and returns PIL.Image, raising a clear error if missing.

    Returns:
        The PIL.Image module.

    Raises:
        ImportError: If Pillow is not installed.
    """
    try:
        from PIL import Image
        return Image
    except ImportError:
        raise ImportError(
            "Pillow is required for image loading. "
            "Install it with: pip install pillow"
        )


# =============================================================================
# SECTION 2 — RESULT DATACLASS
# =============================================================================

@dataclass
class PreprocessedImage:
    """
    The result of running one image through the preprocessing pipeline.

    Fields:
        array      — float32 numpy array of shape (H, W, 3) after all
                     preprocessing steps. Values depend on normalize_mode:
                       imagenet → roughly [-2.1, 2.6] per channel
                       minmax   → [0.0, 1.0]
                       none     → [0.0, 255.0] (float cast of uint8)
        image_path — Absolute path to the source image file.
        original_size — (width, height) of the image before resizing.
        final_size    — (width, height) after resize (always square).
        padded        — True if letterbox padding was applied.
    """
    array:         np.ndarray
    image_path:    str
    original_size: tuple[int, int]
    final_size:    tuple[int, int]
    padded:        bool


# =============================================================================
# SECTION 3 — IMAGE LOADER & VALIDATOR
# =============================================================================

def load_image(image_path: Path) -> Optional[np.ndarray]:
    """
    Loads an image from disk and converts it to an RGB uint8 numpy array.

    Uses Pillow as the primary loader because it handles a wider range of
    formats and EXIF orientation than cv2. Falls back gracefully on any
    error rather than crashing the pipeline.

    Steps:
      1. Open with Pillow.
      2. Convert to RGB (handles RGBA, L, P, CMYK, etc.).
      3. Return as uint8 numpy array of shape (H, W, 3).

    Args:
        image_path: Absolute path to the image file.

    Returns:
        uint8 numpy array (H, W, 3) in RGB order, or None if loading fails.
    """
    Image = _require_pillow()
    try:
        with Image.open(image_path) as img:
            rgb = img.convert("RGB")
            return np.array(rgb, dtype=np.uint8)
    except Exception as exc:
        log.warning("Cannot load image %s: %s", image_path.name, exc)
        return None


def validate_array(array: np.ndarray, image_path: Path) -> bool:
    """
    Validates that a loaded numpy array is a usable image.

    Checks:
      • Shape is (H, W, 3) — exactly 3 dimensions, 3 channels.
      • Both spatial dimensions are > 0.
      • dtype is uint8.

    Args:
        array:      The numpy array to validate.
        image_path: Path used only for logging context.

    Returns:
        True if the array is valid, False otherwise.
    """
    if array.ndim != 3 or array.shape[2] != 3:
        log.warning(
            "Invalid shape %s for %s — expected (H, W, 3)",
            array.shape, image_path.name,
        )
        return False
    if array.shape[0] == 0 or array.shape[1] == 0:
        log.warning("Zero-dimension image: %s", image_path.name)
        return False
    if array.dtype != np.uint8:
        log.warning(
            "Unexpected dtype %s for %s — expected uint8",
            array.dtype, image_path.name,
        )
        return False
    return True


# =============================================================================
# SECTION 4 — RESIZE STRATEGIES
# =============================================================================

def _cv2_interp(mode: str) -> int:
    """
    Maps an interpolation mode string to the corresponding cv2 constant.

    Args:
        mode: "bilinear" | "bicubic" | "nearest"

    Returns:
        cv2 interpolation flag integer.
    """
    cv2 = _require_cv2("resize")
    mapping = {
        "bilinear": cv2.INTER_LINEAR,
        "bicubic":  cv2.INTER_CUBIC,
        "nearest":  cv2.INTER_NEAREST,
    }
    flag = mapping.get(mode.lower())
    if flag is None:
        log.warning("Unknown interpolation '%s' — falling back to bilinear", mode)
        return cv2.INTER_LINEAR
    return flag


def resize_letterbox(
    array: np.ndarray,
    target_size: int,
    fill_color: tuple[int, int, int],
    interpolation: str,
) -> tuple[np.ndarray, bool]:
    """
    Resizes an image to a square target_size × target_size while preserving
    the original aspect ratio by padding the shorter dimension.

    This is the recommended resize strategy for classification models because
    it avoids distorting objects that have a strong aspect ratio (e.g. tall
    plants, wide leaves).

    Algorithm:
      1. Compute the scale factor = target_size / max(H, W).
      2. Scale both dimensions by this factor (no distortion).
      3. Pad the shorter dimension symmetrically with fill_color.

    Args:
        array:         uint8 RGB numpy array (H, W, 3).
        target_size:   Output square size in pixels.
        fill_color:    RGB tuple used for padding (default: ImageNet grey).
        interpolation: Resize interpolation mode string.

    Returns:
        (padded_array, was_padded) — uint8 array of shape
        (target_size, target_size, 3) and a bool indicating whether
        padding was actually applied.
    """
    cv2 = _require_cv2("letterbox resize")
    h, w = array.shape[:2]

    scale = target_size / max(h, w)
    new_w = round(w * scale)
    new_h = round(h * scale)

    resized = cv2.resize(
        array,
        (new_w, new_h),
        interpolation=_cv2_interp(interpolation),
    )

    # Pad to exact square
    pad_top    = (target_size - new_h) // 2
    pad_bottom = target_size - new_h - pad_top
    pad_left   = (target_size - new_w) // 2
    pad_right  = target_size - new_w - pad_left

    was_padded = (pad_top + pad_bottom + pad_left + pad_right) > 0

    # cv2 uses BGR internally but our array is RGB — fill colour is RGB
    fill_bgr = (fill_color[2], fill_color[1], fill_color[0])
    padded = cv2.copyMakeBorder(
        resized,
        pad_top, pad_bottom, pad_left, pad_right,
        cv2.BORDER_CONSTANT,
        value=fill_bgr,
    )
    return padded, was_padded


def resize_stretch(
    array: np.ndarray,
    target_size: int,
    interpolation: str,
) -> np.ndarray:
    """
    Resizes an image to target_size × target_size by stretching both
    dimensions. Faster than letterbox but may distort non-square images.

    Args:
        array:         uint8 RGB numpy array (H, W, 3).
        target_size:   Output square size in pixels.
        interpolation: Resize interpolation mode string.

    Returns:
        uint8 array of shape (target_size, target_size, 3).
    """
    cv2 = _require_cv2("stretch resize")
    return cv2.resize(
        array,
        (target_size, target_size),
        interpolation=_cv2_interp(interpolation),
    )


# =============================================================================
# SECTION 5 — OPTIONAL ENHANCEMENTS
# =============================================================================

def apply_clahe(
    array: np.ndarray,
    clip_limit: float,
    tile_grid_size: tuple[int, int],
) -> np.ndarray:
    """
    Applies CLAHE (Contrast Limited Adaptive Histogram Equalisation) to
    the L channel of the image in LAB colour space.

    CLAHE improves local contrast without over-amplifying noise, which
    helps the model distinguish subtle disease patterns on leaves.

    Args:
        array:          uint8 RGB numpy array (H, W, 3).
        clip_limit:     Threshold for contrast limiting (higher = more contrast).
        tile_grid_size: Size of the grid for histogram equalisation.

    Returns:
        uint8 RGB numpy array with enhanced contrast.
    """
    cv2 = _require_cv2("CLAHE")
    lab = cv2.cvtColor(array, cv2.COLOR_RGB2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_eq  = clahe.apply(l_ch)

    lab_eq = cv2.merge([l_eq, a_ch, b_ch])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)


def apply_histogram_equalization(array: np.ndarray) -> np.ndarray:
    """
    Applies global histogram equalisation to the V channel of the image
    in HSV colour space.

    Useful for images with poor lighting uniformity. Less adaptive than
    CLAHE — use CLAHE for most cases.

    Args:
        array: uint8 RGB numpy array (H, W, 3).

    Returns:
        uint8 RGB numpy array with equalised brightness channel.
    """
    cv2 = _require_cv2("histogram equalisation")
    hsv = cv2.cvtColor(array, cv2.COLOR_RGB2HSV)
    h_ch, s_ch, v_ch = cv2.split(hsv)
    v_eq = cv2.equalizeHist(v_ch)
    hsv_eq = cv2.merge([h_ch, s_ch, v_eq])
    return cv2.cvtColor(hsv_eq, cv2.COLOR_HSV2RGB)


def apply_denoising(array: np.ndarray, h: int) -> np.ndarray:
    """
    Applies fast non-local means denoising to reduce sensor noise and
    JPEG compression artefacts.

    Uses cv2.fastNlMeansDenoisingColored which operates on all three
    colour channels simultaneously.

    Args:
        array: uint8 RGB numpy array (H, W, 3).
        h:     Filter strength. Higher values remove more noise but may
               blur fine details. Typical range: 5–15.

    Returns:
        uint8 RGB numpy array after denoising.
    """
    cv2 = _require_cv2("denoising")
    # fastNlMeansDenoisingColored expects BGR
    bgr     = cv2.cvtColor(array, cv2.COLOR_RGB2BGR)
    denoised = cv2.fastNlMeansDenoisingColored(bgr, None, h, h, 7, 21)
    return cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)


# =============================================================================
# SECTION 6 — NORMALISATION
# =============================================================================

def normalize(
    array: np.ndarray,
    mode: str,
    mean: tuple[float, float, float],
    std:  tuple[float, float, float],
) -> np.ndarray:
    """
    Converts a uint8 RGB array to a normalised float32 array.

    Modes:
      imagenet — Divide by 255, subtract ImageNet mean, divide by std.
                 Produces values roughly in [-2.1, 2.6] per channel.
                 Required when using ImageNet-pretrained weights.
      minmax   — Divide by 255. Produces values in [0.0, 1.0].
      none     — Cast to float32 only. Values remain in [0.0, 255.0].

    Args:
        array: uint8 numpy array (H, W, 3).
        mode:  Normalisation mode string.
        mean:  Per-channel mean (used only for "imagenet" mode).
        std:   Per-channel std  (used only for "imagenet" mode).

    Returns:
        float32 numpy array (H, W, 3).

    Raises:
        ValueError: If mode is not one of the three supported values.
    """
    img = array.astype(np.float32)

    if mode == NORM_MODE_IMAGENET:
        img /= 255.0
        img -= np.array(mean, dtype=np.float32)
        img /= np.array(std,  dtype=np.float32)
    elif mode == NORM_MODE_MINMAX:
        img /= 255.0
    elif mode == NORM_MODE_NONE:
        pass  # already float32, values in [0, 255]
    else:
        raise ValueError(
            f"Unknown normalize_mode '{mode}'. "
            f"Expected one of: '{NORM_MODE_IMAGENET}', '{NORM_MODE_MINMAX}', '{NORM_MODE_NONE}'"
        )

    return img


# =============================================================================
# SECTION 7 — FULL PIPELINE
# =============================================================================

def preprocess_image(
    image_path: Path,
    cfg: Optional[PreprocessingConfig] = None,
) -> Optional[PreprocessedImage]:
    """
    Runs the complete preprocessing pipeline on a single image file.

    Pipeline order (each step is conditional on config flags):
      1. Load image from disk → uint8 RGB array
      2. Validate array shape and dtype
      3. Apply denoising          (if cfg.apply_denoise)
      4. Apply CLAHE              (if cfg.apply_clahe)
      5. Apply histogram eq.      (if cfg.apply_hist_eq)
      6. Resize (letterbox or stretch)
      7. Normalise to float32

    Steps 3–5 are applied before resize so enhancements operate at the
    original resolution for maximum quality.

    Args:
        image_path: Absolute path to the image file.
        cfg:        PreprocessingConfig. If None, uses cfg from get_config().

    Returns:
        PreprocessedImage on success, or None if the image cannot be loaded
        or is invalid. Callers must handle None gracefully.

    Usage:
        from preprocessing import preprocess_image
        result = preprocess_image(Path("/path/to/image.jpg"))
        if result is not None:
            tensor = result.array   # float32 (H, W, 3)
    """
    if cfg is None:
        cfg = get_config().preprocessing

    # Step 1 — Load
    array = load_image(image_path)
    if array is None:
        return None

    # Step 2 — Validate
    if not validate_array(array, image_path):
        return None

    original_h, original_w = array.shape[:2]
    original_size = (original_w, original_h)

    # Step 3 — Denoise (optional, before resize for full-res quality)
    if cfg.apply_denoise:
        try:
            array = apply_denoising(array, cfg.denoise_h)
        except Exception as exc:
            log.warning("Denoising failed for %s: %s — skipping", image_path.name, exc)

    # Step 4 — CLAHE (optional)
    if cfg.apply_clahe:
        try:
            array = apply_clahe(array, cfg.clahe_clip_limit, cfg.clahe_tile_grid)
        except Exception as exc:
            log.warning("CLAHE failed for %s: %s — skipping", image_path.name, exc)

    # Step 5 — Histogram equalisation (optional)
    if cfg.apply_hist_eq:
        try:
            array = apply_histogram_equalization(array)
        except Exception as exc:
            log.warning("Hist-eq failed for %s: %s — skipping", image_path.name, exc)

    # Step 6 — Resize
    padded = False
    if cfg.letterbox:
        array, padded = resize_letterbox(
            array,
            target_size=cfg.image_size,
            fill_color=cfg.fill_color,
            interpolation=cfg.interpolation,
        )
    else:
        array = resize_stretch(array, cfg.image_size, cfg.interpolation)

    final_size = (array.shape[1], array.shape[0])  # (W, H)

    # Step 7 — Normalise
    try:
        array = normalize(array, cfg.normalize_mode, cfg.imagenet_mean, cfg.imagenet_std)
    except ValueError as exc:
        log.error("Normalisation error for %s: %s", image_path.name, exc)
        return None

    return PreprocessedImage(
        array=array,
        image_path=str(image_path),
        original_size=original_size,
        final_size=final_size,
        padded=padded,
    )


def preprocess_batch(
    image_paths: list[Path],
    cfg: Optional[PreprocessingConfig] = None,
) -> tuple[np.ndarray, list[str]]:
    """
    Preprocesses a list of image paths and stacks valid results into a
    single float32 numpy array suitable for batch inference or training.

    Invalid images (load failures, corrupt files) are silently skipped
    and their paths are collected in the returned failed list.

    Args:
        image_paths: List of absolute image Paths to preprocess.
        cfg:         PreprocessingConfig. If None, uses cfg from get_config().

    Returns:
        (batch_array, failed_paths) where:
          batch_array  — float32 array of shape (N, H, W, 3), N = valid images.
                         Empty array of shape (0,) if all images failed.
          failed_paths — list of path strings that could not be processed.

    Usage:
        from preprocessing import preprocess_batch
        batch, failed = preprocess_batch(paths)
        # batch.shape → (N, 224, 224, 3)
    """
    if cfg is None:
        cfg = get_config().preprocessing

    arrays:  list[np.ndarray] = []
    failed:  list[str]        = []

    for path in image_paths:
        result = preprocess_image(path, cfg)
        if result is not None:
            arrays.append(result.array)
        else:
            failed.append(str(path))

    if not arrays:
        log.warning("preprocess_batch: all %d images failed", len(image_paths))
        return np.empty(0, dtype=np.float32), failed

    batch = np.stack(arrays, axis=0)
    log.debug(
        "preprocess_batch: %d/%d succeeded, shape=%s",
        len(arrays), len(image_paths), batch.shape,
    )
    return batch, failed


# =============================================================================
# SECTION 8 — MAIN (self-test)
# =============================================================================

if __name__ == "__main__":
    import sys

    cfg_obj = get_config()
    pre_cfg = cfg_obj.preprocessing

    print(f"\n{'='*60}")
    print("  AKP Preprocessing — Self-Test")
    print(f"{'='*60}")
    print(f"  Image size    : {pre_cfg.image_size}x{pre_cfg.image_size}")
    print(f"  Letterbox     : {pre_cfg.letterbox}")
    print(f"  Norm mode     : {pre_cfg.normalize_mode}")
    print(f"  CLAHE         : {pre_cfg.apply_clahe}")
    print(f"  Hist-eq       : {pre_cfg.apply_hist_eq}")
    print(f"  Denoise       : {pre_cfg.apply_denoise}")
    print(f"  Interpolation : {pre_cfg.interpolation}")

    # Find the first available image in the dataset for a live test
    dataset_root = cfg_obj.paths.dataset_root
    sample: Optional[Path] = None
    for img_file in dataset_root.rglob("*"):
        if img_file.is_file() and img_file.suffix.lower() in (".jpg", ".jpeg", ".png"):
            sample = img_file
            break

    if sample is None:
        print("\n  No images found in dataset — skipping live test")
        sys.exit(0)

    print(f"\n  Sample image  : {sample.name}")
    result = preprocess_image(sample, pre_cfg)

    if result is None:
        print("  FAILED — could not preprocess sample image")
        sys.exit(1)

    print(f"  Original size : {result.original_size[0]}x{result.original_size[1]}")
    print(f"  Final size    : {result.final_size[0]}x{result.final_size[1]}")
    print(f"  Padded        : {result.padded}")
    print(f"  Array shape   : {result.array.shape}")
    print(f"  Array dtype   : {result.array.dtype}")
    print(f"  Value range   : [{result.array.min():.4f}, {result.array.max():.4f}]")
    print(f"\n  ✓ Preprocessing pipeline OK")
    print(f"{'='*60}\n")
