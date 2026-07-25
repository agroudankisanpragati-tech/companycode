"""
Voice Guide AI — Translation Validator.

Validates translation files for:
  * Missing keys (compared to English baseline)
  * Duplicate keys
  * Invalid JSON
  * UTF-8 encoding
  * Empty values
  * Fallback completeness

Run:
    python voice_guide_ai/validate_translations.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from config.constants import SUPPORTED_LANGUAGES
from config.paths import PATHS

ALL_MODULES = [
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
]


@dataclass
class ValidationReport:
    language: str
    module: str
    missing_keys: list[str] = field(default_factory=list)
    empty_values: list[str] = field(default_factory=list)
    duplicate_keys: list[str] = field(default_factory=list)
    json_error: str = ""
    encoding_error: str = ""

    @property
    def has_issues(self) -> bool:
        return bool(
            self.missing_keys or self.empty_values or
            self.duplicate_keys or self.json_error or self.encoding_error
        )


def load_baseline(module: str) -> dict[str, str]:
    for lang in ("en", "hi"):
        path = PATHS.translation_path(lang, module)
        if path.exists():
            try:
                raw = path.read_bytes()
                raw.decode("utf-8")
                data = json.loads(raw)
                if isinstance(data, dict):
                    return {str(k): str(v) for k, v in data.items()}
            except Exception:
                pass
    return {}


def validate_file(language: str, module: str, baseline: dict[str, str]) -> ValidationReport:
    report = ValidationReport(language=language, module=module)
    path = PATHS.translation_path(language, module)
    if not path.exists():
        return report

    try:
        raw = path.read_bytes()
        raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        report.encoding_error = str(exc)
        return report

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        report.json_error = str(exc)
        return report

    if not isinstance(data, dict):
        report.json_error = "Root element is not a JSON object"
        return report

    seen: dict[str, int] = {}
    try:
        def _detect(pairs):
            for k, _ in pairs:
                seen[k] = seen.get(k, 0) + 1
            return dict(pairs)
        json.loads(raw, object_pairs_hook=_detect)
        report.duplicate_keys = [k for k, c in seen.items() if c > 1]
    except Exception:
        pass

    if baseline:
        report.missing_keys = [k for k in baseline if k not in data]

    report.empty_values = [k for k, v in data.items() if not str(v).strip()]
    return report


def run_validation() -> int:
    total_issues = 0
    total_files = 0
    total_missing = 0

    print("=" * 70)
    print("Voice Guide AI — Translation Validation")
    print("=" * 70)

    for module in ALL_MODULES:
        baseline = load_baseline(module)
        for lang_code in SUPPORTED_LANGUAGES:
            path = PATHS.translation_path(lang_code, module)
            if not path.exists():
                total_missing += 1
                continue
            total_files += 1
            report = validate_file(lang_code, module, baseline)
            if report.has_issues:
                total_issues += 1
                print(f"\n  [ISSUES] {lang_code}/{module}.json")
                if report.json_error:
                    print(f"    JSON ERROR: {report.json_error}")
                if report.encoding_error:
                    print(f"    ENCODING ERROR: {report.encoding_error}")
                if report.duplicate_keys:
                    print(f"    DUPLICATE KEYS: {report.duplicate_keys}")
                if report.missing_keys:
                    print(f"    MISSING KEYS ({len(report.missing_keys)}): {report.missing_keys[:5]}")
                if report.empty_values:
                    print(f"    EMPTY VALUES: {report.empty_values[:5]}")

    print("\n" + "=" * 70)
    print(f"Files validated : {total_files}")
    print(f"Missing files   : {total_missing}")
    print(f"Files with issues: {total_issues}")
    print("=" * 70)
    return 0 if total_issues == 0 else 1


if __name__ == "__main__":
    sys.exit(run_validation())
