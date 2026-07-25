"""
Voice Guide AI — Domain Constants.

All magic strings, supported language codes, required JSON schema keys,
folder names, and numeric limits live here.  Nothing is hardcoded
anywhere else in the module.
"""

from __future__ import annotations

# ── Supported Language Codes ───────────────────────────────────────────────────

SUPPORTED_LANGUAGES: dict[str, str] = {
    "hi":              "Hindi",
    "en":              "English",
    "gu":              "Gujarati",
    "pa":              "Punjabi",
    "mr":              "Marathi",
    "ta":              "Tamil",
    "te":              "Telugu",
    "kn":              "Kannada",
    "ml":              "Malayalam",
    "bn":              "Bengali",
    "ur":              "Urdu",
    "od":              "Odia",
    "as":              "Assamese",
    "rj/bagri":        "Bagri",
    "rj/marwari":      "Marwari",
    "rj/mewari":       "Mewari",
    "rj/dhundhari":    "Dhundhari",
    "rj/hadoti":       "Hadoti",
    "rj/shekhawati":   "Shekhawati",
    "rj/mewati":       "Mewati",
    "rj/wagdi":        "Wagdi",
}

DEFAULT_LANGUAGE: str = "hi"
FALLBACK_LANGUAGE: str = "en"

# ── Dialogue States ────────────────────────────────────────────────────────────

DIALOGUE_STATES: list[str] = [
    "IDLE",
    "LOADING",
    "READY",
    "PLAYING",
    "LISTENING",
    "THINKING",
    "WAITING",
    "SUCCESS",
    "WARNING",
    "ERROR",
    "OFFLINE",
    "EXIT",
    "STOPPED",
]

# ── Dialogue JSON Required Keys ────────────────────────────────────────────────

DIALOGUE_REQUIRED_KEYS: list[str] = [
    "id",
    "page",
    "dialogueType",
    "title",
    "version",
    "text",
    "voice",
    "avatar",
    "display",
    "conditions",
    "status",
]

TRANSLATION_REQUIRED_KEYS: list[str] = [
    "language",
    "page",
    "dialogues",
]

# ── Folder Names ───────────────────────────────────────────────────────────────

DIALOGUES_DIR:     str = "dialogues"
TRANSLATIONS_DIR:  str = "translations"
CONFIG_DIR:        str = "config"
AVATAR_CONFIG_DIR: str = "avatar/config"
VOICE_DIR:         str = "voice"
LOGS_DIR:          str = "logs"

# ── Dialogue Status Values ─────────────────────────────────────────────────────

STATUS_ACTIVE:   str = "active"
STATUS_INACTIVE: str = "inactive"
STATUS_DRAFT:    str = "draft"

# ── History Limits ─────────────────────────────────────────────────────────────

MAX_HISTORY_ENTRIES: int = 500
MAX_REPLAY_COUNT:    int = 10

# ── Encoding ───────────────────────────────────────────────────────────────────

DEFAULT_ENCODING: str = "utf-8"

# ── Logging ────────────────────────────────────────────────────────────────────

LOG_FILE_NAME:        str = "voice_guide_ai.log"
LOG_MAX_BYTES:        int = 10 * 1024 * 1024   # 10 MB
LOG_BACKUP_COUNT:     int = 7
LOG_DATE_FORMAT:      str = "%Y-%m-%d %H:%M:%S"
LOG_FORMAT:           str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
PERF_LOG_FILE_NAME:   str = "performance.log"

# ── Avatar / Voice Event Types ─────────────────────────────────────────────────

AVATAR_EVENT_SPEAK:   str = "speak"
AVATAR_EVENT_IDLE:    str = "idle"
AVATAR_EVENT_LISTEN:  str = "listen"
AVATAR_EVENT_THINK:   str = "think"
AVATAR_EVENT_SUCCESS: str = "success"
AVATAR_EVENT_ERROR:   str = "error"
AVATAR_EVENT_WAVE:    str = "wave"

VOICE_EVENT_PLAY:     str = "play"
VOICE_EVENT_STOP:     str = "stop"
VOICE_EVENT_PAUSE:    str = "pause"
VOICE_EVENT_RESUME:   str = "resume"

# ── Condition Operators ────────────────────────────────────────────────────────

CONDITION_OPERATORS: list[str] = ["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in"]
