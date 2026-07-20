# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: dataset_indexer.py
# Purpose: Receive metadata from dataset_loader.py, build a complete dataset
#          index with unique image IDs, compute statistics, and export
#          dataset_index.json and dataset_statistics.json.
#
# DESIGN PRINCIPLES:
#   • Zero hardcoded crop, disease, or pest names.
#   • Supports unlimited crops — everything is discovered from the catalogue.
#   • Unique image IDs are deterministic: SHA-1 of the absolute image path.
#   • Exports are written to outputs/ — never to the dataset folder.
#   • This module ONLY indexes. It does NOT preprocess, augment, or train.
#
# Run: python dataset_indexer.py
# =============================================================================

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from config import get_config
from constants import LOG_FILENAME_DATE_FORMAT
from dataset_loader import DatasetCatalogue, load_dataset
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — OUTPUT FILENAMES
# =============================================================================

_INDEX_FILENAME      = "dataset_index.json"
_STATISTICS_FILENAME = "dataset_statistics.json"


# =============================================================================
# SECTION 2 — DATA STRUCTURES
# =============================================================================

@dataclass(frozen=True)
class IndexedImage:
    """
    Immutable descriptor for one image entry in the dataset index.

    Fields:
        image_id   — Deterministic unique ID: first 16 hex chars of SHA-1(abs_path).
        image_path — Absolute path to the image file.
        file_name  — Bare filename (e.g. "img_001.jpg").
        crop_name  — Parent crop folder name.
        category   — Canonical section: "healthy" | "diseases" | "pests".
        class_name — Class label (folder name).
        class_id   — Globally unique integer label from dataset_loader.
    """
    image_id:   str
    image_path: str
    file_name:  str
    crop_name:  str
    category:   str
    class_name: str
    class_id:   int


@dataclass
class ClassStatEntry:
    """Statistics for one class across the entire dataset."""
    class_name:  str
    crop_name:   str
    category:    str
    image_count: int


@dataclass
class CropStatEntry:
    """Per-crop statistics block inside DatasetStatistics."""
    crop_name:       str
    total_images:    int
    total_classes:   int
    healthy_classes: int
    disease_classes: int
    pest_classes:    int
    images_per_class: dict[str, int] = field(default_factory=dict)


@dataclass
class DatasetStatistics:
    """
    Aggregated statistics for the entire indexed dataset.

    Computed once from the DatasetCatalogue and written to
    dataset_statistics.json. Consumed by label_encoder.py and
    any downstream reporting module.
    """
    generated_at:    str
    dataset_root:    str
    total_crops:     int
    total_classes:   int
    healthy_classes: int
    disease_classes: int
    pest_classes:    int
    total_images:    int
    images_per_crop:  dict[str, int]          = field(default_factory=dict)
    images_per_class: dict[str, int]          = field(default_factory=dict)
    crop_details:     list[CropStatEntry]     = field(default_factory=list)
    class_details:    list[ClassStatEntry]    = field(default_factory=list)


@dataclass
class DatasetIndex:
    """
    The complete dataset index exported to dataset_index.json.

    Contains every image record with its unique ID, plus a compact
    class registry and crop registry for fast downstream lookups.
    """
    generated_at:  str
    dataset_root:  str
    total_images:  int
    total_classes: int
    total_crops:   int
    images:        list[IndexedImage]      = field(default_factory=list)
    class_registry: dict[str, int]        = field(default_factory=dict)   # class_name → class_id
    crop_registry:  list[str]             = field(default_factory=list)   # sorted crop names


# =============================================================================
# SECTION 3 — IMAGE ID GENERATOR
# =============================================================================

def _make_image_id(abs_path: str) -> str:
    """
    Generates a deterministic, unique image ID from the absolute file path.

    Uses the first 16 hex characters of SHA-1(path). This is:
      • Deterministic — same path always produces the same ID.
      • Unique enough — collision probability is negligible for dataset sizes.
      • Stable — renaming other files does not change this file's ID.

    Args:
        abs_path: Absolute path string of the image file.

    Returns:
        16-character lowercase hex string (e.g. "3f2a1b9c4e7d0812").
    """
    return hashlib.sha1(abs_path.encode("utf-8")).hexdigest()[:16]


