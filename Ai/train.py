# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: train.py
# Purpose: Orchestrate the full training pipeline end-to-end.
#
# Pipeline order:
#   1. Validate dataset          (dataset_checker.py)
#   2. Load dataset catalogue    (dataset_loader.py)
#   3. Build & export index      (dataset_indexer.py)
#   4. Encode labels             (label_encoder.py)
#   5. Stratified split          (dataset_splitter.py)
#   6. Build YOLO folder layout  (symlinks — dataset is NEVER modified)
#   7. Train with Ultralytics    (YOLO classification API)
#   8. Copy best.pt / last.pt    (weights/checkpoints/)
#   9. Save metrics JSON         (outputs/reports/)
#  10. Cleanup temp layout       (temp dir removed after training)
#
# Usage:
#   cd Ai/
#   python train.py
#
# Environment overrides (all optional):
#   AKP_EPOCHS=50  AKP_BATCH_SIZE=16  AKP_LR=0.001
#   AKP_MODEL_WEIGHTS=yolov8s-cls.pt  AKP_RESUME=true
# =============================================================================

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Ensure the Ai/ directory is on sys.path so all sibling modules resolve
# regardless of where Python is invoked from.
# ---------------------------------------------------------------------------
_AI_ROOT = Path(__file__).parent.resolve()
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from config import get_config
from constants import LOG_FILENAME_DATE_FORMAT
from dataset_checker import check_dataset, save_report
from dataset_indexer import export_index
from dataset_loader import load_dataset
from dataset_splitter import split_dataset
from label_encoder import encode_labels
from logger import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Sentinel filenames written by Ultralytics inside the run directory
# ---------------------------------------------------------------------------
_YOLO_BEST  = "weights/best.pt"
_YOLO_LAST  = "weights/last.pt"


# =============================================================================
# SECTION 1 — DATASET VALIDATION
# =============================================================================

def _validate_dataset() -> None:
    """
    Runs dataset_checker.check_dataset() and aborts if the dataset is not
    clean. Saves the validation report to outputs/reports/ regardless of
    outcome so the user has a record of what failed.

    Raises:
        SystemExit: If the dataset has corrupted images, empty class folders,
                    or missing sections.
    """
    log.info("=" * 60)
    log.info("STEP 1 — Dataset validation")
    log.info("=" * 60)

    report = check_dataset()
    save_report(report)

    log.info(
        "Validation result — images: %d | classes: %d | corrupted: %d | "
        "empty: %d | ready: %s",
        report.total_images,
        report.total_classes,
        report.total_corrupted,
        report.total_empty_folders,
        report.is_ready_for_training,
    )

    if not report.is_ready_for_training:
        log.error("Dataset is NOT ready for training. Resolve the issues above and retry.")
        if report.total_corrupted:
            log.error("  → %d corrupted image(s) must be removed or replaced.", report.total_corrupted)
        if report.total_empty_folders:
            log.error("  → %d empty class folder(s) must be populated or removed.", report.total_empty_folders)
        missing = [c.crop_name for c in report.crops if c.missing_sections]
        if missing:
            log.error("  → Missing sections in crops: %s", missing)
        sys.exit(1)

    log.info("Dataset validation passed — %d images across %d classes.",
             report.total_images, report.total_classes)


# =============================================================================
# SECTION 2 — INDEX, LABELS, SPLIT
# =============================================================================

def _prepare_pipeline() -> tuple[dict[str, int], dict[int, str]]:
    """
    Runs steps 2–5 of the pipeline:
      • load_dataset()   — builds DatasetCatalogue
      • export_index()   — writes dataset_index.json + dataset_statistics.json
      • encode_labels()  — writes label_map.json + reverse_label_map.json
      • split_dataset()  — writes train/val/test JSON split files

    Returns:
        (label_map, reverse_label_map) — used downstream to verify class count.
    """
    cfg = get_config()

    log.info("=" * 60)
    log.info("STEP 2 — Loading dataset catalogue")
    log.info("=" * 60)
    catalogue = load_dataset()
    log.info("Catalogue ready — %d images | %d classes | %d crops",
             catalogue.total_images, catalogue.total_classes, catalogue.total_crops)

    log.info("=" * 60)
    log.info("STEP 3 — Building dataset index")
    log.info("=" * 60)
    export_index(catalogue, output_dir=cfg.paths.outputs_dir)

    log.info("=" * 60)
    log.info("STEP 4 — Encoding labels")
    log.info("=" * 60)
    label_map, reverse_label_map = encode_labels(catalogue, output_dir=cfg.paths.outputs_dir)
    log.info("Labels encoded — %d unique classes", len(label_map))

    log.info("=" * 60)
    log.info("STEP 5 — Stratified train/val/test split")
    log.info("=" * 60)
    train_p, val_p, test_p, stats_p = split_dataset(
        index_path=cfg.paths.outputs_dir / "dataset_index.json",
        output_dir=cfg.paths.outputs_dir,
        split_cfg=cfg.split,
    )
    log.info("Split complete — train: %s | val: %s | test: %s",
             train_p.name, val_p.name, test_p.name)

    return label_map, reverse_label_map


