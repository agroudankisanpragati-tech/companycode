# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: predict.py
# Purpose: Run YOLOv8 classification inference on one or more images and
#          return structured prediction results with crop, category, class,
#          confidence, and top-5 alternatives.
#
# DESIGN PRINCIPLES:
#   • Zero hardcoded crop, disease, or pest names.
#     Crop and category metadata are resolved dynamically from
#     dataset_index.json built by dataset_indexer.py.
#   • Single Responsibility — this module ONLY runs inference and formats
#     results. It does NOT contain any disease solution logic, treatment
#     recommendations, or knowledge base lookups. Those belong to a
#     separate module (knowledge_base integration — future phase).
#   • REST-ready — PredictionResult is fully JSON-serialisable and
#     structured to match the API contract defined in the requirements.
#   • Graceful failure — every error path returns a PredictionResult
#     with status="error" rather than raising an exception to the caller.
#
# Output contract (single image):
#   {
#     "image_path":  "/abs/path/to/image.jpg",
#     "status":      "success" | "error",
#     "error":       null | "reason string",
#     "crop":        "green_gram",
#     "category":    "diseases",
#     "class_name":  "Yellow Mosaic",
#     "class_id":    42,
#     "confidence":  98.72,
#     "top5": [
#       {"rank": 1, "class_name": "Yellow Mosaic",  "class_id": 42, "confidence": 98.72},
#       {"rank": 2, "class_name": "Leaf Crinkle",   "class_id": 11, "confidence":  0.91},
#       ...
#     ],
#     "inference_ms": 34.5,
#     "model_path":  "/abs/path/to/best.pt"
#   }
#
# Dependencies:
#   pip install ultralytics torch pillow
#
# Run: python predict.py <image_path>   (single-image CLI test)
# =============================================================================

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from config import get_config
from constants import SUPPORTED_IMAGE_EXTENSIONS
from logger import get_logger
from model_manager import ModelHandle, get_model
from preprocessing import load_image, validate_array

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — RESULT DATA STRUCTURES
# =============================================================================

@dataclass
class Top5Entry:
    """
    One entry in the top-5 prediction list.

    Fields:
        rank        — 1-based rank (1 = highest confidence).
        class_name  — Human-readable class label from the model.
        class_id    — Integer label index from the model's names dict.
        confidence  — Confidence score as a percentage (0.0 – 100.0).
        crop        — Crop name resolved from dataset index (may be "" if unknown).
        category    — Category resolved from dataset index: "healthy" | "diseases"
                      | "pests" | "" if unknown.
    """
    rank:       int
    class_name: str
    class_id:   int
    confidence: float
    crop:       str = ""
    category:   str = ""


@dataclass
class PredictionResult:
    """
    The complete, structured result for one image prediction.

    This dataclass is the single output contract for predict.py.
    It is fully JSON-serialisable via asdict() and matches the
    API response schema required by the backend integration layer.

    Fields:
        image_path   — Absolute path to the input image.
        status       — "success" | "error".
        error        — None on success; human-readable reason string on error.
        crop         — Top-1 crop name (e.g. "green_gram").
        category     — Top-1 category: "healthy" | "diseases" | "pests".
        class_name   — Top-1 class label (e.g. "Yellow Mosaic").
        class_id     — Top-1 integer class index.
        confidence   — Top-1 confidence as a percentage (0.0 – 100.0).
        top5         — List of Top5Entry for the 5 highest-confidence classes.
        inference_ms — Wall-clock inference time in milliseconds.
        model_path   — Absolute path to the weights file used.
    """
    image_path:   str
    status:       str                    # "success" | "error"
    error:        Optional[str]          # None on success
    crop:         str
    category:     str
    class_name:   str
    class_id:     int
    confidence:   float
    top5:         list[Top5Entry]        = field(default_factory=list)
    inference_ms: float                  = 0.0
    model_path:   str                    = ""

    def to_dict(self) -> dict:
        """
        Serialises this result to a plain dict suitable for JSON encoding
        or direct return from a REST API endpoint.

        Returns:
            dict with all fields. top5 entries are also plain dicts.
        """
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        """
        Serialises this result to a JSON string.

        Args:
            indent: JSON indentation level. Use 0 for compact output.

        Returns:
            JSON string.
        """
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


def _error_result(image_path: str, reason: str) -> PredictionResult:
    """
    Constructs a PredictionResult representing a failed prediction.

    Used internally whenever validation, loading, or inference fails.
    Callers always receive a PredictionResult — never a raw exception.

    Args:
        image_path: Path string of the image that failed.
        reason:     Human-readable error description.

    Returns:
        PredictionResult with status="error".
    """
    log.warning("Prediction failed for %s: %s", Path(image_path).name, reason)
    return PredictionResult(
        image_path=image_path,
        status="error",
        error=reason,
        crop="",
        category="",
        class_name="",
        class_id=-1,
        confidence=0.0,
    )


