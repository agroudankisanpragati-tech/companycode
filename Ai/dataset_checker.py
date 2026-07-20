# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: dataset_checker.py
# Purpose: Read-only validation of the entire crop_dataset directory.
#
# DESIGN PRINCIPLE — Zero crop knowledge in source code:
#   This file contains NO crop names, NO disease names, NO pest names,
#   NO override maps, and NO registry lists. Everything is discovered
#   by reading the filesystem at runtime.
#
#   Adding cotton, potato, soybean, or any other crop tomorrow requires
#   ZERO changes to this file. Drop the folder in crop_dataset/ and run.
#
# EXPECTED STRUCTURE per crop (auto-discovered, never hardcoded):
#   crop_dataset/
#   └── <any_crop_name>/
#       ├── healthy/          ← one section, images sit in class subfolders
#       ├── diseases/         ← section name matched by prefix "disease"
#       └── pests/            ← section name matched by prefix "pest"
#
# RULE: This script NEVER modifies, moves, renames, or deletes any file.
#       It is 100% read-only. The dataset structure is never touched.
#
# Run: python dataset_checker.py
# =============================================================================

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import get_config
from constants import LOG_FILENAME_DATE_FORMAT, SUPPORTED_IMAGE_EXTENSIONS
from logger import get_logger

log = get_logger(__name__)

# =============================================================================
# SECTION 1 — CANONICAL SECTION NAMES
# =============================================================================
# These are the three logical sections every crop must have.
# Matching is done by prefix so "disease" and "diseases" both resolve
# to the canonical key "diseases" — without any per-crop override map.

_SECTION_HEALTHY  = "healthy"
_SECTION_DISEASES = "diseases"
_SECTION_PESTS    = "pests"

# Maps canonical section name → folder name prefix used to detect it on disk.
# A crop folder whose subdirectory name STARTS WITH the prefix is claimed
# by that section. First match wins. Order matters: most specific first.
_SECTION_PREFIXES: dict[str, str] = {
    _SECTION_HEALTHY:  "healthy",
    _SECTION_DISEASES: "disease",   # matches "disease" AND "diseases"
    _SECTION_PESTS:    "pest",      # matches "pest" AND "pests"
}


# =============================================================================
# SECTION 2 — RESULT DATACLASSES
# =============================================================================

@dataclass(frozen=True)
class ImageIssue:
    """One problem found on one image file."""
    path: str    # Absolute path to the file
    issue: str   # "corrupted" | "unsupported_format" | "duplicate"
    detail: str  # Human-readable explanation


@dataclass
class ClassStats:
    """Statistics for one class folder (leaf directory containing images)."""
    class_name: str        # Folder name = class label used by the model
    category: str          # Canonical section: "healthy" | "diseases" | "pests"
    folder_path: str       # Absolute path to this class folder
    total_files: int = 0   # All files found (any extension)
    valid_images: int = 0  # Supported extension + opened by Pillow successfully
    corrupted: int = 0     # Files Pillow could not open
    unsupported: int = 0   # Files with an unsupported extension
    duplicates: int = 0    # Files whose MD5 matched another file in this folder
    is_empty: bool = False  # True when total_files == 0
    issues: list[ImageIssue] = field(default_factory=list)


@dataclass
class SectionStats:
    """Aggregated statistics for one section (healthy / diseases / pests)."""
    canonical_name: str          # "healthy" | "diseases" | "pests"
    actual_folder_name: str      # Real folder name found on disk (e.g. "disease")
    folder_path: str             # Absolute path to the section folder
    classes: list[ClassStats] = field(default_factory=list)
    total_images: int = 0
    corrupted: int = 0
    duplicates: int = 0
    unsupported: int = 0
    empty_class_folders: int = 0


@dataclass
class CropReport:
    """Full validation report for one crop."""
    crop_name: str              # Folder name — the only identifier needed
    crop_path: str              # Absolute path to the crop folder
    total_images: int = 0
    total_classes: int = 0
    empty_folders: int = 0
    corrupted_images: int = 0
    duplicate_images: int = 0
    unsupported_files: int = 0
    sections: dict[str, SectionStats] = field(default_factory=dict)
    missing_sections: list[str] = field(default_factory=list)
    unrecognised_folders: list[str] = field(default_factory=list)


