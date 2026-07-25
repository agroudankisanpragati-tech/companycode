"""
Voice Guide AI — Production Startup Validator.

Runs at application startup to verify all critical components are
present and functional. Exits with code 1 if any CRITICAL check fails.
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

from bootstrap import install_voice_guide_imports

install_voice_guide_imports()

from config.constants import SUPPORTED_LANGUAGES
from config.paths import PATHS

REQUIRED_PAGES = [
    "language_popup", "home", "login", "register", "profile",
    "weather", "mandi", "marketplace", "crop_recommendation",
    "disease_detection", "government_scheme", "soil_health",
    "ai_chat", "app_settings", "common",
]

REQUIRED_DIALOGUE_TYPES = ["welcome", "help", "error", "exit", "offline", "replay"]

REQUIRED_CONFIG_FILES = [
    "app_config.json", "audio_config.json", "avatar_config.json",
    "language_config.json", "voice_config.json", "trigger_config.json",
    "offline_config.json", "provider_config.json",
]

REQUIRED_AVATAR_CONFIGS = [
    "avatar.json", "animations.json", "expressions.json",
    "lip_sync.json", "positions.json", "themes.json",
]

CRITICAL_LANGUAGES = ["hi", "en", "gu", "pa"]


def validate() -> dict:
    issues = []
    warnings = []

    # 1. Required directories
    for d in [PATHS.dialogues, PATHS.translations, PATHS.config,
              PATHS.avatar_config, PATHS.voice, PATHS.logs]:
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            warnings.append(f"Created missing dir: {d}")

    # 2. Config files
    for cfg in REQUIRED_CONFIG_FILES:
        p = PATHS.config / cfg
        if not p.exists():
            issues.append(f"CRITICAL: Missing config: {cfg}")
        else:
            try:
                with open(p, encoding="utf-8-sig") as fh:
                    json.load(fh)
            except Exception as e:
                issues.append(f"CRITICAL: Invalid config JSON {cfg}: {e}")

    # 3. Avatar configs
    for cfg in REQUIRED_AVATAR_CONFIGS:
        p = PATHS.avatar_config / cfg
        if not p.exists():
            warnings.append(f"Missing avatar config: {cfg}")

    # 4. Dialogue coverage
    for page in REQUIRED_PAGES:
        for dtype in REQUIRED_DIALOGUE_TYPES:
            p = PATHS.dialogue_path(page, dtype)
            if not p.exists():
                warnings.append(f"Missing dialogue: {page}/{dtype}")

    # 5. Critical language translations
    modules = [
        "home", "login", "register", "profile", "weather", "mandi",
        "marketplace", "crop_recommendation", "disease_detection",
        "government_scheme", "soil_health", "ai_chat", "app_settings",
        "common", "language_popup",
    ]
    for lang in CRITICAL_LANGUAGES:
        for mod in modules:
            p = PATHS.translation_path(lang, mod)
            if not p.exists():
                issues.append(f"CRITICAL: Missing translation: {lang}/{mod}")
            else:
                try:
                    with open(p, encoding="utf-8-sig") as fh:
                        json.load(fh)
                except Exception as e:
                    issues.append(f"CRITICAL: Invalid translation {lang}/{mod}: {e}")

    # 6. Runtime smoke test
    try:
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()
        status = rm.get_status()
        assert "started" in status
        rm.stop()
    except Exception as e:
        issues.append(f"CRITICAL: Runtime smoke test failed: {e}")

    passed = not any(i.startswith("CRITICAL") for i in issues)
    return {
        "passed": passed,
        "critical_count": sum(1 for i in issues if i.startswith("CRITICAL")),
        "warning_count": len(warnings),
        "issues": issues,
        "warnings": warnings,
    }


if __name__ == "__main__":
    result = validate()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if result["passed"] else 1)
