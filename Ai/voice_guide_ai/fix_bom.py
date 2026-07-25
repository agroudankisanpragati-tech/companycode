"""
Voice Guide AI — BOM Repair Tool.

STEP 1: Recursively scan every *.json file under the project root.
STEP 2: Detect UTF-8 BOM (0xEF 0xBB 0xBF).
        If present — strip it and re-save as clean UTF-8 (no BOM).
STEP 3: Validate every JSON file after stripping.
        Report: file path, reason, line, column for any parse error.
STEP 4: Print a startup-style summary:
        ✓ Valid   — file loaded cleanly
        ✗ Invalid — file path + parse error detail

Run:
    python fix_bom.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent

_SCAN_DIRS = [
    _HERE / "dialogues",
    _HERE / "translations",
    _HERE / "localization" / "config",
    _HERE / "config",
    _HERE / "avatar" / "config",
    _HERE / "avatar" / "metadata",
    _HERE / "voice" / "configs",
    _HERE / "voice" / "metadata",
]

_UTF8_BOM = b"\xef\xbb\xbf"


def _collect_json_files() -> list[Path]:
    files: list[Path] = []
    for scan_dir in _SCAN_DIRS:
        if scan_dir.exists():
            files.extend(sorted(scan_dir.rglob("*.json")))
    return files


def _strip_bom(path: Path) -> bool:
    """Strip BOM from *path* if present. Returns True if BOM was removed."""
    raw = path.read_bytes()
    if raw.startswith(_UTF8_BOM):
        path.write_bytes(raw[3:])
        return True
    return False


def _validate_json(path: Path) -> tuple[bool, str]:
    """
    Validate JSON at *path*.
    Returns (True, "") on success or (False, "reason: line col") on failure.
    """
    try:
        with open(path, encoding="utf-8-sig") as fh:
            json.load(fh)
        return True, ""
    except json.JSONDecodeError as exc:
        return False, f"{exc.msg}: line {exc.lineno} col {exc.colno}"
    except UnicodeDecodeError as exc:
        return False, f"Encoding error: {exc}"
    except OSError as exc:
        return False, f"Read error: {exc}"


def main() -> int:
    files = _collect_json_files()

    if not files:
        print("No JSON files found. Check that the project root is correct.")
        return 1

    bom_stripped: list[Path] = []
    valid: list[Path] = []
    invalid: list[tuple[Path, str]] = []

    print(f"Scanning {len(files)} JSON files...\n")

    for path in files:
        # Step 2 — strip BOM
        if _strip_bom(path):
            bom_stripped.append(path)

        # Step 3 — validate
        ok, reason = _validate_json(path)
        if ok:
            valid.append(path)
        else:
            invalid.append((path, reason))

    # Step 4 — report
    print("=" * 70)
    print("BOM REPAIR REPORT")
    print("=" * 70)

    if bom_stripped:
        print(f"\nBOM stripped from {len(bom_stripped)} file(s):")
        for p in bom_stripped:
            print(f"  [FIXED] {p.relative_to(_HERE)}")
    else:
        print("\nNo BOM found in any file.")

    print(f"\nValidation results ({len(files)} files):")
    for p in valid:
        print(f"  [OK]   {p.relative_to(_HERE)}")
    for p, reason in invalid:
        print(f"  [FAIL] {p.relative_to(_HERE)}")
        print(f"         Reason: {reason}")

    print("\n" + "=" * 70)
    print(f"Total : {len(files)}")
    print(f"Fixed : {len(bom_stripped)}")
    print(f"Valid : {len(valid)}")
    print(f"Invalid: {len(invalid)}")
    print("=" * 70)

    return 0 if not invalid else 1


if __name__ == "__main__":
    sys.exit(main())
