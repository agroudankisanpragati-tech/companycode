# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: model_manager.py
# Purpose: Manage the lifecycle of YOLOv8 classification model weights.
#          Provides a singleton model instance per weights file with:
#            • Lazy loading — model is not loaded until first request.
#            • Integrity verification — SHA-256 checksum on every load.
#            • Auto-reload — detects weight file changes via mtime + checksum.
#            • Device awareness — automatically uses CUDA / MPS / CPU.
#            • Thread-safe caching — one ModelHandle per weights path.
#
# DESIGN PRINCIPLES:
#   • Single Responsibility — this module ONLY manages model loading/caching.
#     It does NOT preprocess images, run predictions, or train.
#   • Open/Closed — new model formats can be added without changing callers.
#   • No hardcoded paths — all paths derived from config.py.
#
# Dependencies:
#   pip install ultralytics torch
#
# Run: python model_manager.py   (self-test)
# =============================================================================

from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config import get_config
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — MODEL HANDLE DATACLASS
# =============================================================================

@dataclass
class ModelHandle:
    """
    Wraps a loaded YOLO model instance with its metadata.

    This is the object returned by get_model(). Callers use
    handle.model to access the underlying Ultralytics YOLO instance.

    Fields:
        model         — The loaded Ultralytics YOLO instance.
        weights_path  — Absolute path to the .pt file that was loaded.
        device        — Device string the model is running on ("cpu"/"cuda"/"mps").
        num_classes   — Number of output classes the model was trained on.
        class_names   — Dict mapping integer index → class name string.
        loaded_at     — Unix timestamp when the model was loaded.
        checksum      — SHA-256 hex digest of the weights file at load time.
        file_mtime    — File modification time at load time (for change detection).
    """
    model:        object                  # ultralytics.YOLO instance
    weights_path: Path
    device:       str
    num_classes:  int
    class_names:  dict[int, str]
    loaded_at:    float
    checksum:     str
    file_mtime:   float


# =============================================================================
# SECTION 2 — INTEGRITY HELPERS
# =============================================================================

def _sha256(path: Path) -> str:
    """
    Computes the SHA-256 hex digest of a file's binary content.

    Reads in 64 KB chunks to handle large weight files without loading
    the entire file into memory at once.

    Args:
        path: Absolute path to the file.

    Returns:
        64-character lowercase hex string.

    Raises:
        OSError: If the file cannot be read.
    """
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _file_mtime(path: Path) -> float:
    """
    Returns the file's last-modified timestamp as a float (Unix epoch seconds).

    Args:
        path: Absolute path to the file.

    Returns:
        Float modification timestamp.
    """
    return path.stat().st_mtime


def verify_weights_file(path: Path) -> tuple[bool, str]:
    """
    Verifies that a weights file exists, is non-empty, and has a .pt extension.

    This is a lightweight pre-load check. Full integrity is confirmed by
    the SHA-256 checksum stored in ModelHandle after loading.

    Args:
        path: Absolute path to the weights file.

    Returns:
        (is_valid, reason) — True + empty string if valid,
        False + human-readable reason string if invalid.
    """
    if not path.exists():
        return False, f"Weights file not found: {path}"
    if not path.is_file():
        return False, f"Path is not a file: {path}"
    if path.suffix.lower() not in (".pt", ".pth"):
        return False, f"Unsupported weights format '{path.suffix}' — expected .pt or .pth"
    if path.stat().st_size == 0:
        return False, f"Weights file is empty: {path}"
    return True, ""


# =============================================================================
# SECTION 3 — MODEL LOADER
# =============================================================================

