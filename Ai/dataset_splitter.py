# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: dataset_splitter.py
# Purpose: Read dataset_index.json produced by dataset_indexer.py and split
#          every class into train / validation / test subsets while preserving
#          class balance and crop balance. Export four JSON files.
#
# DESIGN PRINCIPLES:
#   • Zero hardcoded crop, disease, or pest names.
#   • Stratified split: each class is split independently so every split
#     receives a proportional share of every class.
#   • Crop balance is preserved as a natural consequence of per-class
#     stratification (each crop's classes are split independently).
#   • Deterministic: same seed always produces the same split.
#   • Configurable: ratios and seed come from cfg.split (SplitConfig).
#   • This module ONLY splits. It does NOT preprocess, augment, or train.
#
# Outputs (written to outputs/):
#   train_index.json        — training subset
#   validation_index.json   — validation subset
#   test_index.json         — test subset
#   split_statistics.json   — per-class and per-crop split counts
#
# Run: python dataset_splitter.py
# =============================================================================

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

from config import SplitConfig, get_config
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — OUTPUT FILENAMES
# =============================================================================

_TRAIN_INDEX_FILE  = "train_index.json"
_VAL_INDEX_FILE    = "validation_index.json"
_TEST_INDEX_FILE   = "test_index.json"
_SPLIT_STATS_FILE  = "split_statistics.json"


# =============================================================================
# SECTION 2 — DATA STRUCTURES
# =============================================================================

@dataclass
class SplitRecord:
    """
    One image entry inside a split index file.

    Mirrors the fields of IndexedImage from dataset_indexer.py so that
    downstream modules (preprocessing, training) can consume split files
    without importing dataset_indexer.
    """
    image_id:   str
    image_path: str
    file_name:  str
    crop_name:  str
    category:   str
    class_name: str
    class_id:   int


@dataclass
class SplitIndex:
    """
    One complete split (train, validation, or test) ready for export.

    Fields:
        split_name    — "train" | "validation" | "test"
        generated_at  — ISO 8601 timestamp
        total_images  — number of records in this split
        records       — list of SplitRecord
        class_counts  — {class_name: count} for quick inspection
        crop_counts   — {crop_name: count} for quick inspection
    """
    split_name:   str
    generated_at: str
    total_images: int
    records:      list[SplitRecord]  = field(default_factory=list)
    class_counts: dict[str, int]     = field(default_factory=dict)
    crop_counts:  dict[str, int]     = field(default_factory=dict)


@dataclass
class ClassSplitStats:
    """Per-class split counts for split_statistics.json."""
    class_name:  str
    crop_name:   str
    category:    str
    total:       int
    train:       int
    validation:  int
    test:        int


@dataclass
class CropSplitStats:
    """Per-crop split counts for split_statistics.json."""
    crop_name:  str
    total:      int
    train:      int
    validation: int
    test:       int


@dataclass
class SplitStatistics:
    """
    Aggregated statistics describing the three-way split.

    Written to split_statistics.json for auditing and reproducibility.
    """
    generated_at:   str
    dataset_root:   str
    train_ratio:    float
    val_ratio:      float
    test_ratio:     float
    seed:           int
    total_images:   int
    train_images:   int
    val_images:     int
    test_images:    int
    total_classes:  int
    total_crops:    int
    class_stats:    list[ClassSplitStats] = field(default_factory=list)
    crop_stats:     list[CropSplitStats]  = field(default_factory=list)


# =============================================================================
# SECTION 3 — INDEX LOADER
# =============================================================================