@dataclass
class DatasetReport:
    """Top-level report covering the entire dataset."""
    generated_at: str       # ISO 8601 timestamp
    dataset_root: str       # Absolute path to crop_dataset/
    total_crops: int = 0
    total_classes: int = 0
    total_images: int = 0
    total_corrupted: int = 0
    total_duplicates: int = 0
    total_unsupported: int = 0
    total_empty_folders: int = 0
    is_ready_for_training: bool = False
    crops: list[CropReport] = field(default_factory=list)


# =============================================================================
# SECTION 3 — FILESYSTEM DISCOVERY
# =============================================================================

def discover_crops(dataset_root: Path) -> list[Path]:
    """
    Returns sorted list of crop directories found inside dataset_root.
    Any immediate subdirectory is treated as a crop — no allowlist needed.
    Hidden directories (names starting with '.') are skipped.
    """
    if not dataset_root.exists():
        log.error("Dataset root does not exist: %s", dataset_root)
        return []

    crops = sorted(
        p for p in dataset_root.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    )
    log.info("Discovered %d crop(s): %s", len(crops), [c.name for c in crops])
    return crops


def _resolve_sections(crop_path: Path) -> tuple[dict[str, Path], list[str], list[str]]:
    """
    Inspects a crop folder and maps each canonical section name to the
    actual subdirectory found on disk.

    Matching rule: a subdirectory is claimed by the first canonical section
    whose prefix matches the start of the subdirectory name (case-insensitive).
    Unmatched subdirectories are collected as unrecognised_folders.

    Returns:
        found    — {canonical_name: actual_path}
        missing  — canonical names with no matching folder
        unknown  — subdirectory names that matched no section prefix
    """
    found: dict[str, Path] = {}
    unknown: list[str] = []

    subdirs = sorted(p for p in crop_path.iterdir() if p.is_dir())

    for subdir in subdirs:
        name_lower = subdir.name.lower()
        matched = False
        for canonical, prefix in _SECTION_PREFIXES.items():
            if name_lower.startswith(prefix) and canonical not in found:
                found[canonical] = subdir
                matched = True
                break
        if not matched:
            unknown.append(subdir.name)

    missing = [s for s in _SECTION_PREFIXES if s not in found]
    return found, missing, unknown


# =============================================================================
# SECTION 4 — IMAGE-LEVEL CHECKS
# =============================================================================

def _md5(path: Path) -> str:
    """
    MD5 hash of a file's binary content for exact duplicate detection.
    Reads in 64 KB chunks — safe for large image files.
    """
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_image_valid(path: Path) -> tuple[bool, str]:
    """
    Attempts to open and verify an image with Pillow.
    Uses img.verify() — checks the file header without decoding all pixels.

    Returns:
        (True, "")            — image is intact
        (False, reason_str)   — image is corrupted; reason explains why
    """
    try:
        from PIL import Image
        with Image.open(path) as img:
            img.verify()
        return True, ""
    except Exception as exc:
        return False, str(exc)


# =============================================================================
# SECTION 5 — CLASS FOLDER SCANNER
# =============================================================================