# =============================================================================
# SECTION 4 — INDEX BUILDER
# =============================================================================

def build_index(catalogue: DatasetCatalogue) -> DatasetIndex:
    """
    Builds a DatasetIndex from a DatasetCatalogue produced by load_dataset().

    Process:
      1. Iterate every ImageRecord in the catalogue.
      2. Generate a unique image ID for each record.
      3. Populate the IndexedImage list.
      4. Build class_registry and crop_registry from the catalogue.

    Args:
        catalogue: The DatasetCatalogue returned by dataset_loader.load_dataset().

    Returns:
        DatasetIndex — the complete index ready for export.
    """
    log.info("Building dataset index from catalogue (%d records) ...", catalogue.total_images)

    images: list[IndexedImage] = []

    for record in catalogue.records:
        image_id = _make_image_id(str(record.image_path))
        images.append(IndexedImage(
            image_id=image_id,
            image_path=str(record.image_path),
            file_name=record.file_name,
            crop_name=record.crop_name,
            category=record.category,
            class_name=record.class_name,
            class_id=record.class_id,
        ))

    crop_registry = sorted({r.crop_name for r in catalogue.records})

    index = DatasetIndex(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        dataset_root=catalogue.dataset_root,
        total_images=catalogue.total_images,
        total_classes=catalogue.total_classes,
        total_crops=catalogue.total_crops,
        images=images,
        class_registry=catalogue.class_to_id,
        crop_registry=crop_registry,
    )

    log.info(
        "Index built — %d images | %d classes | %d crops",
        index.total_images, index.total_classes, index.total_crops,
    )
    return index


# =============================================================================
# SECTION 5 — STATISTICS BUILDER
# =============================================================================

def build_statistics(catalogue: DatasetCatalogue) -> DatasetStatistics:
    """
    Computes aggregated statistics from a DatasetCatalogue.

    Automatically discovers and counts:
      • healthy classes  — records with category == "healthy"
      • disease classes  — records with category == "diseases"
      • pest classes     — records with category == "pests"
      • images per crop
      • images per class

    No crop names, disease names, or pest names are hardcoded.

    Args:
        catalogue: The DatasetCatalogue returned by dataset_loader.load_dataset().

    Returns:
        DatasetStatistics — fully populated statistics object.
    """
    log.info("Computing dataset statistics ...")

    # --- Category-level class sets (unique class names per category) ---
    healthy_classes: set[str] = set()
    disease_classes: set[str] = set()
    pest_classes:    set[str] = set()

    images_per_crop:  dict[str, int] = {}
    images_per_class: dict[str, int] = {}

    for record in catalogue.records:
        # Images per crop
        images_per_crop[record.crop_name] = images_per_crop.get(record.crop_name, 0) + 1

        # Images per class
        images_per_class[record.class_name] = images_per_class.get(record.class_name, 0) + 1

        # Category-level class discovery
        if record.category == "healthy":
            healthy_classes.add(record.class_name)
        elif record.category == "diseases":
            disease_classes.add(record.class_name)
        elif record.category == "pests":
            pest_classes.add(record.class_name)

    # --- Per-crop detail blocks ---
    crop_details: list[CropStatEntry] = []
    for summary in catalogue.crop_summaries:
        crop_records = [r for r in catalogue.records if r.crop_name == summary.crop_name]

        crop_healthy  = {r.class_name for r in crop_records if r.category == "healthy"}
        crop_diseases = {r.class_name for r in crop_records if r.category == "diseases"}
        crop_pests    = {r.class_name for r in crop_records if r.category == "pests"}

        crop_images_per_class: dict[str, int] = {}
        for r in crop_records:
            crop_images_per_class[r.class_name] = crop_images_per_class.get(r.class_name, 0) + 1

        crop_details.append(CropStatEntry(
            crop_name=summary.crop_name,
            total_images=summary.total_images,
            total_classes=summary.total_classes,
            healthy_classes=len(crop_healthy),
            disease_classes=len(crop_diseases),
            pest_classes=len(crop_pests),
            images_per_class=crop_images_per_class,
        ))

    # --- Per-class detail list ---
    class_details: list[ClassStatEntry] = []
    for cls_info in catalogue.classes:
        class_details.append(ClassStatEntry(
            class_name=cls_info.class_name,
            crop_name=cls_info.crop_name,
            category=cls_info.category,
            image_count=cls_info.image_count,
        ))

    stats = DatasetStatistics(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        dataset_root=catalogue.dataset_root,
        total_crops=catalogue.total_crops,
        total_classes=catalogue.total_classes,
        healthy_classes=len(healthy_classes),
        disease_classes=len(disease_classes),
        pest_classes=len(pest_classes),
        total_images=catalogue.total_images,
        images_per_crop=images_per_crop,
        images_per_class=images_per_class,
        crop_details=crop_details,
        class_details=class_details,
    )

    log.info(
        "Statistics — crops: %d | classes: %d (healthy: %d, diseases: %d, pests: %d) | images: %d",
        stats.total_crops,
        stats.total_classes,
        stats.healthy_classes,
        stats.disease_classes,
        stats.pest_classes,
        stats.total_images,
    )
    return stats


