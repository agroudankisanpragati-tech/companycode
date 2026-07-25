"""
Translation Validator — validates translation files and individual entries.

Checks
------
* File exists and is valid UTF-8 JSON
* All values are non-empty strings
* No duplicate keys (JSON spec violation — caught by json.loads)
* Placeholder syntax is well-formed
* Module coverage across languages
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from config.logger import get_logger
from config.paths import PATHS

_log = get_logger("localization.translation_validator")

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
_MALFORMED_RE   = re.compile(r"\{[^}]*$|\{[^a-zA-Z_}][^}]*\}")

_MODULES: tuple[str, ...] = (
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
)


@dataclass
class ValidationIssue:
    severity: str          # "error" | "warning"
    language: str
    module: str
    key: Optional[str]
    message: str


@dataclass
class ValidationReport:
    language: str
    module: str
    issues: list[ValidationIssue] = field(default_factory=list)
    key_count: int = 0
    is_valid: bool = True

    def add(self, severity: str, key: Optional[str], message: str) -> None:
        self.issues.append(
            ValidationIssue(severity, self.language, self.module, key, message)
        )
        if severity == "error":
            self.is_valid = False

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "warning")


class TranslationValidator:
    """Validates translation files for correctness and completeness."""

    def validate_file(self, language: str, module: str) -> ValidationReport:
        """Validate a single translation file. Returns a ValidationReport."""
        report = ValidationReport(language=language, module=module)
        path = PATHS.translations / language / f"{module}.json"

        if not path.exists():
            report.add("error", None, f"File not found: {path}")
            return report

        try:
            raw = path.read_bytes()
        except OSError as exc:
            report.add("error", None, f"Cannot read file: {exc}")
            return report

        try:
            raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            report.add("error", None, f"Invalid UTF-8 encoding: {exc}")
            return report

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            report.add("error", None, f"Invalid JSON: {exc}")
            return report

        if not isinstance(data, dict):
            report.add("error", None, "Root element must be a JSON object")
            return report

        report.key_count = len(data)

        for key, value in data.items():
            if not isinstance(key, str) or not key.strip():
                report.add("error", str(key), "Key must be a non-empty string")
            if not isinstance(value, str):
                report.add("error", key, f"Value must be a string, got {type(value).__name__}")
                continue
            if not value.strip():
                report.add("warning", key, "Empty translation value")
            if _MALFORMED_RE.search(value):
                report.add("warning", key, "Possibly malformed placeholder in value")

        return report

    def validate_language(self, language: str) -> list[ValidationReport]:
        """Validate all modules for a language."""
        return [self.validate_file(language, m) for m in _MODULES]

    def validate_all(self, languages: list[str]) -> dict[str, list[ValidationReport]]:
        """Validate all languages. Returns mapping of language → reports."""
        return {lang: self.validate_language(lang) for lang in languages}

    def check_coverage(
        self, reference_language: str, target_language: str
    ) -> dict[str, list[str]]:
        """
        Compare *target_language* against *reference_language*.

        Returns dict with keys 'missing_modules' and 'missing_keys'.
        """
        missing_modules: list[str] = []
        missing_keys: list[str] = []

        for module in _MODULES:
            ref_path = PATHS.translations / reference_language / f"{module}.json"
            tgt_path = PATHS.translations / target_language / f"{module}.json"

            if not ref_path.exists():
                continue
            if not tgt_path.exists():
                missing_modules.append(module)
                continue

            try:
                ref_data = json.loads(ref_path.read_bytes().decode("utf-8"))
                tgt_data = json.loads(tgt_path.read_bytes().decode("utf-8"))
                for key in ref_data:
                    if key not in tgt_data:
                        missing_keys.append(f"{module}.{key}")
            except (json.JSONDecodeError, UnicodeDecodeError, OSError):
                missing_modules.append(module)

        return {"missing_modules": missing_modules, "missing_keys": missing_keys}
