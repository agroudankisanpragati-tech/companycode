# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: dataset_loader.py
# Purpose: Discover every crop, section, and class folder in crop_dataset/
#          and return a fully structured, validated catalogue of image records.
#
# DESIGN PRINCIPLES:
#   • Zero crop knowledge in source code — no crop names, disease names,
#     or pest names are hardcoded anywhere in this file.
#   • Adding mustard, wheat, bajra, cotton, potato, soybean, onion, chilli
#     (or any other crop) tomorrow requires ZERO changes here.
#     Drop the folder in crop_dataset/ and call load_dataset().
#   • This module ONLY loads data. It does NOT:
#       - open or decode image pixels
#       - perform augmentation or preprocessing
#       - split data into train / val / test sets
#       - train or run inference on any model
#     Those responsibilities belong to later modules.
#
# EXPECTED STRUCTURE (auto-discovered, never hardcoded):
#   crop_dataset/
#   └── <crop_name>/
#       ├── healthy/
#       │   └── <class_name>/   ← images live here
#       ├── diseases/           ← also matched as "disease", "disease_data", etc.
#       │   └── <class_name>/
#       └── pests/              ← also matched as "pest", "pest_data", etc.
#           └── <class_name>/
#
# Run: python dataset_loader.py
# =============================================================================

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config import get_config
from constants import SUPPORTED_IMAGE_EXTENSIONS
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — SECTION PREFIX MAP
# =============================================================================
# Canonical section names and the folder-name prefix used to detect them.
# Matching is case-insensitive and prefix-based, so:
#   "disease"  → diseases canonical
#   "diseases" → diseases canonical
#   "pest"     → pests canonical
#   "pests"    → pests canonical
# No per-crop override map is needed or used.

_SECTION_PREFIXES: dict[str, str] = {
    "healthy":  "healthy",
    "diseases": "disease",
    "pests":    "pest",
}


# =============================================================================
# SECTION 2 — PUBLIC DATA STRUCTURES
# =============================================================================

@dataclass(frozen=True)
class ImageRecord:
    """
    Immutable descriptor for one valid image file in the dataset.

    This is the atomic unit consumed by every downstream module
    (train.py, augmentation pipeline, inference engine).
    frozen=True guarantees records are never accidentally mutated
    after the catalogue is built.

    Fields:
        image_path  — Absolute Path to the image file on disk.
        crop_name   — Folder name of the crop (e.g. "Black_gram", "Tomato").
        category    — Canonical section: "healthy" | "diseases" | "pests".
        class_name  — Folder name of the class (e.g. "Early_Blight", "aphids").
                      For the healthy section this equals the crop name because
                      healthy images sit directly in one folder named after the
                      crop's healthy state — no sub-class needed.
        class_id    — Globally unique integer label assigned at catalogue build
                      time. Assignment is deterministic: classes are sorted
                      alphabetically across the full dataset before numbering,
                      so the same dataset always produces the same IDs.
                      Downstream label encoders may override this if needed.
        file_name   — Bare filename including extension (e.g. "img_001.jpg").
    """
    image_path: Path
    crop_name:  str
    category:   str
    class_name: str
    class_id:   int
    file_name:  str


@dataclass
class ClassInfo:
    """
    Metadata for one discovered class (leaf folder).

    Not frozen — populated incrementally during discovery.
    """
    class_name:   str    # Folder name = label used by the model
    crop_name:    str    # Parent crop folder name
    category:     str    # Canonical section name
    folder_path:  Path   # Absolute path to this class folder
    image_count:  int = 0
    class_id:     int = -1   # Assigned after all classes are discovered


@dataclass
class CropSummary:
    """Per-crop statistics included in the DatasetCatalogue."""
    crop_name:    str
    crop_path:    str
    total_images: int = 0
    total_classes: int = 0
    sections_found: list[str] = field(default_factory=list)
    sections_missing: list[str] = field(default_factory=list)