def _scan_class_folder(folder: Path, category: str) -> ClassStats:
    """
    Scans one class folder (leaf directory containing images).

    Three checks per file, in strict order:
      1. Extension  — skip and flag if not in SUPPORTED_IMAGE_EXTENSIONS
      2. Corruption — skip and flag if Pillow cannot open/verify the file
      3. Duplicate  — flag if MD5 matches a previously seen file in this folder

    Args:
        folder:   Absolute path to the class folder.
        category: Canonical section name this folder belongs to.

    Returns:
        Populated ClassStats.
    """
    stats = ClassStats(
        class_name=folder.name,
        category=category,
        folder_path=str(folder),
    )

    all_files = [f for f in folder.iterdir() if f.is_file()]
    stats.total_files = len(all_files)

    if stats.total_files == 0:
        stats.is_empty = True
        log.warning("Empty class folder: %s", folder)
        return stats

    seen_hashes: dict[str, str] = {}  # md5 → first file path with that hash

    for file_path in sorted(all_files):
        ext = file_path.suffix.lower()

        # Check 1 — unsupported extension
        if ext not in SUPPORTED_IMAGE_EXTENSIONS:
            stats.unsupported += 1
            stats.issues.append(ImageIssue(
                path=str(file_path),
                issue="unsupported_format",
                detail=f"Extension '{ext}' is not supported",
            ))
            continue

        # Check 2 — corruption
        valid, reason = _is_image_valid(file_path)
        if not valid:
            stats.corrupted += 1
            stats.issues.append(ImageIssue(
                path=str(file_path),
                issue="corrupted",
                detail=reason,
            ))
            log.warning("Corrupted: %s — %s", file_path.name, reason)
            continue

        # Check 3 — duplicate
        digest = _md5(file_path)
        if digest in seen_hashes:
            stats.duplicates += 1
            stats.issues.append(ImageIssue(
                path=str(file_path),
                issue="duplicate",
                detail=f"Same content as: {Path(seen_hashes[digest]).name}",
            ))
        else:
            seen_hashes[digest] = str(file_path)
            stats.valid_images += 1

    return stats


# =============================================================================
# SECTION 6 — SECTION SCANNER
# =============================================================================

def _scan_section(
    section_path: Path,
    canonical_name: str,
) -> SectionStats:
    """
    Scans one section folder (e.g. healthy/, diseases/, pests/).
    Each immediate subdirectory is treated as one class.

    Args:
        section_path:   Absolute path to the section folder on disk.
        canonical_name: The logical name ("healthy", "diseases", "pests").

    Returns:
        Populated SectionStats.
    """
    stats = SectionStats(
        canonical_name=canonical_name,
        actual_folder_name=section_path.name,
        folder_path=str(section_path),
    )

    class_folders = sorted(p for p in section_path.iterdir() if p.is_dir())

    if not class_folders:
        log.warning("No class subfolders in section: %s", section_path)
        return stats

    for class_folder in class_folders:
        cls = _scan_class_folder(class_folder, canonical_name)
        stats.classes.append(cls)
        stats.total_images  += cls.valid_images
        stats.corrupted     += cls.corrupted
        stats.duplicates    += cls.duplicates
        stats.unsupported   += cls.unsupported
        if cls.is_empty:
            stats.empty_class_folders += 1

    return stats


# =============================================================================
# SECTION 7 — CROP SCANNER
# =============================================================================

def _scan_crop(crop_path: Path) -> CropReport:
    """
    Scans all sections of one crop folder.

    Section discovery is fully filesystem-driven:
      - Subdirectories are matched to canonical sections by name prefix.
      - No crop name, disease name, or pest name is referenced in code.
      - Unrecognised subdirectories are logged and recorded, not silently ignored.

    Args:
        crop_path: Absolute path to the crop folder.

    Returns:
        Populated CropReport.
    """
    report = CropReport(
        crop_name=crop_path.name,
        crop_path=str(crop_path),
    )

    log.info("Scanning crop: %s", crop_path.name)

    section_paths, missing, unknown = _resolve_sections(crop_path)

    if missing:
        report.missing_sections = missing
        for s in missing:
            log.warning("[%s] Missing section: %s/", crop_path.name, s)

    if unknown:
        report.unrecognised_folders = unknown
        for u in unknown:
            log.warning("[%s] Unrecognised subfolder (skipped): %s/", crop_path.name, u)

    for canonical_name, actual_path in section_paths.items():
        section_stats = _scan_section(actual_path, canonical_name)
        report.sections[canonical_name] = section_stats
        report.total_images      += section_stats.total_images
        report.corrupted_images  += section_stats.corrupted
        report.duplicate_images  += section_stats.duplicates
        report.unsupported_files += section_stats.unsupported
        report.empty_folders     += section_stats.empty_class_folders
        report.total_classes     += len(section_stats.classes)

    log.info(
        "[%s] Done — %d images | %d classes | %d corrupted | %d duplicates | %d empty",
        crop_path.name,
        report.total_images,
        report.total_classes,
        report.corrupted_images,
        report.duplicate_images,
        report.empty_folders,
    )

    return report


