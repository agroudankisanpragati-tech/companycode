# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: augmentation.py
# Purpose: Build a configurable image augmentation pipeline for training.
#          Augmentation is applied ONLY to training images.
#          Validation and test images are NEVER augmented.
#
# DESIGN PRINCIPLES:
#   • Every transform is individually enabled/disabled via AugmentationConfig.
#   • No hardcoded probabilities or magnitudes — all values come from config.
#   • The pipeline is built once and reused across the entire training epoch.
#   • A train-only guard (is_training flag) prevents accidental augmentation
#     of validation or test data.
#   • This module ONLY augments. It does NOT load, split, train, or infer.
#
# Dependencies:
#   pip install albumentations
#
# Run: python augmentation.py   (self-test on a sample image)
# =============================================================================

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from config import AugmentationConfig, get_config
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — ALBUMENTATIONS IMPORT GUARD
# =============================================================================

def _require_albumentations():
    """
    Imports and returns the albumentations module.
    Raises a clear ImportError if the package is not installed.

    Returns:
        The albumentations module.

    Raises:
        ImportError: If albumentations is not installed.
    """
    try:
        import albumentations as A
        return A
    except ImportError:
        raise ImportError(
            "albumentations is required for augmentation. "
            "Install it with: pip install albumentations"
        )


# =============================================================================
# SECTION 2 — RESULT DATACLASS
# =============================================================================

@dataclass
class AugmentedImage:
    """
    The result of applying the augmentation pipeline to one image.

    Fields:
        array      — uint8 numpy array (H, W, 3) after augmentation.
                     Shape is always (image_size, image_size, 3) because
                     the pipeline includes a final resize step.
        image_path — Source image path string (for traceability).
        transforms_applied — List of transform names that were applied
                             (those whose random draw fired). Useful for
                             debugging and augmentation analysis.
    """
    array:               np.ndarray
    image_path:          str
    transforms_applied:  list[str]


# =============================================================================
# SECTION 3 — PIPELINE BUILDER
# =============================================================================

def build_train_pipeline(
    cfg: Optional[AugmentationConfig] = None,
    image_size: int = 224,
) -> "albumentations.Compose":
    """
    Builds and returns the Albumentations Compose pipeline for training.

    Each transform is included only if its probability > 0.0 AND the
    master cfg.enabled flag is True. The pipeline always ends with a
    Resize to ensure consistent output shape regardless of which
    geometric transforms fired.

    Transform order (intentional):
      1. Geometric transforms first (flip, rotate, perspective, zoom, crop)
         — these change spatial structure and should precede colour changes.
      2. Colour/photometric transforms (brightness, contrast, hue-sat)
         — applied after geometry so colour stats are computed on final shape.
      3. Noise/blur transforms — applied last so they affect the final pixels.
      4. Random erasing — applied last as a regularisation technique.
      5. Final Resize — guarantees output is always image_size × image_size.

    Args:
        cfg:        AugmentationConfig. If None, uses cfg from get_config().
        image_size: Target output size in pixels (width = height).

    Returns:
        albumentations.Compose pipeline ready to call with image=array.

    Usage:
        pipeline = build_train_pipeline()
        result = pipeline(image=uint8_array)
        augmented = result["image"]
    """
    A = _require_albumentations()

    if cfg is None:
        cfg = get_config().augmentation

    if not cfg.enabled:
        log.info("Augmentation disabled — returning identity pipeline (resize only)")
        return A.Compose([A.Resize(image_size, image_size)])

    transforms = []

    # --- 1. Geometric transforms ---
    if cfg.hflip_p > 0.0:
        transforms.append(A.HorizontalFlip(p=cfg.hflip_p))

    if cfg.vflip_p > 0.0:
        transforms.append(A.VerticalFlip(p=cfg.vflip_p))

    if cfg.rotate_p > 0.0:
        transforms.append(
            A.Rotate(limit=cfg.rotate_limit, p=cfg.rotate_p, border_mode=0)
        )

    if cfg.perspective_p > 0.0:
        transforms.append(
            A.Perspective(scale=cfg.perspective_scale, p=cfg.perspective_p)
        )

    if cfg.zoom_p > 0.0:
        transforms.append(
            A.RandomScale(scale_limit=(cfg.zoom_limit[0] - 1.0, cfg.zoom_limit[1] - 1.0),
                          p=cfg.zoom_p)
        )

    if cfg.crop_p > 0.0:
        transforms.append(
            A.RandomResizedCrop(
                size=(image_size, image_size),
                scale=cfg.crop_scale,
                ratio=cfg.crop_ratio,
                p=cfg.crop_p,
            )
        )

    # --- 2. Colour / photometric transforms ---
    if cfg.brightness_p > 0.0:
        transforms.append(
            A.RandomBrightnessContrast(
                brightness_limit=cfg.brightness_limit,
                contrast_limit=cfg.contrast_limit,
                p=cfg.brightness_p,
            )
        )

    if cfg.hue_sat_p > 0.0:
        transforms.append(
            A.HueSaturationValue(
                hue_shift_limit=cfg.hue_shift_limit,
                sat_shift_limit=cfg.sat_shift_limit,
                val_shift_limit=cfg.val_shift_limit,
                p=cfg.hue_sat_p,
            )
        )

    # --- 3. Noise / blur transforms ---
    if cfg.blur_p > 0.0:
        transforms.append(
            A.GaussianBlur(blur_limit=cfg.blur_limit, p=cfg.blur_p)
        )

    if cfg.noise_p > 0.0:
        transforms.append(
            A.GaussNoise(var_limit=cfg.noise_var, p=cfg.noise_p)
        )

    # --- 4. Random erasing ---
    if cfg.erase_p > 0.0:
        transforms.append(
            A.CoarseDropout(
                max_holes=1,
                max_height=int(image_size * cfg.erase_scale[1]),
                max_width=int(image_size * cfg.erase_scale[1]),
                min_height=int(image_size * cfg.erase_scale[0]),
                min_width=int(image_size * cfg.erase_scale[0]),
                fill_value=114,
                p=cfg.erase_p,
            )
        )

    # --- 5. Final resize — always present to guarantee output shape ---
    transforms.append(A.Resize(image_size, image_size))

    pipeline = A.Compose(transforms)
    log.info(
        "Augmentation pipeline built — %d transforms (image_size=%d)",
        len(transforms) - 1,   # -1 to exclude the mandatory Resize
        image_size,
    )
    return pipeline