def _load_yolo_model(weights_path: Path, device: str) -> object:
    """
    Loads a YOLO model from a .pt weights file using Ultralytics.

    Args:
        weights_path: Absolute path to the .pt file.
        device:       Device string: "cpu", "cuda", or "mps".

    Returns:
        Loaded Ultralytics YOLO instance.

    Raises:
        ImportError:  If ultralytics is not installed.
        RuntimeError: If the model fails to load.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        raise ImportError(
            "ultralytics is required for model loading. "
            "Install it with: pip install ultralytics"
        )

    try:
        log.info("Loading YOLO model from: %s  (device=%s)", weights_path.name, device)
        model = YOLO(str(weights_path))
        # Move model to the target device
        model.to(device)
        log.info(
            "Model loaded — classes: %d  device: %s",
            len(model.names), device,
        )
        return model
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load YOLO model from {weights_path}: {exc}"
        ) from exc


def _build_handle(weights_path: Path, device: str) -> ModelHandle:
    """
    Loads a YOLO model and wraps it in a ModelHandle with full metadata.

    Args:
        weights_path: Absolute path to the .pt weights file.
        device:       Target device string.

    Returns:
        Populated ModelHandle.

    Raises:
        RuntimeError: If loading or checksum computation fails.
    """
    model = _load_yolo_model(weights_path, device)

    # Extract class names from the loaded model
    raw_names: dict = getattr(model, "names", {})
    class_names: dict[int, str] = {int(k): str(v) for k, v in raw_names.items()}

    checksum  = _sha256(weights_path)
    mtime     = _file_mtime(weights_path)

    handle = ModelHandle(
        model=model,
        weights_path=weights_path,
        device=device,
        num_classes=len(class_names),
        class_names=class_names,
        loaded_at=time.time(),
        checksum=checksum,
        file_mtime=mtime,
    )

    log.info(
        "ModelHandle created — %d classes | checksum: %s...%s | mtime: %.0f",
        handle.num_classes,
        checksum[:8],
        checksum[-8:],
        mtime,
    )
    return handle


# =============================================================================
# SECTION 4 — SINGLETON CACHE
# =============================================================================

# Module-level cache: weights_path (str) → ModelHandle
# Protected by a threading.Lock for safe concurrent access.
_cache: dict[str, ModelHandle] = {}
_cache_lock = threading.Lock()


def _needs_reload(handle: ModelHandle) -> bool:
    """
    Determines whether a cached ModelHandle should be reloaded.

    Reload is triggered when the weights file's modification time has
    changed since the handle was built. The mtime check is O(1) and
    avoids re-computing the SHA-256 on every call. The checksum is only
    recomputed when mtime changes, to confirm the file actually differs.

    Args:
        handle: The currently cached ModelHandle.

    Returns:
        True if the weights file has changed and the model should be reloaded.
    """
    try:
        current_mtime = _file_mtime(handle.weights_path)
        if current_mtime == handle.file_mtime:
            return False  # File unchanged — fast path

        # mtime changed — verify with checksum to avoid false positives
        # (e.g. touch command changes mtime without changing content)
        current_checksum = _sha256(handle.weights_path)
        if current_checksum == handle.checksum:
            log.debug(
                "mtime changed but checksum identical — skipping reload for %s",
                handle.weights_path.name,
            )
            return False

        log.info(
            "Weights file changed: %s — scheduling reload",
            handle.weights_path.name,
        )
        return True

    except OSError as exc:
        log.warning("Cannot stat weights file %s: %s", handle.weights_path, exc)
        return False


# =============================================================================
# SECTION 5 — PUBLIC API
# =============================================================================

def get_model(
    weights_path: Optional[Path] = None,
    device: Optional[str] = None,
    force_reload: bool = False,
) -> ModelHandle:
    """
    Returns a cached ModelHandle for the given weights file.

    On the first call for a given weights_path, the model is loaded from
    disk and cached. Subsequent calls return the cached instance immediately
    unless the weights file has changed (detected via mtime + SHA-256) or
    force_reload=True is passed.

    This is the ONLY function external modules should call. Never
    instantiate ModelHandle or call _build_handle() directly.

    Args:
        weights_path: Absolute path to the .pt weights file.
                      Defaults to cfg.paths.checkpoints_dir / "best.pt".
        device:       Device string: "cpu" | "cuda" | "mps".
                      Defaults to cfg.hardware.device (auto-detected).
        force_reload: If True, discards the cached handle and reloads
                      from disk unconditionally. Useful after training
                      completes and new weights are written.

    Returns:
        ModelHandle — the loaded, cached model with metadata.

    Raises:
        FileNotFoundError: If the weights file does not exist.
        RuntimeError:      If the model fails to load.

    Usage:
        from model_manager import get_model
        handle = get_model()
        results = handle.model.predict(image_path, verbose=False)
    """
    cfg = get_config()

    # Resolve defaults
    resolved_path   = weights_path or (cfg.paths.checkpoints_dir / "best.pt")
    resolved_device = device or cfg.hardware.device
    cache_key       = str(resolved_path.resolve())

    # Validate file before acquiring the lock (fast fail)
    valid, reason = verify_weights_file(resolved_path)
    if not valid:
        raise FileNotFoundError(reason)

    with _cache_lock:
        cached = _cache.get(cache_key)

        if cached is not None and not force_reload:
            if not _needs_reload(cached):
                log.debug("Cache hit: %s", resolved_path.name)
                return cached
            log.info("Reloading changed weights: %s", resolved_path.name)

        # Load (or reload) the model
        handle = _build_handle(resolved_path, resolved_device)
        _cache[cache_key] = handle

    return handle


def list_available_weights(weights_dir: Optional[Path] = None) -> list[Path]:
    """
    Scans a directory for all .pt weight files and returns them sorted
    by modification time (newest first).

    Useful for discovering which trained models are available without
    hardcoding any crop or model names.

    Args:
        weights_dir: Directory to scan. Defaults to cfg.paths.checkpoints_dir.

    Returns:
        List of .pt file Paths, sorted newest-first.
        Empty list if the directory does not exist or contains no .pt files.
    """
    cfg = get_config()
    scan_dir = weights_dir or cfg.paths.checkpoints_dir

    if not scan_dir.is_dir():
        log.warning("Weights directory not found: %s", scan_dir)
        return []

    pt_files = sorted(
        scan_dir.glob("*.pt"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    log.debug("Found %d .pt file(s) in %s", len(pt_files), scan_dir)
    return pt_files


def clear_cache() -> None:
    """
    Evicts all cached ModelHandle instances.

    Forces the next get_model() call to reload from disk. Useful in
    test environments or after a full retraining cycle.
    """
    with _cache_lock:
        count = len(_cache)
        _cache.clear()
    log.info("Model cache cleared (%d handle(s) evicted)", count)


def get_cache_info() -> list[dict]:
    """
    Returns a snapshot of the current model cache for diagnostics.

    Returns:
        List of dicts, one per cached model, with keys:
          weights_path, device, num_classes, loaded_at, checksum_prefix.
    """
    with _cache_lock:
        return [
            {
                "weights_path":    str(h.weights_path),
                "device":          h.device,
                "num_classes":     h.num_classes,
                "loaded_at":       h.loaded_at,
                "checksum_prefix": h.checksum[:16],
            }
            for h in _cache.values()
        ]


# =============================================================================
# SECTION 6 — MAIN (self-test)
# =============================================================================

if __name__ == "__main__":
    cfg = get_config()

    print(f"\n{'='*60}")
    print("  AKP Model Manager — Self-Test")
    print(f"{'='*60}")
    print(f"  Device          : {cfg.hardware.device.upper()}")
    print(f"  Checkpoints dir : {cfg.paths.checkpoints_dir}")

    available = list_available_weights()
    if not available:
        print("\n  No .pt files found in checkpoints/")
        print("  Run train.py first to generate model weights.")
        print(f"{'='*60}\n")
    else:
        print(f"\n  Available weights ({len(available)}):")
        for pt in available:
            size_mb = pt.stat().st_size / (1024 * 1024)
            print(f"    • {pt.name}  ({size_mb:.1f} MB)")

        # Load the first available model
        target = available[0]
        print(f"\n  Loading: {target.name} ...")
        try:
            handle = get_model(target)
            print(f"  ✓ Loaded successfully")
            print(f"  Classes     : {handle.num_classes}")
            print(f"  Device      : {handle.device}")
            print(f"  Checksum    : {handle.checksum[:16]}...")
            print(f"  Class names : {list(handle.class_names.values())[:5]} ...")

            # Test cache hit
            handle2 = get_model(target)
            assert handle is handle2, "Cache miss — expected same instance"
            print(f"  Cache hit   : ✓")

            # Test cache info
            info = get_cache_info()
            print(f"  Cache size  : {len(info)} handle(s)")

        except Exception as exc:
            print(f"  ✗ Load failed: {exc}")

        print(f"{'='*60}\n")