@dataclass
class DatasetCatalogue:
    """
    The complete, structured result of a dataset load operation.

    This is the single object passed to every downstream module.
    It contains:
      • records       — flat list of every ImageRecord (one per valid image)
      • classes       — ordered list of ClassInfo (sorted, IDs assigned)
      • class_to_id   — fast lookup: class_name → class_id
      • id_to_class   — reverse lookup: class_id → class_name
      • crop_summaries — per-crop statistics
      • dataset_root  — absolute path used during this load

    Usage:
        from dataset_loader import load_dataset
        catalogue = load_dataset()
        print(catalogue.total_images)
        for record in catalogue.records:
            print(record.image_path, record.class_id)
    """
    dataset_root:   str
    records:        list[ImageRecord]       = field(default_factory=list)
    classes:        list[ClassInfo]         = field(default_factory=list)
    class_to_id:    dict[str, int]          = field(default_factory=dict)
    id_to_class:    dict[int, str]          = field(default_factory=dict)
    crop_summaries: list[CropSummary]       = field(default_factory=list)

    @property
    def total_images(self) -> int:
        return len(self.records)

    @property
    def total_classes(self) -> int:
        return len(self.classes)

    @property
    def total_crops(self) -> int:
        return len(self.crop_summaries)

    def records_for_crop(self, crop_name: str) -> list[ImageRecord]:
        """Returns all records belonging to the given crop."""
        return [r for r in self.records if r.crop_name == crop_name]

    def records_for_category(self, category: str) -> list[ImageRecord]:
        """Returns all records for a canonical category (healthy/diseases/pests)."""
        return [r for r in self.records if r.category == category]

    def records_for_class(self, class_name: str) -> list[ImageRecord]:
        """Returns all records for a specific class label."""
        return [r for r in self.records if r.class_name == class_name]


@dataclass(frozen=True)
class LoaderFilter:
    """
    Optional filter applied during load_dataset() to restrict which
    records are included in the returned catalogue.

    All fields default to None (= no restriction).
    Filters are AND-combined: a record must pass every non-None filter.

    Usage:
        # Load only disease images for Black_gram and Tomato
        f = LoaderFilter(
            crop_names=["Black_gram", "Tomato"],
            categories=["diseases"],
        )
        catalogue = load_dataset(loader_filter=f)
    """
    crop_names:  Optional[frozenset[str]] = None   # Restrict to these crops
    categories:  Optional[frozenset[str]] = None   # "healthy"|"diseases"|"pests"
    class_names: Optional[frozenset[str]] = None   # Restrict to these class labels


# =============================================================================
# SECTION 3 — FILESYSTEM DISCOVERY HELPERS
# =============================================================================

def _discover_crop_dirs(dataset_root: Path) -> list[Path]:
    """
    Returns a sorted list of crop directories found directly inside
    dataset_root. Any non-hidden subdirectory is treated as a crop.
    No allowlist, no registry — purely filesystem-driven.

    Args:
        dataset_root: Absolute path to crop_dataset/.

    Returns:
        Sorted list of crop directory Paths.
        Empty list if dataset_root does not exist.
    """
    if not dataset_root.is_dir():
        log.error("Dataset root not found: %s", dataset_root)
        return []

    crops = sorted(
        p for p in dataset_root.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    )
    log.info("Discovered %d crop folder(s): %s", len(crops), [c.name for c in crops])
    return crops


def _resolve_section_dirs(crop_path: Path) -> tuple[dict[str, Path], list[str]]:
    """
    Maps each canonical section name to the actual subdirectory found
    inside a crop folder, using prefix-based case-insensitive matching.

    Matching rule (from _SECTION_PREFIXES):
      A subdirectory is claimed by the first canonical section whose
      prefix is a case-insensitive prefix of the subdirectory name.
      First match wins. Each canonical section is claimed at most once.

    Args:
        crop_path: Absolute path to one crop folder.

    Returns:
        found   — {canonical_name: actual_Path}
        missing — list of canonical names with no matching folder
    """
    found: dict[str, Path] = {}

    for subdir in sorted(p for p in crop_path.iterdir() if p.is_dir()):
        name_lower = subdir.name.lower()
        for canonical, prefix in _SECTION_PREFIXES.items():
            if name_lower.startswith(prefix) and canonical not in found:
                found[canonical] = subdir
                log.debug(
                    "[%s] Section '%s' → folder '%s'",
                    crop_path.name, canonical, subdir.name,
                )
                break

    missing = [s for s in _SECTION_PREFIXES if s not in found]
    if missing:
        log.warning("[%s] Missing sections: %s", crop_path.name, missing)

    return found, missing