# =============================================================================
# SECTION 2 — CLASS METADATA RESOLVER
# =============================================================================

# Module-level cache for the class → (crop, category) lookup table.
# Built once from dataset_index.json on first prediction call.
_class_meta_cache: Optional[dict[str, tuple[str, str]]] = None


def _load_class_metadata(index_path: Optional[Path] = None) -> dict[str, tuple[str, str]]:
    """
    Builds a lookup table mapping class_name → (crop_name, category)
    by reading dataset_index.json produced by dataset_indexer.py.

    This is the ONLY place where crop/category metadata is resolved.
    No crop names, disease names, or pest names are hardcoded here.
    The mapping is derived entirely from the dataset index at runtime.

    If the index file does not exist (e.g. before indexing has been run),
    an empty dict is returned and predictions will have empty crop/category.

    Args:
        index_path: Path to dataset_index.json. Defaults to
                    cfg.paths.outputs_dir / "dataset_index.json".

    Returns:
        Dict mapping class_name (str) → (crop_name, category) tuple.
    """
    cfg = get_config()
    path = index_path or (cfg.paths.outputs_dir / "dataset_index.json")

    if not path.exists():
        log.warning(
            "dataset_index.json not found at %s — crop/category will be empty. "
            "Run dataset_indexer.py to generate it.",
            path,
        )
        return {}

    try:
        with open(path, "r", encoding="utf-8") as fh:
            data: dict = json.load(fh)

        meta: dict[str, tuple[str, str]] = {}
        for record in data.get("images", []):
            class_name = record.get("class_name", "")
            crop_name  = record.get("crop_name", "")
            category   = record.get("category", "")
            if class_name and class_name not in meta:
                meta[class_name] = (crop_name, category)

        log.info(
            "Class metadata loaded: %d unique classes from %s",
            len(meta), path.name,
        )
        return meta

    except (json.JSONDecodeError, KeyError, OSError) as exc:
        log.warning("Cannot load class metadata from %s: %s", path, exc)
        return {}


def _get_class_metadata() -> dict[str, tuple[str, str]]:
    """
    Returns the cached class metadata dict, loading it on first call.

    Returns:
        Dict mapping class_name → (crop_name, category).
    """
    global _class_meta_cache
    if _class_meta_cache is None:
        _class_meta_cache = _load_class_metadata()
    return _class_meta_cache


def reload_class_metadata() -> None:
    """
    Forces a reload of the class metadata from dataset_index.json.

    Call this after running dataset_indexer.py to pick up new classes
    without restarting the process.
    """
    global _class_meta_cache
    _class_meta_cache = None
    log.info("Class metadata cache cleared — will reload on next prediction")


# =============================================================================
# SECTION 3 — IMAGE VALIDATOR
# =============================================================================

def validate_image_path(image_path: Path) -> tuple[bool, str]:
    """
    Validates that an image path is suitable for inference.

    Checks (in order):
      1. Path exists on disk.
      2. Path points to a regular file (not a directory).
      3. File extension is in SUPPORTED_IMAGE_EXTENSIONS.
      4. File is non-empty (size > 0 bytes).

    This is a fast pre-check. Full pixel-level validation is performed
    by load_image() and validate_array() from preprocessing.py.

    Args:
        image_path: Path to validate.

    Returns:
        (is_valid, reason) — True + "" if valid,
        False + human-readable reason if invalid.
    """
    if not image_path.exists():
        return False, f"Image file not found: {image_path}"
    if not image_path.is_file():
        return False, f"Path is not a file: {image_path}"
    if image_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        return False, (
            f"Unsupported image format '{image_path.suffix}'. "
            f"Supported: {', '.join(SUPPORTED_IMAGE_EXTENSIONS)}"
        )
    if image_path.stat().st_size == 0:
        return False, f"Image file is empty: {image_path}"
    return True, ""


# =============================================================================
# SECTION 4 — INFERENCE ENGINE
# =============================================================================

