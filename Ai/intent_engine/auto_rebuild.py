# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: intent_engine/auto_rebuild.py
# Purpose: SELF-MAINTAINING PIPELINE
#   Detects when any JSON/CSV dataset file has changed since the model was
#   last trained, then automatically:
#     1. Rebuilds the dataset  (DatasetBuilder)
#     2. Retrains the model    (Trainer)
#     3. Reloads the predictor singleton (clears stale in-memory model)
#     4. Clears the alias resolver cache
#
#   Called automatically at server startup and can be triggered manually.
#   Thread-safe. Never crashes the server — all errors are logged.
#
# Usage:
#   from intent_engine.auto_rebuild import ensure_model_is_current
#   ensure_model_is_current()   # call at startup
# =============================================================================

from __future__ import annotations

import hashlib
import json
import logging
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

_AI_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from intent_engine.config import get_config

_log = logging.getLogger("akp.intent.auto_rebuild")
if not _log.handlers:
    _log.setLevel(logging.INFO)
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    _log.addHandler(_h)
    _log.propagate = False

_rebuild_lock = threading.Lock()


# ---------------------------------------------------------------------------
# DATASET FINGERPRINT
# ---------------------------------------------------------------------------

def _compute_dataset_fingerprint(datasets_dir: Path) -> str:
    """
    Computes a SHA-256 fingerprint of all dataset files.
    Any addition, modification, or deletion changes the fingerprint.
    """
    h = hashlib.sha256()
    supported = {".json", ".csv", ".txt", ".docx"}

    for path in sorted(datasets_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in supported:
            rel = str(path.relative_to(datasets_dir))
            h.update(rel.encode("utf-8"))
            try:
                stat = path.stat()
                h.update(str(stat.st_size).encode())
                h.update(str(stat.st_mtime).encode())
            except OSError:
                pass

    return h.hexdigest()


def _load_stored_fingerprint(fingerprint_path: Path) -> str:
    """Loads the fingerprint stored after the last successful build."""
    if not fingerprint_path.exists():
        return ""
    try:
        data = json.loads(fingerprint_path.read_text(encoding="utf-8"))
        return data.get("fingerprint", "")
    except Exception:
        return ""


def _save_fingerprint(fingerprint_path: Path, fingerprint: str) -> None:
    """Saves the current fingerprint after a successful build."""
    fingerprint_path.parent.mkdir(parents=True, exist_ok=True)
    fingerprint_path.write_text(
        json.dumps({
            "fingerprint": fingerprint,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# REBUILD PIPELINE
# ---------------------------------------------------------------------------

def _rebuild_and_retrain() -> bool:
    """
    Runs the full rebuild pipeline:
      1. Build dataset from all JSON/CSV files
      2. Retrain the classifier
      3. Reload the predictor singleton

    Returns True on success, False on any failure.
    """
    try:
        _log.info("AUTO-REBUILD | Step 1: Building dataset from all JSON/CSV files ...")
        from intent_engine.dataset_builder import DatasetBuilder
        cfg = get_config()
        builder = DatasetBuilder(cfg=cfg)
        result = builder.build()
        _log.info(
            "AUTO-REBUILD | Dataset built — total_clean=%d  intents=%d  failed_files=%d",
            result.total_clean,
            len([k for k, v in result.per_intent.items() if v > 0]),
            len(result.failed_files),
        )
        for intent, count in sorted(result.per_intent.items()):
            _log.info("AUTO-REBUILD |   %-15s : %d samples", intent, count)
        if result.failed_files:
            for f in result.failed_files:
                _log.warning("AUTO-REBUILD |   FAILED: %s", f)
    except Exception as exc:
        _log.error("AUTO-REBUILD | Dataset build FAILED: %s", exc, exc_info=True)
        return False

    try:
        _log.info("AUTO-REBUILD | Step 2: Retraining classifier ...")
        from intent_engine.trainer import Trainer
        cfg = get_config()
        trainer = Trainer(cfg=cfg)
        train_result = trainer.train(rebuild_dataset=False)
        _log.info(
            "AUTO-REBUILD | Training complete — "
            "model=%s  classes=%d  train=%d  val_acc=%.4f  test_acc=%.4f",
            train_result.model_type,
            train_result.num_classes,
            train_result.train_size,
            train_result.val_metrics.get("accuracy", 0.0),
            train_result.test_metrics.get("accuracy", 0.0),
        )
    except Exception as exc:
        _log.error("AUTO-REBUILD | Training FAILED: %s", exc, exc_info=True)
        return False

    try:
        _log.info("AUTO-REBUILD | Step 3: Reloading predictor singleton ...")
        import intent_engine.predictor as _pred_module
        _pred_module._predictor_instance = None  # clear singleton
        predictor = _pred_module.get_predictor(force_rebuild=True)
        predictor.load()
        _log.info("AUTO-REBUILD | Predictor reloaded — model_version=%s",
                  predictor.get_model_info().get("trained_at", "?"))
    except Exception as exc:
        _log.error("AUTO-REBUILD | Predictor reload FAILED: %s", exc, exc_info=True)
        return False

    try:
        _log.info("AUTO-REBUILD | Step 4: Reloading root agent singleton ...")
        import root_agent.root_agent as _ra_module
        _ra_module._root_agent_instance = None
        _log.info("AUTO-REBUILD | Root agent singleton cleared — will reload on next request")
    except Exception:
        pass

    return True


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------

def ensure_model_is_current(force: bool = False) -> bool:
    """
    Checks if any dataset file has changed since the last training run.
    If yes (or force=True), rebuilds the dataset and retrains the model.

    Thread-safe — only one rebuild runs at a time.

    Args:
        force: If True, always rebuild regardless of fingerprint.

    Returns:
        True if the model is current (no rebuild needed or rebuild succeeded).
        False if rebuild was attempted but failed.
    """
    with _rebuild_lock:
        cfg = get_config()
        fingerprint_path = cfg.outputs_dir / "dataset_fingerprint.json"

        current_fp = _compute_dataset_fingerprint(cfg.datasets_dir)
        stored_fp  = _load_stored_fingerprint(fingerprint_path)

        model_exists = (
            cfg.model_file.exists()
            and cfg.vectorizer_file.exists()
            and cfg.label_encoder_file.exists()
        )

        if not force and model_exists and current_fp == stored_fp:
            _log.info(
                "AUTO-REBUILD | Dataset unchanged (fingerprint=%s...) — model is current",
                current_fp[:12],
            )
            return True

        if not model_exists:
            _log.info("AUTO-REBUILD | No trained model found — triggering initial build+train")
        elif force:
            _log.info("AUTO-REBUILD | Force rebuild requested")
        else:
            _log.info(
                "AUTO-REBUILD | Dataset changed (old=%s... new=%s...) — triggering rebuild+retrain",
                stored_fp[:12], current_fp[:12],
            )

        t0 = time.perf_counter()
        success = _rebuild_and_retrain()
        elapsed = round(time.perf_counter() - t0, 2)

        if success:
            _save_fingerprint(fingerprint_path, current_fp)
            _log.info("AUTO-REBUILD | Complete in %.2fs — model is now current", elapsed)
        else:
            _log.error("AUTO-REBUILD | FAILED after %.2fs — model may be stale", elapsed)

        return success


def check_and_rebuild_if_needed() -> dict:
    """
    Convenience wrapper that returns a status dict.
    Safe to call from FastAPI startup, health endpoints, etc.
    """
    t0 = time.perf_counter()
    cfg = get_config()
    fingerprint_path = cfg.outputs_dir / "dataset_fingerprint.json"

    current_fp = _compute_dataset_fingerprint(cfg.datasets_dir)
    stored_fp  = _load_stored_fingerprint(fingerprint_path)
    model_exists = cfg.model_file.exists()

    needs_rebuild = (not model_exists) or (current_fp != stored_fp)

    result = {
        "needs_rebuild": needs_rebuild,
        "model_exists": model_exists,
        "fingerprint_changed": current_fp != stored_fp,
        "rebuild_success": None,
        "elapsed_s": 0.0,
    }

    if needs_rebuild:
        success = ensure_model_is_current()
        result["rebuild_success"] = success
        result["elapsed_s"] = round(time.perf_counter() - t0, 2)
    else:
        result["rebuild_success"] = True

    return result


# ---------------------------------------------------------------------------
# BACKGROUND WATCHER (optional — for long-running servers)
# ---------------------------------------------------------------------------

_watcher_thread: Optional[threading.Thread] = None
_watcher_stop   = threading.Event()


def start_background_watcher(interval_seconds: int = 60) -> None:
    """
    Starts a background thread that checks for dataset changes every
    `interval_seconds` and auto-rebuilds if needed.

    Safe to call multiple times — only one watcher runs at a time.

    Args:
        interval_seconds: How often to check for changes (default: 60s).
    """
    global _watcher_thread

    if _watcher_thread is not None and _watcher_thread.is_alive():
        _log.info("AUTO-REBUILD | Background watcher already running")
        return

    _watcher_stop.clear()

    def _watch():
        _log.info(
            "AUTO-REBUILD | Background watcher started (interval=%ds)", interval_seconds
        )
        while not _watcher_stop.wait(timeout=interval_seconds):
            try:
                ensure_model_is_current()
            except Exception as exc:
                _log.error("AUTO-REBUILD | Watcher error: %s", exc)
        _log.info("AUTO-REBUILD | Background watcher stopped")

    _watcher_thread = threading.Thread(target=_watch, daemon=True, name="akp-dataset-watcher")
    _watcher_thread.start()


def stop_background_watcher() -> None:
    """Stops the background watcher thread."""
    _watcher_stop.set()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m intent_engine.auto_rebuild",
        description="AKP Intent Engine — Auto-rebuild dataset and retrain model",
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force rebuild even if dataset fingerprint is unchanged",
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  AKP Intent Engine — Auto-Rebuild")
    print("=" * 60)
    success = ensure_model_is_current(force=args.force)
    print(f"\n  Result: {'SUCCESS' if success else 'FAILED'}")
    print("=" * 60 + "\n")
    sys.exit(0 if success else 1)
