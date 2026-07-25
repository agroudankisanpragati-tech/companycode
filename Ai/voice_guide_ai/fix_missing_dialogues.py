"""
Voice Guide AI — Auto-fix Missing Dialogues.

Scans all pages and creates any missing dialogue JSON files
with production-ready content. Safe to run multiple times.
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

from config.paths import PATHS

PAGES = [
    "language_popup", "home", "login", "register", "profile",
    "weather", "mandi", "marketplace", "crop_recommendation",
    "disease_detection", "government_scheme", "soil_health",
    "ai_chat", "app_settings", "common",
]

REQUIRED_TYPES = ["welcome", "help", "error", "exit", "offline", "replay"]

AVATAR_MAP = {
    "welcome": {"animation": "wave", "expression": "smile"},
    "help": {"animation": "speaking", "expression": "speaking"},
    "error": {"animation": "error", "expression": "error"},
    "exit": {"animation": "goodbye", "expression": "goodbye"},
    "offline": {"animation": "warning", "expression": "warning"},
    "replay": {"animation": "speaking", "expression": "speaking"},
    "success": {"animation": "success", "expression": "happy"},
    "processing": {"animation": "thinking", "expression": "thinking"},
    "result": {"animation": "speaking", "expression": "smile"},
    "retry": {"animation": "warning", "expression": "warning"},
}

FALLBACK_TEXT = {
    "welcome": "इस पेज पर आपका स्वागत है। मैं आपकी सहायता करूँगा।",
    "help": "मैं आपकी सहायता के लिए यहाँ हूँ।",
    "error": "क्षमा करें, कुछ समस्या हुई है। पुनः प्रयास करें।",
    "exit": "धन्यवाद। आगे बढ़ते हैं।",
    "offline": "अभी इंटरनेट उपलब्ध नहीं है। कृपया कनेक्शन जांचें।",
    "replay": "मैं फिर से समझाता हूँ।",
    "success": "आपकी प्रक्रिया सफलतापूर्वक पूरी हो गई।",
    "processing": "प्रक्रिया चल रही है। कृपया प्रतीक्षा करें।",
    "result": "परिणाम यहाँ है।",
    "retry": "पुनः प्रयास करें।",
}


def make_dialogue(page: str, dtype: str) -> dict:
    did = f"{page}_{dtype}_001"
    av = AVATAR_MAP.get(dtype, {"animation": "speaking", "expression": "neutral"})
    text = FALLBACK_TEXT.get(dtype, "कृपया प्रतीक्षा करें।")
    return {
        "id": did,
        "page": page,
        "dialogueType": dtype,
        "title": f"{page.replace('_', ' ').title()} {dtype.title()}",
        "version": "1.0.0",
        "text": text,
        "repeat": {"enabled": dtype == "welcome", "afterHours": 24},
        "voice": {
            "enabled": True,
            "provider": "offline",
            "file": f"{did}.mp3",
            "language": "hi",
            "speed": 1.0,
            "volume": 1.0,
        },
        "avatar": {"enabled": True, "animation": av["animation"], "expression": av["expression"]},
        "display": {"showSubtitle": True, "showAvatar": True},
        "conditions": {"firstVisit": dtype == "welcome", "loggedIn": False, "internetRequired": False},
        "status": "active",
    }


def run():
    created = 0
    for page in PAGES:
        page_dir = PATHS.dialogues / page
        page_dir.mkdir(parents=True, exist_ok=True)
        for dtype in REQUIRED_TYPES:
            path = PATHS.dialogue_path(page, dtype)
            if not path.exists():
                data = make_dialogue(page, dtype)
                path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                print(f"  CREATED: {page}/{dtype}.json")
                created += 1
    print(f"\nDone. Created {created} missing dialogue files.")


if __name__ == "__main__":
    run()