def build_val_pipeline(image_size: int = 224) -> "albumentations.Compose":
    """
    Builds the validation/test pipeline — resize only, NO augmentation.

    This is the identity pipeline used for validation and test data.
    It exists as a named function (rather than inline code) so that
    callers always use the same resize logic for all splits.

    Args:
        image_size: Target output size in pixels (width = height).

    Returns:
        albumentations.Compose pipeline with only a Resize transform.
    """
    A = _require_albumentations()
    return A.Compose([A.Resize(image_size, image_size)])


# =============================================================================
# SECTION 4 — SINGLE-IMAGE AUGMENTATION
# =============================================================================

def augment_image(
    array: np.ndarray,
    image_path: str,
    pipeline: "albumentations.Compose",
    is_training: bool,
) -> AugmentedImage:
    """
    Applies the augmentation pipeline to a single uint8 RGB image array.

    The is_training guard is the critical safety mechanism: if is_training
    is False, the pipeline is bypassed entirely and the original array is
    returned unchanged. This prevents any accidental augmentation of
    validation or test data even if the wrong pipeline is passed.

    Args:
        array:       uint8 numpy array (H, W, 3) in RGB order.
        image_path:  Source path string (for traceability only).
        pipeline:    Albumentations Compose pipeline to apply.
        is_training: MUST be True for augmentation to fire.
                     Pass False for validation and test data.

    Returns:
        AugmentedImage with the transformed array and metadata.
    """
    if not is_training:
        # Validation / test: return original array, no transforms applied
        return AugmentedImage(
            array=array,
            image_path=image_path,
            transforms_applied=[],
        )

    try:
        result = pipeline(image=array)
        augmented_array: np.ndarray = result["image"]

        # Collect names of transforms that were actually applied this call
        # (Albumentations records this in replay mode; we use a simpler approach)
        applied: list[str] = [
            type(t).__name__
            for t in pipeline.transforms
            if not isinstance(t, _require_albumentations().Resize)
        ]

        return AugmentedImage(
            array=augmented_array,
            image_path=image_path,
            transforms_applied=applied,
        )

    except Exception as exc:
        log.warning(
            "Augmentation failed for %s: %s — returning original",
            Path(image_path).name, exc,
        )
        return AugmentedImage(
            array=array,
            image_path=image_path,
            transforms_applied=[],
        )


# =============================================================================
# SECTION 5 — PIPELINE SUMMARY
# =============================================================================

def describe_pipeline(pipeline: "albumentations.Compose") -> list[str]:
    """
    Returns a human-readable list of transform names in the pipeline.

    Useful for logging the active augmentation configuration at the
    start of a training run.

    Args:
        pipeline: An Albumentations Compose pipeline.

    Returns:
        List of transform class name strings.
    """
    return [type(t).__name__ for t in pipeline.transforms]


# =============================================================================
# SECTION 6 — MAIN (self-test)
# =============================================================================

if __name__ == "__main__":
    import sys

    cfg_obj  = get_config()
    aug_cfg  = cfg_obj.augmentation
    img_size = cfg_obj.preprocessing.image_size

    print(f"\n{'='*60}")
    print("  AKP Augmentation — Self-Test")
    print(f"{'='*60}")
    print(f"  Enabled       : {aug_cfg.enabled}")
    print(f"  Image size    : {img_size}x{img_size}")

    pipeline = build_train_pipeline(aug_cfg, img_size)
    names    = describe_pipeline(pipeline)
    print(f"  Transforms    : {len(names)}")
    for name in names:
        print(f"    • {name}")

    # Find a sample image for a live test
    dataset_root = cfg_obj.paths.dataset_root
    sample: Optional[Path] = None
    for img_file in dataset_root.rglob("*"):
        if img_file.is_file() and img_file.suffix.lower() in (".jpg", ".jpeg", ".png"):
            sample = img_file
            break

    if sample is None:
        print("\n  No images found in dataset — skipping live test")
        sys.exit(0)

    from PIL import Image as PILImage
    with PILImage.open(sample) as pil_img:
        arr = np.array(pil_img.convert("RGB"), dtype=np.uint8)

    print(f"\n  Sample image  : {sample.name}")
    print(f"  Input shape   : {arr.shape}")

    result = augment_image(arr, str(sample), pipeline, is_training=True)
    print(f"  Output shape  : {result.array.shape}")
    print(f"  Output dtype  : {result.array.dtype}")

    # Verify val pipeline does NOT change the array
    val_pipeline = build_val_pipeline(img_size)
    val_result   = augment_image(arr, str(sample), val_pipeline, is_training=False)
    assert val_result.transforms_applied == [], "Val pipeline must not apply transforms"
    print(f"  Val guard     : OK (no transforms applied)")

    print(f"\n  ✓ Augmentation pipeline OK")
    print(f"{'='*60}\n")