def _discover_class_dirs(section_path: Path, crop_name: str, category: str) -> list[ClassInfo]:
    """
    Discovers class folders inside one section directory.
    Each immediate subdirectory is one class.

    Args:
        section_path: Absolute path to the section folder (e.g. diseases/).
        crop_name:    Parent crop folder name.
        category:     Canonical section name ("healthy", "diseases", "pests").

    Returns:
        List of ClassInfo, one per discovered class folder.
        Empty list if no subdirectories exist.
    """
    class_dirs = sorted(p for p in section_path.iterdir() if p.is_dir())

    if not class_dirs:
        log.warning(
            "[%s/%s] No class subfolders found in: %s",
            crop_name, category, section_path,
        )
        return []

    classes: list[ClassInfo] = []
    for class_dir in class_dirs:
        classes.append(ClassInfo(
            class_name=class_dir.name,
            crop_name=crop_name,
            category=category,
            folder_path=class_dir,
        ))
        log.debug("[%s/%s] Class found: %s", crop_name, category, class_dir.name)

    return classes


# =============================================================================
# SECTION 4 — IMAGE PATH COLLECTOR
# =============================================================================

def _collect_image_paths(class_folder: Path) -> list[Path]:
    """
    Returns a sorted list of valid image file Paths inside a class folder.

    Validation performed:
      • File must be a regular file (not a directory or symlink to directory).
      • File extension must be in SUPPORTED_IMAGE_EXTENSIONS (from constants.py).

    This function does NOT open or decode any image. It only checks the
    file extension. Corruption detection is the responsibility of
    dataset_checker.py, which should be run before training.

    Args:
        class_folder: Absolute path to a class folder.

    Returns:
        Sorted list of valid image Paths. Empty list if none found.
    """
    valid: list[Path] = []
    skipped = 0

    for f in sorted(class_folder.iterdir()):
        if not f.is_file():
            continue
        if f.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS:
            valid.append(f)
        else:
            skipped += 1
            log.debug("Skipped unsupported file: %s", f.name)

    if skipped:
        log.warning(
            "[%s] Skipped %d unsupported file(s)", class_folder.name, skipped
        )

    return valid


# =============================================================================
# SECTION 5 — CLASS ID ASSIGNMENT
# =============================================================================

def _assign_class_ids(classes: list[ClassInfo]) -> tuple[dict[str, int], dict[int, str]]:
    """
    Assigns a globally unique, deterministic integer ID to every class.

    Assignment strategy:
      Classes are sorted alphabetically by class_name before numbering.
      This guarantees the same dataset always produces the same IDs
      regardless of filesystem iteration order.

    Args:
        classes: All ClassInfo objects discovered across the entire dataset.

    Returns:
        class_to_id — {class_name: integer_id}
        id_to_class — {integer_id: class_name}

    Note:
        If two classes in different crops share the same folder name
        (e.g. both have an "aphids" pest class), they receive the SAME
        class_id. This is intentional for a unified multi-crop classifier.
        If per-crop isolation is needed, use crop_name + class_name as the
        compound key in the downstream label encoder.
    """
    unique_names = sorted({c.class_name for c in classes})
    class_to_id = {name: idx for idx, name in enumerate(unique_names)}
    id_to_class = {idx: name for name, idx in class_to_id.items()}

    for cls in classes:
        cls.class_id = class_to_id[cls.class_name]

    log.info("Assigned %d unique class IDs", len(class_to_id))
    return class_to_id, id_to_class


# =============================================================================
# SECTION 6 — FILTER APPLICATION
# =============================================================================

def _passes_filter(
    record: ImageRecord,
    loader_filter: Optional[LoaderFilter],
) -> bool:
    """
    Returns True if the record satisfies all active filter criteria.
    A None filter always passes. Each non-None filter field is AND-combined.

    Args:
        record:        The ImageRecord to test.
        loader_filter: The LoaderFilter to apply, or None for no filtering.

    Returns:
        True if the record should be included in the catalogue.
    """
    if loader_filter is None:
        return True
    if loader_filter.crop_names is not None and record.crop_name not in loader_filter.crop_names:
        return False
    if loader_filter.categories is not None and record.category not in loader_filter.categories:
        return False
    if loader_filter.class_names is not None and record.class_name not in loader_filter.class_names:
        return False
    return True


# =============================================================================
# SECTION 7 — CROP LOADER
# =============================================================================

