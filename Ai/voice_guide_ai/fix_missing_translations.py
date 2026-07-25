"""
Voice Guide AI — Auto-fix Missing Translations.

Scans all language/module combinations and creates missing translation
files using Hindi as the base fallback. Safe to run multiple times.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from config.constants import SUPPORTED_LANGUAGES
from config.paths import PATHS

MODULES = [
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
]


def load_baseline(module: str) -> dict:
    for lang in ("hi", "en"):
        p = PATHS.translation_path(lang, module)
        if p.exists():
            try:
                return json.loads(p.read_bytes().decode("utf-8"))
            except Exception:
                pass
    return {}


def run():
    created = 0
    for lang_code in SUPPORTED_LANGUAGES:
        for module in MODULES:
            path = PATHS.translation_path(lang_code, module)
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                baseline = load_baseline(module)
                if baseline:
                    path.write_text(
                        json.dumps(baseline, indent=4, ensure_ascii=False),
                        encoding="utf-8",
                    )
                    print(f"  CREATED (from baseline): {lang_code}/{module}.json")
                else:
                    path.write_text("{}\n", encoding="utf-8")
                    print(f"  CREATED (empty): {lang_code}/{module}.json")
                created += 1
    print(f"\nDone. Created {created} missing translation files.")


if __name__ == "__main__":
    run()
