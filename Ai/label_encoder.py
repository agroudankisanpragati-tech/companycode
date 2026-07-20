# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: label_encoder.py
# Purpose: Generate stable, persistent numeric labels for every class
#          discovered in the dataset. Export label_map.json and
#          reverse_label_map.json to outputs/.
#
# DESIGN PRINCIPLES:
#   • No hardcoded class names, crop names, or label numbers.
#   • Labels are generated from the live DatasetCatalogue — no manual registry.
#   • Stability guarantee: existing labels NEVER change across executions.
#     If a new class is added, it receives the next available integer.
#     Existing class → integer mappings are locked once written.
#   • If label_map.json already exists on disk, it is loaded first and
#     only genuinely new classes are appended with new IDs.
#   • This module ONLY encodes labels. It does NOT preprocess, augment,
#     split, train, or run inference.
#
# Run: python label_encoder.py
# =============================================================================

from __future__ import annotations

import json
from pathlib import Path

from config import get_config
from dataset_loader import DatasetCatalogue, load_dataset
from logger import get_logger

log = get_logger(__name__)


# =============================================================================
# SECTION 1 — OUTPUT FILENAMES
# =============================================================================

_LABEL_MAP_FILENAME         = "label_map.json"
_REVERSE_LABEL_MAP_FILENAME = "reverse_label_map.json"


# =============================================================================
# SECTION 2 — STABLE LABEL BUILDER
# =============================================================================

def _build_stable_labels(
    class_names: list[str],
    existing: dict[str, int],
) -> dict[str, int]:
    """
    Merges new class names into an existing label map without disturbing
    any previously assigned integer labels.

    Algorithm:
      1. Start from the existing map (may be empty on first run).
      2. Determine the next available integer (max existing ID + 1, or 0).
      3. Sort the incoming new class names alphabetically for determinism.
      4. Assign sequential integers only to classes not already in the map.

    This guarantees:
      • Existing class → integer mappings are never changed.
      • New classes always receive IDs higher than all existing IDs.
      • Two runs on the same dataset always produce the same map.
      • Adding a new crop or class never renumbers existing classes.

    Args:
        class_names: All class names discovered in the current dataset.
        existing:    Previously persisted label map (may be empty dict).

    Returns:
        Complete label map: {class_name: integer_label} for all classes.
    """
    label_map = dict(existing)
    next_id   = (max(label_map.values()) + 1) if label_map else 0

    new_classes = sorted(name for name in class_names if name not in label_map)

    for name in new_classes:
        label_map[name] = next_id
        next_id += 1
        log.debug("New label assigned: %s → %d", name, label_map[name])

    if new_classes:
        log.info("Added %d new label(s): %s", len(new_classes), new_classes)
    else:
        log.info("No new classes — existing label map is up to date")

    return label_map


# =============================================================================
# SECTION 3 — PERSISTENCE HELPERS
# =============================================================================

def _load_existing_map(path: Path) -> dict[str, int]:
    """
    Loads an existing label_map.json from disk.
    Returns an empty dict if the file does not exist or cannot be parsed.

    Args:
        path: Absolute path to label_map.json.

    Returns:
        {class_name: integer_label} or {} if file is absent/invalid.
    """
    if not path.exists():
        log.info("No existing label map found at %s — starting fresh", path)
        return {}

    try:
        with open(path, "r", encoding="utf-8") as fh:
            data: dict[str, int] = json.load(fh)
        log.info("Loaded existing label map: %d entries from %s", len(data), path)
        return data
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("Could not read existing label map (%s) — starting fresh", exc)
        return {}


def _write_json(data: dict, path: Path) -> None:
    """
    Writes a dict to a JSON file, sorted by key for human readability.

    Args:
        data: The dict to serialise.
        path: Absolute path to the output file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False, sort_keys=True)
    log.info("Exported: %s", path)


# =============================================================================
# SECTION 4 — PUBLIC ENCODE FUNCTION
# =============================================================================

def encode_labels(
    catalogue: DatasetCatalogue,
    output_dir: Path | None = None,
) -> tuple[dict[str, int], dict[int, str]]:
    """
    Generates stable numeric labels for every class in the catalogue and
    exports them to label_map.json and reverse_label_map.json.

    Stability contract:
      If label_map.json already exists in output_dir, existing assignments
      are preserved. Only classes absent from the existing map receive new
      integer labels (appended at the end of the ID sequence).

    Outputs:
      • <output_dir>/label_map.json         — {class_name: integer_label}
      • <output_dir>/reverse_label_map.json — {integer_label: class_name}

    Args:
        catalogue:  DatasetCatalogue from dataset_loader.load_dataset().
        output_dir: Directory to write JSON files. Defaults to
                    cfg.paths.outputs_dir (ai/outputs/).

    Returns:
        Tuple of (label_map, reverse_label_map) as plain dicts.

    Usage:
        from dataset_loader import load_dataset
        from label_encoder import encode_labels
        catalogue = load_dataset()
        label_map, reverse_map = encode_labels(catalogue)
        print(label_map["aphids"])   # e.g. 3
        print(reverse_map[3])        # "aphids"
    """
    cfg     = get_config()
    out_dir = output_dir or cfg.paths.outputs_dir

    label_map_path    = out_dir / _LABEL_MAP_FILENAME
    rev_map_path      = out_dir / _REVERSE_LABEL_MAP_FILENAME

    # Step 1 — Load any previously persisted map to preserve stability
    existing = _load_existing_map(label_map_path)

    # Step 2 — Collect all unique class names from the live catalogue
    all_class_names = list({cls.class_name for cls in catalogue.classes})
    log.info("Classes discovered in catalogue: %d", len(all_class_names))

    # Step 3 — Merge new classes into the stable map
    label_map: dict[str, int] = _build_stable_labels(all_class_names, existing)

    # Step 4 — Build reverse map (int keys serialised as strings for JSON)
    reverse_label_map: dict[int, str] = {v: k for k, v in label_map.items()}
    reverse_label_map_str: dict[str, str] = {
        str(k): v for k, v in reverse_label_map.items()
    }

    # Step 5 — Export
    _write_json(label_map, label_map_path)
    _write_json(reverse_label_map_str, rev_map_path)

    log.info("=== Label encoding complete ===")
    log.info("Total labels : %d", len(label_map))
    log.info("label_map    : %s", label_map_path)
    log.info("reverse_map  : %s", rev_map_path)

    return label_map, reverse_label_map


# =============================================================================
# SECTION 5 — MAIN
# =============================================================================

if __name__ == "__main__":
    catalogue = load_dataset()
    label_map, reverse_map = encode_labels(catalogue)

    print(f"\n{'='*60}")
    print("  AKP Label Encoder — Complete")
    print(f"{'='*60}")
    print(f"  Total labels : {len(label_map)}")
    print(f"\n  {'ID':>4}  CLASS NAME")
    print(f"  {'─'*4}  {'─'*40}")
    for label_id in sorted(reverse_map):
        print(f"  {label_id:>4}  {reverse_map[label_id]}")
    print(f"{'='*60}\n")