def _load_crop(
    crop_path: Path,
    class_to_id: dict[str, int],
    loader_filter: Optional[LoaderFilter],
) -> tuple[list[ImageRecord], CropSummary]:
    """
    Loads all valid image records for one crop.

    Walks: crop → sections → class folders → image files.
    Applies the loader_filter at the record level before appending.

    Args:
        crop_path:    Absolute path to the crop folder.
        class_to_id:  Pre-built class name → ID mapping.
        loader_filter: Optional filter to restrict records.

    Returns:
        records  — list of ImageRecord for this crop
        summary  — CropSummary with per-crop statistics
    """
    crop_name = crop_path.name
    records: list[ImageRecord] = []

    summary = CropSummary(
        crop_name=crop_name,
        crop_path=str(crop_path),
    )

    # Skip this crop entirely if the filter excludes it
    if (
        loader_filter is not None
        and loader_filter.crop_names is not None
        and crop_name not in loader_filter.crop_names
    ):
        log.debug("Crop '%s' excluded by filter", crop_name)
        return records, summary

    section_dirs, missing = _resolve_section_dirs(crop_path)
    summary.sections_found   = list(section_dirs.keys())
    summary.sections_missing = missing

    for canonical_name, section_path in section_dirs.items():
        class_infos = _discover_class_dirs(section_path, crop_name, canonical_name)

        for cls_info in class_infos:
            image_paths = _collect_image_paths(cls_info.folder_path)
            cls_info.image_count = len(image_paths)

            for img_path in image_paths:
                record = ImageRecord(
                    image_path=img_path,
                    crop_name=crop_name,
                    category=canonical_name,
                    class_name=cls_info.class_name,
                    class_id=class_to_id.get(cls_info.class_name, -1),
                    file_name=img_path.name,
                )
                if _passes_filter(record, loader_filter):
                    records.append(record)

            summary.total_classes += 1
            summary.total_images  += cls_info.image_count

    log.info(
        "[%s] Loaded %d images across %d classes | sections: %s",
        crop_name,
        summary.total_images,
        summary.total_classes,
        summary.sections_found,
    )

    return records, summary


# =============================================================================
# SECTION 8 — PUBLIC ENTRY POINT
# =============================================================================

def load_dataset(
    crop_names: Optional[list[str]] = None,
    loader_filter: Optional[LoaderFilter] = None,
) -> DatasetCatalogue:
    """
    Discovers and loads the entire dataset into a structured DatasetCatalogue.

    This is the only public function external modules need to call.
    Everything is discovered from the filesystem — no crop names, disease
    names, or pest names are hardcoded anywhere in this module.

    Process:
      1. Discover all crop directories in crop_dataset/.
      2. For each crop, resolve section folders (healthy/diseases/pests)
         using prefix-based matching.
      3. For each section, discover class subfolders.
      4. For each class folder, collect valid image file paths.
      5. Assign globally unique, deterministic class IDs.
      6. Build and return a DatasetCatalogue.

    Args:
        crop_names:    Optional explicit list of crop folder names to load.
                       If None, all crops are discovered automatically.
        loader_filter: Optional LoaderFilter to restrict which records are
                       included. Filtering is applied per-record after
                       class IDs are assigned, so the ID space is always
                       consistent regardless of what is filtered out.

    Returns:
        DatasetCatalogue — the complete structured dataset.

    Usage:
        # Load everything
        from dataset_loader import load_dataset
        catalogue = load_dataset()

        # Load only disease images for two crops
        from dataset_loader import load_dataset, LoaderFilter
        f = LoaderFilter(
            crop_names=frozenset(["Black_gram", "Tomato"]),
            categories=frozenset(["diseases"]),
        )
        catalogue = load_dataset(loader_filter=f)

        # Iterate records
        for record in catalogue.records:
            print(record.image_path, record.crop_name, record.class_id)
    """
    cfg = get_config()
    dataset_root = cfg.paths.dataset_root

    log.info("=" * 60)
    log.info("AKP Dataset Loader — Starting")
    log.info("Dataset root : %s", dataset_root)
    log.info("=" * 60)

    # Step 1 — Discover crop directories
    if crop_names is not None:
        crop_paths: list[Path] = []
        for name in crop_names:
            p = dataset_root / name
            if p.is_dir():
                crop_paths.append(p)
            else:
                log.error("Requested crop folder not found: %s", p)
        crop_paths = sorted(crop_paths)
    else:
        crop_paths = _discover_crop_dirs(dataset_root)

    if not crop_paths:
        log.error("No crop directories found. Returning empty catalogue.")
        return DatasetCatalogue(dataset_root=str(dataset_root))

    # Step 2 — First pass: discover ALL classes across ALL crops to build
    #           the complete class ID space before loading any records.
    #           This ensures class IDs are stable regardless of filter.
    log.info("Pass 1/2 — Discovering all classes for ID assignment ...")
    all_classes: list[ClassInfo] = []

    for crop_path in crop_paths:
        section_dirs, _ = _resolve_section_dirs(crop_path)
        for canonical_name, section_path in section_dirs.items():
            all_classes.extend(
                _discover_class_dirs(section_path, crop_path.name, canonical_name)
            )

    if not all_classes:
        log.error("No class folders found in any crop. Returning empty catalogue.")
        return DatasetCatalogue(dataset_root=str(dataset_root))

    # Step 3 — Assign deterministic class IDs
    class_to_id, id_to_class = _assign_class_ids(all_classes)

    # Step 4 — Second pass: load image records with IDs and apply filter
    log.info("Pass 2/2 — Loading image records ...")
    all_records: list[ImageRecord] = []
    crop_summaries: list[CropSummary] = []

    for crop_path in crop_paths:
        records, summary = _load_crop(crop_path, class_to_id, loader_filter)
        all_records.extend(records)
        crop_summaries.append(summary)

    # Step 5 — Build catalogue
    catalogue = DatasetCatalogue(
        dataset_root=str(dataset_root),
        records=all_records,
        classes=sorted(all_classes, key=lambda c: c.class_id),
        class_to_id=class_to_id,
        id_to_class=id_to_class,
        crop_summaries=crop_summaries,
    )

    log.info("=" * 60)
    log.info("Dataset loaded successfully")
    log.info("Total crops   : %d", catalogue.total_crops)
    log.info("Total classes : %d", catalogue.total_classes)
    log.info("Total images  : %d", catalogue.total_images)
    log.info("=" * 60)

    return catalogue