# =============================================================================
# SECTION 8 — PUBLIC ENTRY POINT
# =============================================================================

def check_dataset(crop_names: Optional[list[str]] = None) -> DatasetReport:
    """
    Scans the dataset and returns a structured DatasetReport.

    Crop discovery is automatic — no registry, no config list.
    Every subdirectory of crop_dataset/ is treated as a crop.

    Args:
        crop_names: Optional explicit list of crop folder names to scan.
                    If None, all crops are discovered from the filesystem.

    Returns:
        DatasetReport — the complete validation result.

    Usage:
        from dataset_checker import check_dataset, save_report
        report = check_dataset()
        save_report(report)
    """
    cfg = get_config()
    dataset_root = cfg.paths.dataset_root

    if crop_names is not None:
        # Caller specified explicit crops — resolve to paths, validate existence
        crop_paths = []
        for name in crop_names:
            p = dataset_root / name
            if p.is_dir():
                crop_paths.append(p)
            else:
                log.error("Requested crop folder not found: %s", p)
    else:
        # Default: discover everything on disk
        crop_paths = discover_crops(dataset_root)

    log.info("=" * 60)
    log.info("AKP Dataset Checker — Starting scan")
    log.info("Dataset root : %s", dataset_root)
    log.info("Crops found  : %d", len(crop_paths))
    log.info("=" * 60)

    report = DatasetReport(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        dataset_root=str(dataset_root),
        total_crops=len(crop_paths),
    )

    for crop_path in crop_paths:
        crop_report = _scan_crop(crop_path)
        report.crops.append(crop_report)
        report.total_classes       += crop_report.total_classes
        report.total_images        += crop_report.total_images
        report.total_corrupted     += crop_report.corrupted_images
        report.total_duplicates    += crop_report.duplicate_images
        report.total_unsupported   += crop_report.unsupported_files
        report.total_empty_folders += crop_report.empty_folders

    report.is_ready_for_training = (
        report.total_corrupted == 0
        and report.total_empty_folders == 0
        and report.total_images > 0
        and all(not c.missing_sections for c in report.crops)
    )

    log.info("=" * 60)
    log.info("Scan complete")
    log.info("Total crops      : %d", report.total_crops)
    log.info("Total images     : %d", report.total_images)
    log.info("Total classes    : %d", report.total_classes)
    log.info("Corrupted        : %d", report.total_corrupted)
    log.info("Duplicates       : %d", report.total_duplicates)
    log.info("Unsupported      : %d", report.total_unsupported)
    log.info("Empty folders    : %d", report.total_empty_folders)
    log.info("Ready for training: %s", report.is_ready_for_training)
    log.info("=" * 60)

    return report


# =============================================================================
# SECTION 9 — REPORT WRITER
# =============================================================================

def save_report(report: DatasetReport) -> Path:
    """
    Serialises the DatasetReport to a timestamped JSON file in
    outputs/reports/. Creates the directory if it does not exist.

    Args:
        report: The DatasetReport returned by check_dataset().

    Returns:
        Path to the saved JSON file.
    """
    cfg = get_config()
    reports_dir = cfg.paths.reports_dir
    reports_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime(LOG_FILENAME_DATE_FORMAT)
    report_path = reports_dir / f"dataset_check_{timestamp}.json"

    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(asdict(report), fh, indent=2, ensure_ascii=False)

    log.info("Report saved: %s", report_path)
    return report_path


# =============================================================================
# SECTION 10 — CONSOLE SUMMARY PRINTER
# =============================================================================