def _run_inference(
    image_path: Path,
    handle: ModelHandle,
) -> tuple[list[int], list[float]]:
    """
    Runs YOLOv8 classification inference on a single image.

    Uses the Ultralytics YOLO predict() API which handles its own
    internal preprocessing (resize, normalise) before the forward pass.
    We pass the raw image path directly — no manual tensor construction.

    Args:
        image_path: Absolute path to the image file.
        handle:     ModelHandle containing the loaded YOLO model.

    Returns:
        (top5_indices, top5_confidences) where:
          top5_indices      — list of up to 5 integer class indices,
                              ordered highest-confidence first.
          top5_confidences  — corresponding confidence scores in [0, 1].

    Raises:
        RuntimeError: If inference fails for any reason.
    """
    try:
        results = handle.model.predict(
            source=str(image_path),
            verbose=False,
            device=handle.device,
        )

        if not results:
            raise RuntimeError("YOLO predict() returned empty results")

        result = results[0]
        probs  = result.probs

        if probs is None:
            raise RuntimeError(
                "No classification probabilities in result — "
                "ensure the model is a classification model (cls task)"
            )

        # top5 indices and confidences (Ultralytics returns torch.Tensor)
        top5_idx   = probs.top5          # list[int] or Tensor
        top5_conf  = probs.top5conf      # Tensor of float32

        # Normalise to plain Python lists
        if hasattr(top5_idx, "tolist"):
            top5_idx = top5_idx.tolist()
        if hasattr(top5_conf, "tolist"):
            top5_conf = top5_conf.tolist()

        return list(top5_idx), list(top5_conf)

    except Exception as exc:
        raise RuntimeError(f"Inference failed: {exc}") from exc


# =============================================================================
# SECTION 5 — RESULT BUILDER
# =============================================================================

def _build_result(
    image_path: Path,
    top5_indices:  list[int],
    top5_confs:    list[float],
    handle:        ModelHandle,
    inference_ms:  float,
) -> PredictionResult:
    """
    Converts raw YOLO inference output into a structured PredictionResult.

    Resolves crop and category for each top-5 class by looking up the
    class name in the dataset index metadata. No crop/category names
    are hardcoded — all metadata comes from dataset_index.json.

    Args:
        image_path:    Path to the source image.
        top5_indices:  List of up to 5 integer class indices.
        top5_confs:    Corresponding confidence scores in [0, 1].
        handle:        ModelHandle used for inference.
        inference_ms:  Wall-clock inference time in milliseconds.

    Returns:
        Fully populated PredictionResult.
    """
    class_meta = _get_class_metadata()

    top5_entries: list[Top5Entry] = []

    for rank, (idx, conf) in enumerate(zip(top5_indices, top5_confs), start=1):
        class_name = handle.class_names.get(idx, f"class_{idx}")
        crop, category = class_meta.get(class_name, ("", ""))
        confidence_pct = round(float(conf) * 100.0, 4)

        top5_entries.append(Top5Entry(
            rank=rank,
            class_name=class_name,
            class_id=idx,
            confidence=confidence_pct,
            crop=crop,
            category=category,
        ))

    if not top5_entries:
        return _error_result(str(image_path), "No predictions returned by model")

    top1 = top5_entries[0]

    return PredictionResult(
        image_path=str(image_path),
        status="success",
        error=None,
        crop=top1.crop,
        category=top1.category,
        class_name=top1.class_name,
        class_id=top1.class_id,
        confidence=top1.confidence,
        top5=top5_entries,
        inference_ms=round(inference_ms, 2),
        model_path=str(handle.weights_path),
    )


# =============================================================================
# SECTION 6 — PUBLIC PREDICTION API
# =============================================================================

def predict(
    image_path: str | Path,
    weights_path: Optional[Path] = None,
    device: Optional[str] = None,
) -> PredictionResult:
    """
    Runs YOLOv8 classification inference on a single image and returns
    a structured PredictionResult.

    Pipeline:
      1. Validate image path (existence, extension, non-empty).
      2. Load pixel data and validate array shape.
      3. Load (or retrieve cached) model via model_manager.get_model().
      4. Run YOLO inference — returns top-5 class indices + confidences.
      5. Resolve crop and category from dataset_index.json metadata.
      6. Build and return PredictionResult.

    On any failure, returns a PredictionResult with status="error" and
    a human-readable error message. Never raises an exception to the caller.

    Args:
        image_path:   Path to the image file (str or Path).
        weights_path: Path to the .pt weights file. Defaults to
                      cfg.paths.checkpoints_dir / "best.pt".
        device:       Device override: "cpu" | "cuda" | "mps".
                      Defaults to cfg.hardware.device.

    Returns:
        PredictionResult — always returned, never raises.

    Usage:
        from predict import predict
        result = predict("/path/to/leaf.jpg")
        print(result.to_json())
        # {"crop": "green_gram", "category": "diseases", ...}
    """
    path = Path(image_path)

    # Step 1 — Validate path
    valid, reason = validate_image_path(path)
    if not valid:
        return _error_result(str(path), reason)

    # Step 2 — Validate pixel data (fast corruption check)
    array = load_image(path)
    if array is None:
        return _error_result(str(path), "Cannot load image — file may be corrupted")
    if not validate_array(array, path):
        return _error_result(str(path), "Invalid image array — unexpected shape or dtype")

    # Step 3 — Load model
    try:
        handle = get_model(weights_path=weights_path, device=device)
    except FileNotFoundError as exc:
        return _error_result(str(path), f"Model weights not found: {exc}")
    except RuntimeError as exc:
        return _error_result(str(path), f"Model load error: {exc}")

    # Step 4 — Run inference
    t_start = time.perf_counter()
    try:
        top5_idx, top5_conf = _run_inference(path, handle)
    except RuntimeError as exc:
        return _error_result(str(path), str(exc))
    inference_ms = (time.perf_counter() - t_start) * 1000.0

    # Step 5 + 6 — Build result
    result = _build_result(path, top5_idx, top5_conf, handle, inference_ms)

    log.info(
        "Prediction: %s → %s (%s) | conf=%.2f%% | %.1f ms",
        path.name,
        result.class_name,
        result.category or "unknown",
        result.confidence,
        result.inference_ms,
    )

    return result