# =============================================================================
# SECTION 9 — CATALOGUE SUMMARY PRINTER
# =============================================================================

def print_catalogue_summary(catalogue: DatasetCatalogue) -> None:
    """
    Prints a structured summary of the DatasetCatalogue to stdout.
    Useful for quick inspection after calling load_dataset().

    Args:
        catalogue: The DatasetCatalogue returned by load_dataset().
    """
    W = 68
    SEP = "=" * W

    print(f"\n{SEP}")
    print(f"  AKP Dataset Catalogue Summary")
    print(f"  Dataset : {catalogue.dataset_root}")
    print(SEP)
    print(f"  Total crops   : {catalogue.total_crops}")
    print(f"  Total classes : {catalogue.total_classes}")
    print(f"  Total images  : {catalogue.total_images:,}")

    # Per-crop table
    print(f"\n  {'CROP':<26} {'IMAGES':>7} {'CLASSES':>8} {'SECTIONS FOUND'}")
    print(f"  {'-'*26} {'-'*7} {'-'*8} {'-'*20}")
    for s in catalogue.crop_summaries:
        sections_str = ", ".join(sorted(s.sections_found))
        missing_str  = (
            f"  ⚠ missing: {', '.join(s.sections_missing)}"
            if s.sections_missing else ""
        )
        print(
            f"  {s.crop_name:<26}"
            f"{s.total_images:>7,}"
            f"{s.total_classes:>9}"
            f"  {sections_str}{missing_str}"
        )

    # Per-category breakdown
    categories = ["healthy", "diseases", "pests"]
    print(f"\n  {'CATEGORY':<12} {'IMAGES':>8} {'CLASSES':>8}")
    print(f"  {'-'*12} {'-'*8} {'-'*8}")
    for cat in categories:
        cat_records = catalogue.records_for_category(cat)
        cat_classes = {r.class_name for r in cat_records}
        print(f"  {cat:<12} {len(cat_records):>8,} {len(cat_classes):>8}")

    # Class ID table (first 20 to avoid flooding the terminal)
    print(f"\n  CLASS ID MAP (first 20 of {catalogue.total_classes})")
    print(f"  {'ID':>4}  CLASS NAME")
    print(f"  {'-'*4}  {'-'*40}")
    for cls in catalogue.classes[:20]:
        print(f"  {cls.class_id:>4}  {cls.class_name}  [{cls.crop_name}/{cls.category}]")
    if catalogue.total_classes > 20:
        print(f"  ... and {catalogue.total_classes - 20} more classes")

    print(f"\n{SEP}\n")


# =============================================================================
# SECTION 10 — MAIN
# =============================================================================

if __name__ == "__main__":
    catalogue = load_dataset()
    print_catalogue_summary(catalogue)