def _load_index(index_path: Path) -> dict:
    """
    Loads dataset_index.json from disk and returns the raw dict.

    Args:
        index_path: Absolute path to dataset_index.json.

    Returns:
        Parsed JSON dict.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError:        If the file cannot be parsed as JSON.
    """
    if not index_path.exists():
        raise FileNotFoundError(
            f"dataset_index.json not found at {index_path}. "
            "Run dataset_indexer.py first."
        )
    try:
        with open(index_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        log.info("Loaded index: %d images from %s", len(data.get("images", [])), index_path)
        return data
    except json.JSONDecodeError as exc:
        raise ValueError(f"Cannot parse {index_path}: {exc}") from exc


# =============================================================================
# SECTION 4 — STRATIFIED SPLITTER
# =============================================================================

def _stratified_split(
    records: list[dict],
    train_ratio: float,
    val_ratio: float,
    seed: int,
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Splits a list of image records into train / validation / test subsets
    using stratified sampling per class.

    Strategy:
      1. Group all records by (crop_name, class_name) — the compound key
         ensures classes shared across crops are split independently per crop.
      2. Shuffle each group with the fixed seed for reproducibility.
      3. Slice each group at the train and val boundaries.
      4. Concatenate all groups' slices into the three final lists.

    This guarantees:
      • Every class appears in every split (proportionally).
      • Crop balance is preserved because each crop's classes are handled
        independently.
      • Classes with very few images (< 3) are placed entirely in train
        with a warning rather than producing empty val/test splits.

    Args:
        records:     All image dicts from dataset_index.json["images"].
        train_ratio: Fraction for training (e.g. 0.80).
        val_ratio:   Fraction for validation (e.g. 0.10).
        seed:        Random seed for reproducibility.

    Returns:
        (train_records, val_records, test_records) — three lists of dicts.
    """
    # Group by compound key (crop_name, class_name)
    groups: dict[tuple[str, str], list[dict]] = {}
    for rec in records:
        key = (rec["crop_name"], rec["class_name"])
        groups.setdefault(key, []).append(rec)

    train_all: list[dict] = []
    val_all:   list[dict] = []
    test_all:  list[dict] = []

    rng = random.Random(seed)

    for (crop, cls), group in sorted(groups.items()):
        rng.shuffle(group)
        n = len(group)

        if n < 3:
            log.warning(
                "[%s/%s] Only %d image(s) — placing all in train split", crop, cls, n
            )
            train_all.extend(group)
            continue

        train_end = max(1, round(n * train_ratio))
        val_end   = train_end + max(1, round(n * val_ratio))
        # Ensure test gets at least 1 image when n >= 3
        val_end   = min(val_end, n - 1)

        train_all.extend(group[:train_end])
        val_all.extend(group[train_end:val_end])
        test_all.extend(group[val_end:])

    log.info(
        "Stratified split — train: %d | val: %d | test: %d",
        len(train_all), len(val_all), len(test_all),
    )
    return train_all, val_all, test_all


# =============================================================================
# SECTION 5 — SPLIT INDEX BUILDER
# =============================================================================

def _build_split_index(name: str, records: list[dict]) -> SplitIndex:
    """
    Converts a list of raw image dicts into a typed SplitIndex.

    Args:
        name:    Split name: "train" | "validation" | "test".
        records: List of image dicts from the stratified split.

    Returns:
        Populated SplitIndex ready for JSON export.
    """
    split_records: list[SplitRecord] = []
    class_counts:  dict[str, int]    = {}
    crop_counts:   dict[str, int]    = {}

    for r in records:
        split_records.append(SplitRecord(
            image_id=r["image_id"],
            image_path=r["image_path"],
            file_name=r["file_name"],
            crop_name=r["crop_name"],
            category=r["category"],
            class_name=r["class_name"],
            class_id=r["class_id"],
        ))
        class_counts[r["class_name"]] = class_counts.get(r["class_name"], 0) + 1
        crop_counts[r["crop_name"]]   = crop_counts.get(r["crop_name"], 0) + 1

    return SplitIndex(
        split_name=name,
        generated_at=datetime.now().isoformat(timespec="seconds"),
        total_images=len(split_records),
        records=split_records,
        class_counts=class_counts,
        crop_counts=crop_counts,
    )


# =============================================================================
# SECTION 6 — STATISTICS BUILDER
# =============================================================================

def _build_split_statistics(
    index_data: dict,
    train: list[dict],
    val:   list[dict],
    test:  list[dict],
    split_cfg: SplitConfig,
) -> SplitStatistics:
    """
    Computes per-class and per-crop split counts for the statistics file.

    Args:
        index_data: Raw dict from dataset_index.json (for dataset_root).
        train:      Train records list.
        val:        Validation records list.
        test:       Test records list.
        split_cfg:  SplitConfig with ratios and seed.

    Returns:
        Populated SplitStatistics.
    """
    def _count_by(records: list[dict], key: str) -> dict[str, int]:
        counts: dict[str, int] = {}
        for r in records:
            counts[r[key]] = counts.get(r[key], 0) + 1
        return counts

    # Per-class stats
    all_records = train + val + test
    class_meta: dict[str, dict] = {}
    for r in all_records:
        k = f"{r['crop_name']}::{r['class_name']}"
        if k not in class_meta:
            class_meta[k] = {
                "class_name": r["class_name"],
                "crop_name":  r["crop_name"],
                "category":   r["category"],
            }

    train_cls  = _count_by(train, "class_name")
    val_cls    = _count_by(val,   "class_name")
    test_cls   = _count_by(test,  "class_name")
    total_cls  = _count_by(all_records, "class_name")

    class_stats: list[ClassSplitStats] = []
    seen_classes: set[str] = set()
    for r in all_records:
        cn = r["class_name"]
        if cn in seen_classes:
            continue
        seen_classes.add(cn)
        class_stats.append(ClassSplitStats(
            class_name=cn,
            crop_name=r["crop_name"],
            category=r["category"],
            total=total_cls.get(cn, 0),
            train=train_cls.get(cn, 0),
            validation=val_cls.get(cn, 0),
            test=test_cls.get(cn, 0),
        ))
    class_stats.sort(key=lambda x: (x.crop_name, x.class_name))

    # Per-crop stats
    train_crop = _count_by(train, "crop_name")
    val_crop   = _count_by(val,   "crop_name")
    test_crop  = _count_by(test,  "crop_name")
    total_crop = _count_by(all_records, "crop_name")

    crop_stats: list[CropSplitStats] = [
        CropSplitStats(
            crop_name=crop,
            total=total_crop[crop],
            train=train_crop.get(crop, 0),
            validation=val_crop.get(crop, 0),
            test=test_crop.get(crop, 0),
        )
        for crop in sorted(total_crop)
    ]

    return SplitStatistics(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        dataset_root=index_data.get("dataset_root", ""),
        train_ratio=split_cfg.train_ratio,
        val_ratio=split_cfg.val_ratio,
        test_ratio=split_cfg.test_ratio,
        seed=split_cfg.seed,
        total_images=len(all_records),
        train_images=len(train),
        val_images=len(val),
        test_images=len(test),
        total_classes=len(seen_classes),
        total_crops=len(total_crop),
        class_stats=class_stats,
        crop_stats=crop_stats,
    )


# =============================================================================
# SECTION 7 — JSON WRITER
# =============================================================================

def _write_json(data: object, path: Path) -> None:
    """
    Serialises a dataclass or dict to a JSON file.

    Args:
        data: Dataclass instance or plain dict.
        path: Absolute output path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = asdict(data) if hasattr(data, "__dataclass_fields__") else data
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    log.info("Exported: %s  (%d bytes)", path.name, path.stat().st_size)


# =============================================================================
# SECTION 8 — PUBLIC ENTRY POINT
# =============================================================================

def split_dataset(
    index_path: Path | None = None,
    output_dir: Path | None = None,
    split_cfg:  SplitConfig | None = None,
) -> tuple[Path, Path, Path, Path]:
    """
    Reads dataset_index.json, performs a stratified three-way split, and
    exports four JSON files to output_dir.

    Outputs:
      • train_index.json       — training subset
      • validation_index.json  — validation subset
      • test_index.json        — test subset
      • split_statistics.json  — per-class and per-crop split counts

    Args:
        index_path: Path to dataset_index.json. Defaults to
                    cfg.paths.outputs_dir / "dataset_index.json".
        output_dir: Directory to write output files. Defaults to
                    cfg.paths.outputs_dir.
        split_cfg:  SplitConfig with ratios and seed. Defaults to
                    cfg.split (reads from AKPConfig).

    Returns:
        Tuple of (train_path, val_path, test_path, stats_path).

    Usage:
        from dataset_splitter import split_dataset
        train_p, val_p, test_p, stats_p = split_dataset()
    """
    cfg       = get_config()
    out_dir   = output_dir or cfg.paths.outputs_dir
    idx_path  = index_path or (out_dir / "dataset_index.json")
    s_cfg     = split_cfg  or cfg.split

    log.info("=" * 60)
    log.info("AKP Dataset Splitter — Starting")
    log.info("Index      : %s", idx_path)
    log.info("Output dir : %s", out_dir)
    log.info(
        "Ratios     : train=%.0f%%  val=%.0f%%  test=%.0f%%  seed=%d",
        s_cfg.train_ratio * 100,
        s_cfg.val_ratio   * 100,
        s_cfg.test_ratio  * 100,
        s_cfg.seed,
    )
    log.info("=" * 60)

    # Step 1 — Load index
    index_data = _load_index(idx_path)
    all_images: list[dict] = index_data.get("images", [])

    if not all_images:
        raise ValueError("dataset_index.json contains no images. Run dataset_indexer.py first.")

    # Step 2 — Stratified split
    train_recs, val_recs, test_recs = _stratified_split(
        all_images,
        train_ratio=s_cfg.train_ratio,
        val_ratio=s_cfg.val_ratio,
        seed=s_cfg.seed,
    )

    # Step 3 — Build typed split indexes
    train_idx = _build_split_index("train",      train_recs)
    val_idx   = _build_split_index("validation", val_recs)
    test_idx  = _build_split_index("test",       test_recs)

    # Step 4 — Build statistics
    stats = _build_split_statistics(index_data, train_recs, val_recs, test_recs, s_cfg)

    # Step 5 — Export
    train_path = out_dir / _TRAIN_INDEX_FILE
    val_path   = out_dir / _VAL_INDEX_FILE
    test_path  = out_dir / _TEST_INDEX_FILE
    stats_path = out_dir / _SPLIT_STATS_FILE

    _write_json(train_idx, train_path)
    _write_json(val_idx,   val_path)
    _write_json(test_idx,  test_path)
    _write_json(stats,     stats_path)

    log.info("=" * 60)
    log.info("Split complete")
    log.info("Train      : %d images", train_idx.total_images)
    log.info("Validation : %d images", val_idx.total_images)
    log.info("Test       : %d images", test_idx.total_images)
    log.info("=" * 60)

    return train_path, val_path, test_path, stats_path


# =============================================================================
# SECTION 9 — MAIN
# =============================================================================

if __name__ == "__main__":
    train_p, val_p, test_p, stats_p = split_dataset()

    cfg = get_config()
    print(f"\n{'='*60}")
    print("  AKP Dataset Splitter — Complete")
    print(f"{'='*60}")
    print(f"  Train      : {train_p}")
    print(f"  Validation : {val_p}")
    print(f"  Test       : {test_p}")
    print(f"  Statistics : {stats_p}")
    print(f"{'='*60}\n")