def _print_summary(report: DatasetReport) -> None:
    """Prints a fixed-width summary table to stdout."""
    W = 68
    SEP = "=" * W

    print(f"\n{SEP}")
    print(f"  AKP Dataset Validation Report")
    print(f"  Generated : {report.generated_at}")
    print(f"  Dataset   : {report.dataset_root}")
    print(SEP)

    # Per-crop table
    col = f"  {'CROP':<24} {'IMAGES':>7} {'CLASSES':>8} {'CORRUPT':>8} {'DUPES':>6} {'EMPTY':>6}"
    print(f"\n{col}")
    print(f"  {'-'*24} {'-'*7} {'-'*8} {'-'*8} {'-'*6} {'-'*6}")

    for crop in report.crops:
        has_issues = (
            crop.corrupted_images
            or crop.empty_folders
            or crop.missing_sections
        )
        flag = " ⚠" if has_issues else ""
        print(
            f"  {crop.crop_name:<24}"
            f"{crop.total_images:>7,}"
            f"{crop.total_classes:>9}"
            f"{crop.corrupted_images:>9}"
            f"{crop.duplicate_images:>7}"
            f"{crop.empty_folders:>7}"
            f"{flag}"
        )

    print(f"  {'-'*24} {'-'*7} {'-'*8} {'-'*8} {'-'*6} {'-'*6}")
    print(
        f"  {'TOTAL':<24}"
        f"{report.total_images:>7,}"
        f"{report.total_classes:>9}"
        f"{report.total_corrupted:>9}"
        f"{report.total_duplicates:>7}"
        f"{report.total_empty_folders:>7}"
    )

    # Per-section breakdown
    print(f"\n  {'─'*64}")
    print(f"  SECTION BREAKDOWN")
    print(f"  {'─'*64}")
    for crop in report.crops:
        for canonical, sec in crop.sections.items():
            actual = sec.actual_folder_name
            label = f"{crop.crop_name}/{actual}"
            n_classes = len(sec.classes)
            print(
                f"  {label:<34}"
                f"{sec.total_images:>6,} imgs"
                f"  {n_classes:>3} classes"
            )

    # Issue details
    has_any_issue = False
    for crop in report.crops:
        if crop.missing_sections:
            if not has_any_issue:
                print(f"\n  {'─'*64}")
                print(f"  ISSUES")
                print(f"  {'─'*64}")
                has_any_issue = True
            print(f"\n  ⚠  [{crop.crop_name}] Missing sections: {', '.join(crop.missing_sections)}")

        if crop.unrecognised_folders:
            if not has_any_issue:
                print(f"\n  {'─'*64}")
                print(f"  ISSUES")
                print(f"  {'─'*64}")
                has_any_issue = True
            print(f"  ⚠  [{crop.crop_name}] Unrecognised folders: {', '.join(crop.unrecognised_folders)}")

        for sec in crop.sections.values():
            for cls in sec.classes:
                for issue in cls.issues:
                    if not has_any_issue:
                        print(f"\n  {'─'*64}")
                        print(f"  ISSUES")
                        print(f"  {'─'*64}")
                        has_any_issue = True
                    short = Path(issue.path).name
                    print(
                        f"  [{issue.issue.upper():<18}] "
                        f"{crop.crop_name}/{sec.actual_folder_name}/{cls.class_name}/{short}"
                    )

    # Unsupported files count (non-critical, shown separately)
    if report.total_unsupported:
        print(f"\n  Unsupported format files: {report.total_unsupported}")

    # Final verdict
    print(f"\n{SEP}")
    if report.is_ready_for_training:
        print("  ✓  Dataset is CLEAN — ready for training")
    else:
        print("  ✗  Dataset has issues — resolve before training")
        if report.total_corrupted:
            print(f"     → {report.total_corrupted} corrupted image(s) must be removed or replaced")
        if report.total_empty_folders:
            print(f"     → {report.total_empty_folders} empty class folder(s) must be populated or removed")
        missing_crops = [c.crop_name for c in report.crops if c.missing_sections]
        if missing_crops:
            print(f"     → Missing sections in: {', '.join(missing_crops)}")
    print(f"{SEP}\n")


# =============================================================================
# SECTION 11 — MAIN
# =============================================================================

if __name__ == "__main__":
    report = check_dataset()
    _print_summary(report)
    saved_path = save_report(report)
    print(f"  Full report saved to:\n  {saved_path}\n")