def predict_batch(
    image_paths: list[str | Path],
    weights_path: Optional[Path] = None,
    device: Optional[str] = None,
) -> list[PredictionResult]:
    """
    Runs inference on a list of images and returns one PredictionResult
    per image, in the same order as the input list.

    Each image is processed independently. A failure on one image does
    not affect the others — failed images receive status="error" results.

    Args:
        image_paths:  List of image paths (str or Path).
        weights_path: Shared weights file for all images. Defaults to
                      cfg.paths.checkpoints_dir / "best.pt".
        device:       Device override for all images.

    Returns:
        List of PredictionResult, one per input image, same order.

    Usage:
        from predict import predict_batch
        results = predict_batch(["/img1.jpg", "/img2.jpg"])
        for r in results:
            print(r.class_name, r.confidence)
    """
    if not image_paths:
        log.warning("predict_batch called with empty image list")
        return []

    log.info("Batch prediction: %d images", len(image_paths))

    results: list[PredictionResult] = []
    for img_path in image_paths:
        result = predict(img_path, weights_path=weights_path, device=device)
        results.append(result)

    success_count = sum(1 for r in results if r.status == "success")
    log.info(
        "Batch complete: %d/%d succeeded",
        success_count, len(results),
    )
    return results


def predict_to_json(
    image_path: str | Path,
    weights_path: Optional[Path] = None,
    device: Optional[str] = None,
    indent: int = 2,
) -> str:
    """
    Convenience wrapper that runs predict() and returns the result
    directly as a JSON string.

    Designed for REST API endpoints that need to return a JSON response
    body without manually calling result.to_json().

    Args:
        image_path:   Path to the image file.
        weights_path: Optional weights file path.
        device:       Optional device override.
        indent:       JSON indentation (0 for compact, 2 for readable).

    Returns:
        JSON string of the PredictionResult.

    Usage:
        # In a FastAPI / Flask endpoint:
        json_str = predict_to_json(uploaded_file_path)
        return Response(json_str, media_type="application/json")
    """
    result = predict(image_path, weights_path=weights_path, device=device)
    return result.to_json(indent=indent)


# =============================================================================
# SECTION 7 — MAIN (CLI self-test)
# =============================================================================

if __name__ == "__main__":
    import sys

    cfg = get_config()

    print(f"\n{'='*60}")
    print("  AKP Predict — Self-Test")
    print(f"{'='*60}")
    print(f"  Device      : {cfg.hardware.device.upper()}")
    print(f"  Weights dir : {cfg.paths.checkpoints_dir}")

    # Resolve image path from CLI argument or find a sample
    if len(sys.argv) > 1:
        test_image = Path(sys.argv[1])
    else:
        test_image = None
        for img in cfg.paths.dataset_root.rglob("*"):
            if img.is_file() and img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                test_image = img
                break

    if test_image is None:
        print("\n  No test image found. Pass an image path as argument:")
        print("  python predict.py /path/to/image.jpg")
        print(f"{'='*60}\n")
        sys.exit(0)

    print(f"\n  Test image  : {test_image.name}")
    print(f"  Running prediction ...\n")

    result = predict(test_image)

    if result.status == "error":
        print(f"  ✗ Error: {result.error}")
    else:
        print(f"  ✓ Prediction successful")
        print(f"\n  Crop        : {result.crop or '(not resolved)'}")
        print(f"  Category    : {result.category or '(not resolved)'}")
        print(f"  Class       : {result.class_name}")
        print(f"  Confidence  : {result.confidence:.2f}%")
        print(f"  Inference   : {result.inference_ms:.1f} ms")
        print(f"\n  Top-5 Predictions:")
        print(f"  {'Rank':<5} {'Class':<40} {'Conf':>8}")
        print(f"  {'─'*5} {'─'*40} {'─'*8}")
        for entry in result.top5:
            print(
                f"  {entry.rank:<5} "
                f"{entry.class_name:<40} "
                f"{entry.confidence:>7.2f}%"
            )

    print(f"\n  Full JSON output:")
    print(result.to_json())
    print(f"{'='*60}\n")