# =============================================================================
# SECTION 6 — JSON EXPORT HELPERS
# =============================================================================

def _to_serialisable(obj: Any) -> Any:
    """
    Recursively converts dataclass instances and Path objects to
    JSON-serialisable types. Used as the default= argument to json.dump().
    """
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    if isinstance(obj, Path):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


def _write_json(data: Any, path: Path) -> None:
    """
    Writes a dataclass or dict to a JSON file with UTF-8 encoding.

    Args:
        data: Dataclass instance or dict to serialise.
        path: Absolute path to the output file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = asdict(data) if hasattr(data, "__dataclass_fields__") else data
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False, default=str)
    log.info("Exported: %s", path)


# =============================================================================
# SECTION 7 — PUBLIC EXPORT FUNCTION
# =============================================================================

def export_index(
    catalogue: DatasetCatalogue,
    output_dir: Path | None = None,
) -> tuple[Path, Path]:
    """
    Builds and exports the dataset index and statistics to JSON files.

    Outputs:
      • <output_dir>/dataset_index.json      — full image index with IDs
      • <output_dir>/dataset_statistics.json — aggregated statistics

    Args:
        catalogue:  DatasetCatalogue from dataset_loader.load_dataset().
        output_dir: Directory to write JSON files. Defaults to
                    cfg.paths.outputs_dir (ai/outputs/).

    Returns:
        Tuple of (index_path, statistics_path) as absolute Paths.

    Usage:
        from dataset_loader import load_dataset
        from dataset_indexer import export_index
        catalogue = load_dataset()
        index_path, stats_path = export_index(catalogue)
    """
    cfg = get_config()
    out_dir = output_dir or cfg.paths.outputs_dir

    index      = build_index(catalogue)
    statistics = build_statistics(catalogue)

    index_path = out_dir / _INDEX_FILENAME
    stats_path = out_dir / _STATISTICS_FILENAME

    _write_json(index, index_path)
    _write_json(statistics, stats_path)

    log.info("=== Dataset indexing complete ===")
    log.info("Index      : %s", index_path)
    log.info("Statistics : %s", stats_path)

    return index_path, stats_path


# =============================================================================
# SECTION 8 — MAIN
# =============================================================================

if __name__ == "__main__":
    catalogue = load_dataset()
    index_path, stats_path = export_index(catalogue)

    # Quick summary to stdout
    cfg = get_config()
    print(f"\n{'='*60}")
    print("  AKP Dataset Indexer — Complete")
    print(f"{'='*60}")
    print(f"  Index      : {index_path}")
    print(f"  Statistics : {stats_path}")
    print(f"{'='*60}\n")