# =============================================================================
# SECTION 3 — YOLO FOLDER LAYOUT
# =============================================================================

def _build_yolo_layout(
    split_json_path: Path,
    dest_dir: Path,
    split_name: str,
) -> int:
    """
    Reads a split JSON file (train_index.json / validation_index.json /
    test_index.json) and builds the Ultralytics classification folder layout
    inside dest_dir using hard links (falling back to copies if hard links
    fail — e.g. cross-device).

    Layout produced:
        dest_dir/
        └── <split_name>/
            └── <class_name>/
                └── image.jpg   ← hard link or copy (original NEVER moved)

    Args:
        split_json_path: Absolute path to the split JSON file.
        dest_dir:        Root temp directory for the YOLO layout.
        split_name:      "train" | "val" | "test"

    Returns:
        Number of image entries linked/copied.
    """
    with open(split_json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    records: list[dict] = data.get("records", [])
    count = 0

    for rec in records:
        src = Path(rec["image_path"])
        if not src.exists():
            log.warning("Missing image (skipped): %s", src)
            continue

        class_dir = dest_dir / split_name / rec["class_name"]
        class_dir.mkdir(parents=True, exist_ok=True)

        # Use a unique destination name to avoid collisions when the same
        # filename appears in multiple crop folders.
        dest_name = f"{rec['image_id']}_{src.name}"
        dest = class_dir / dest_name

        if dest.exists():
            count += 1
            continue

        try:
            dest.hardlink_to(src)
        except (OSError, NotImplementedError):
            shutil.copy2(src, dest)

        count += 1

    log.info("YOLO layout [%s] — %d images linked into %s", split_name, count, dest_dir / split_name)
    return count


# =============================================================================
# SECTION 4 — RESUME CHECKPOINT DETECTION
# =============================================================================

def _find_resume_checkpoint(cfg) -> Optional[Path]:
    """
    Looks for an existing last.pt in weights/checkpoints/ to support
    --resume training. Returns None if no checkpoint is found or if
    cfg.training.resume is False.

    Args:
        cfg: AKPConfig from get_config().

    Returns:
        Path to last.pt if resume is enabled and the file exists, else None.
    """
    if not cfg.training.resume:
        return None

    last_pt = cfg.paths.checkpoints_dir / "last.pt"
    if last_pt.exists():
        log.info("Resume checkpoint found: %s", last_pt)
        return last_pt

    log.info("Resume requested but no last.pt found — starting fresh.")
    return None


# =============================================================================
# SECTION 5 — YOLO TRAINING
# =============================================================================

def _run_training(
    yolo_data_dir: Path,
    num_classes: int,
    resume_checkpoint: Optional[Path],
    run_name: str,
) -> Path:
    """
    Executes Ultralytics YOLO classification training via the Python API.

    The Ultralytics trainer writes its own outputs (weights/, results.csv,
    confusion_matrix.png, etc.) into a run directory under
    cfg.paths.training_dir / run_name. train.py then copies the key
    artefacts to the canonical AKP locations.

    Args:
        yolo_data_dir:     Root of the YOLO folder layout (contains train/ val/).
        num_classes:       Total number of unique classes in the dataset.
        resume_checkpoint: Path to last.pt for resume, or None.
        run_name:          Unique name for this training run (used as project subdir).

    Returns:
        Path to the Ultralytics run directory (contains weights/, results.csv, etc.).

    Raises:
        ImportError:  If ultralytics is not installed.
        RuntimeError: If training fails.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        raise ImportError(
            "ultralytics is required. Install with: pip install ultralytics"
        )

    cfg = get_config()
    t_cfg = cfg.training

    # ------------------------------------------------------------------
    # Determine weights to load:
    #   • resume=True + last.pt exists  → pass last.pt path (Ultralytics
    #     will restore optimizer state and epoch counter automatically)
    #   • otherwise                     → load pretrained backbone weights
    # ------------------------------------------------------------------
    if resume_checkpoint is not None:
        weights = str(resume_checkpoint)
        log.info("Resuming from checkpoint: %s", weights)
    else:
        weights = t_cfg.model_weights
        log.info("Starting fresh training with weights: %s", weights)

    model = YOLO(weights)

    # ------------------------------------------------------------------
    # Ultralytics train() arguments
    # project + name control where run artefacts are saved:
    #   <project>/<name>/weights/best.pt
    #   <project>/<name>/results.csv
    #   <project>/<name>/confusion_matrix.png
    # ------------------------------------------------------------------
    project_dir = str(cfg.paths.training_dir)

    log.info("=" * 60)
    log.info("STEP 7 — YOLO Classification Training")
    log.info("  Model      : %s", weights)
    log.info("  Device     : %s", t_cfg.device)
    log.info("  Epochs     : %d", t_cfg.epochs)
    log.info("  Batch size : %d", t_cfg.batch_size)
    log.info("  Image size : %d", t_cfg.image_size)
    log.info("  LR         : %s", t_cfg.learning_rate)
    log.info("  Patience   : %d", t_cfg.patience)
    log.info("  Workers    : %d", t_cfg.workers)
    log.info("  Classes    : %d", num_classes)
    log.info("  Data dir   : %s", yolo_data_dir)
    log.info("  Project    : %s", project_dir)
    log.info("  Run name   : %s", run_name)
    log.info("=" * 60)

    try:
        model.train(
            data=str(yolo_data_dir),
            epochs=t_cfg.epochs,
            imgsz=t_cfg.image_size,
            batch=t_cfg.batch_size,
            lr0=t_cfg.learning_rate,
            patience=t_cfg.patience,
            workers=t_cfg.workers,
            device=t_cfg.device,
            pretrained=t_cfg.pretrained,
            augment=t_cfg.augment,
            project=project_dir,
            name=run_name,
            exist_ok=True,
            verbose=t_cfg.verbose,
            resume=(resume_checkpoint is not None),
            save_period=t_cfg.save_period,
        )
    except Exception as exc:
        raise RuntimeError(f"YOLO training failed: {exc}") from exc

    run_dir = Path(project_dir) / run_name
    log.info("Training complete. Run directory: %s", run_dir)
    return run_dir


# =============================================================================
# SECTION 6 — ARTEFACT COLLECTION
# =============================================================================

def _collect_artefacts(run_dir: Path, run_name: str, timestamp: str) -> dict[str, str]:
    """
    Copies training artefacts from the Ultralytics run directory to the
    canonical AKP output locations:

      Weights:
        run_dir/weights/best.pt  → weights/checkpoints/best.pt
        run_dir/weights/last.pt  → weights/checkpoints/last.pt

      Metrics:
        run_dir/results.csv      → outputs/reports/<run_name>_results_<ts>.csv
        run_dir/results.png      → outputs/visualizations/<run_name>_results_<ts>.png
        run_dir/confusion_matrix.png
                                 → outputs/visualizations/<run_name>_confusion_<ts>.png

    Also writes a compact metrics_summary.json to outputs/reports/.

    Args:
        run_dir:   Ultralytics run directory.
        run_name:  Training run name (used in output filenames).
        timestamp: Timestamp string for unique filenames.

    Returns:
        Dict mapping artefact type → saved path string (for logging).
    """
    cfg = get_config()
    saved: dict[str, str] = {}

    cfg.paths.checkpoints_dir.mkdir(parents=True, exist_ok=True)
    cfg.paths.reports_dir.mkdir(parents=True, exist_ok=True)
    cfg.paths.visualizations_dir.mkdir(parents=True, exist_ok=True)

    # --- Weights ---
    for weight_name in ("best.pt", "last.pt"):
        src = run_dir / "weights" / weight_name
        if src.exists():
            dest = cfg.paths.checkpoints_dir / weight_name
            shutil.copy2(src, dest)
            saved[weight_name] = str(dest)
            log.info("Saved weight: %s → %s", src.name, dest)
        else:
            log.warning("Weight file not found (skipped): %s", src)

    # --- results.csv ---
    results_csv = run_dir / "results.csv"
    if results_csv.exists():
        dest = cfg.paths.reports_dir / f"{run_name}_results_{timestamp}.csv"
        shutil.copy2(results_csv, dest)
        saved["results.csv"] = str(dest)
        log.info("Saved results CSV: %s", dest)

    # --- results.png ---
    results_png = run_dir / "results.png"
    if results_png.exists():
        dest = cfg.paths.visualizations_dir / f"{run_name}_results_{timestamp}.png"
        shutil.copy2(results_png, dest)
        saved["results.png"] = str(dest)
        log.info("Saved results plot: %s", dest)

    # --- confusion_matrix.png ---
    for cm_name in ("confusion_matrix.png", "confusion_matrix_normalized.png"):
        cm_src = run_dir / cm_name
        if cm_src.exists():
            dest = cfg.paths.visualizations_dir / f"{run_name}_{cm_name.replace('.png', '')}_{timestamp}.png"
            shutil.copy2(cm_src, dest)
            saved[cm_name] = str(dest)
            log.info("Saved confusion matrix: %s", dest)

    # --- metrics_summary.json ---
    _write_metrics_summary(run_dir, run_name, timestamp, saved)

    return saved


def _write_metrics_summary(
    run_dir: Path,
    run_name: str,
    timestamp: str,
    artefacts: dict[str, str],
) -> None:
    """
    Parses results.csv (if present) to extract the best epoch metrics and
    writes a compact metrics_summary.json to outputs/reports/.

    The summary contains:
      • run_name, timestamp, run_dir
      • best epoch number and its top1/top5 accuracy
      • paths to all saved artefacts
    """
    cfg = get_config()
    summary: dict = {
        "run_name":   run_name,
        "timestamp":  timestamp,
        "run_dir":    str(run_dir),
        "artefacts":  artefacts,
        "best_epoch": None,
        "metrics":    {},
    }

    results_csv = run_dir / "results.csv"
    if results_csv.exists():
        try:
            import csv
            rows: list[dict] = []
            with open(results_csv, "r", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    rows.append({k.strip(): v.strip() for k, v in row.items()})

            if rows:
                # Find the row with the highest val/top1 accuracy
                def _top1(row: dict) -> float:
                    for key in row:
                        if "top1" in key.lower() and "val" in key.lower():
                            try:
                                return float(row[key])
                            except ValueError:
                                pass
                    return 0.0

                best_row = max(rows, key=_top1)
                summary["best_epoch"] = best_row.get("epoch", "?")
                summary["metrics"]    = best_row

        except Exception as exc:
            log.warning("Could not parse results.csv for summary: %s", exc)

    summary_path = cfg.paths.reports_dir / f"{run_name}_metrics_{timestamp}.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, ensure_ascii=False)
    log.info("Metrics summary saved: %s", summary_path)


# =============================================================================
# SECTION 7 — MAIN ORCHESTRATOR
# =============================================================================

def train() -> None:
    """
    Full end-to-end training pipeline entry point.

    Steps:
      1.  Validate dataset
      2.  Load catalogue
      3.  Export index + statistics
      4.  Encode labels
      5.  Stratified split
      6.  Build YOLO folder layout in a temp directory
      7.  Run YOLO classification training
      8.  Copy best.pt / last.pt to weights/checkpoints/
      9.  Copy results.csv, results.png, confusion_matrix.png to outputs/
      10. Write metrics_summary.json
      11. Clean up temp directory

    All configuration is read from config.py (get_config()).
    No hardcoded paths, crop names, or hyperparameters.
    """
    cfg       = get_config()
    timestamp = datetime.now().strftime(LOG_FILENAME_DATE_FORMAT)
    run_name  = f"akp_train_{timestamp}"

    # Attach a persistent log file for this training run
    log_file  = cfg.paths.training_logs_dir / f"{run_name}.log"
    cfg.paths.training_logs_dir.mkdir(parents=True, exist_ok=True)
    # Re-get logger with file handler attached
    run_log = get_logger("akp.train", log_file=log_file)

    run_log.info("=" * 60)
    run_log.info("AKP Training Pipeline — START")
    run_log.info("Run name  : %s", run_name)
    run_log.info("Timestamp : %s", timestamp)
    run_log.info("Device    : %s", cfg.hardware.device.upper())
    run_log.info("OS        : %s", cfg.hardware.os_name)
    run_log.info("Python    : %s", cfg.hardware.python_version)
    run_log.info("RAM       : %s GB", cfg.hardware.system_ram_gb)
    if cfg.hardware.is_gpu:
        run_log.info("GPU       : %s", cfg.hardware.gpu_info.get("name", "Unknown"))
        run_log.info("VRAM      : %s GB", cfg.hardware.gpu_info.get("vram_gb", "?"))
    run_log.info("=" * 60)

    wall_start = time.time()

    # ------------------------------------------------------------------
    # STEP 1 — Validate dataset
    # ------------------------------------------------------------------
    _validate_dataset()

    # ------------------------------------------------------------------
    # STEPS 2–5 — Index, labels, split
    # ------------------------------------------------------------------
    label_map, reverse_label_map = _prepare_pipeline()
    num_classes = len(label_map)
    run_log.info("Total unique classes for training: %d", num_classes)

    # ------------------------------------------------------------------
    # STEP 6 — Build YOLO folder layout in a temp directory
    # ------------------------------------------------------------------
    run_log.info("=" * 60)
    run_log.info("STEP 6 — Building YOLO classification folder layout")
    run_log.info("=" * 60)

    tmp_dir = Path(tempfile.mkdtemp(prefix="akp_yolo_"))
    run_log.info("Temp layout directory: %s", tmp_dir)

    try:
        outputs = cfg.paths.outputs_dir

        train_count = _build_yolo_layout(
            outputs / "train_index.json", tmp_dir, "train"
        )
        val_count = _build_yolo_layout(
            outputs / "validation_index.json", tmp_dir, "val"
        )
        # test split is built but not passed to YOLO trainer —
        # it is used for post-training evaluation only.
        test_count = _build_yolo_layout(
            outputs / "test_index.json", tmp_dir, "test"
        )

        run_log.info(
            "Layout ready — train: %d | val: %d | test: %d images",
            train_count, val_count, test_count,
        )

        if train_count == 0 or val_count == 0:
            run_log.error(
                "Train or val split is empty (train=%d, val=%d). "
                "Check split ratios and dataset size.",
                train_count, val_count,
            )
            sys.exit(1)

        # ------------------------------------------------------------------
        # STEP 6b — Resume checkpoint detection
        # ------------------------------------------------------------------
        resume_checkpoint = _find_resume_checkpoint(cfg)

        # ------------------------------------------------------------------
        # STEP 7 — YOLO training
        # ------------------------------------------------------------------
        run_dir = _run_training(
            yolo_data_dir=tmp_dir,
            num_classes=num_classes,
            resume_checkpoint=resume_checkpoint,
            run_name=run_name,
        )

        # ------------------------------------------------------------------
        # STEPS 8–10 — Collect artefacts
        # ------------------------------------------------------------------
        run_log.info("=" * 60)
        run_log.info("STEP 8-10 — Collecting training artefacts")
        run_log.info("=" * 60)

        saved = _collect_artefacts(run_dir, run_name, timestamp)

        wall_elapsed = time.time() - wall_start
        hours, rem   = divmod(int(wall_elapsed), 3600)
        minutes, secs = divmod(rem, 60)

        run_log.info("=" * 60)
        run_log.info("AKP Training Pipeline — COMPLETE")
        run_log.info("Total time : %02dh %02dm %02ds", hours, minutes, secs)
        run_log.info("Run dir    : %s", run_dir)
        run_log.info("Log file   : %s", log_file)
        run_log.info("Artefacts saved:")
        for key, path in saved.items():
            run_log.info("  %-30s %s", key, path)
        run_log.info("=" * 60)

    except KeyboardInterrupt:
        run_log.warning("Training interrupted by user (KeyboardInterrupt).")
        sys.exit(130)

    except Exception as exc:
        run_log.exception("Training pipeline failed: %s", exc)
        sys.exit(1)

    finally:
        # ------------------------------------------------------------------
        # STEP 11 — Always clean up the temp directory
        # ------------------------------------------------------------------
        if tmp_dir.exists():
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
                run_log.info("Temp directory cleaned up: %s", tmp_dir)
            except Exception as cleanup_exc:
                run_log.warning("Could not remove temp dir %s: %s", tmp_dir, cleanup_exc)


# =============================================================================
# SECTION 8 — ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    train()
