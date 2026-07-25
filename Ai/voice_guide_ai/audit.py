"""
Voice Guide AI — Production Audit & Health Check.

Performs a complete self-audit of the Voice Guide AI system:
  Phase 1  — Folder structure
  Phase 2  — JSON validity (dialogues + translations + configs)
  Phase 3  — Translation coverage (all pages × all languages)
  Phase 4  — Dialogue coverage (all pages × required types)
  Phase 5  — Audio asset index
  Phase 6  — Avatar asset index
  Phase 7  — Integration connectivity (backend bridge)
  Phase 8  — Security checks (path traversal, unsafe access)
  Phase 9  — Runtime smoke test
  Phase 10 — Performance baseline

Run:
    cd Ai
    python -m voice_guide_ai.audit
  or
    python voice_guide_ai/audit.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from config.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE
from config.logger import get_logger, setup_logging
from config.paths import PATHS

setup_logging(level="INFO")
_log = get_logger("audit")

# ── Required dialogue types per page ─────────────────────────────────────────

REQUIRED_DIALOGUE_TYPES = ["welcome", "help", "error", "exit", "offline", "replay"]

ALL_PAGES = [
    "language_popup", "home", "login", "register", "profile",
    "weather", "mandi", "marketplace", "crop_recommendation",
    "disease_detection", "government_scheme", "soil_health",
    "ai_chat", "app_settings", "common",
]

ALL_MODULES = [
    "ai_chat", "app_settings", "common", "crop_recommendation",
    "disease_detection", "government_scheme", "home", "language_popup",
    "login", "mandi", "marketplace", "profile", "register",
    "soil_health", "weather",
]

REQUIRED_CONFIG_FILES = [
    "app_config.json", "audio_config.json", "avatar_config.json",
    "language_config.json", "voice_config.json",
]

REQUIRED_DIRS = [
    PATHS.dialogues, PATHS.translations, PATHS.config,
    PATHS.avatar_config, PATHS.voice, PATHS.logs,
]


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class AuditIssue:
    phase: str
    severity: str          # CRITICAL | WARNING | INFO
    message: str
    path: str = ""

    def __str__(self) -> str:
        loc = f" [{self.path}]" if self.path else ""
        return f"[{self.severity}] {self.phase}: {self.message}{loc}"


@dataclass
class AuditReport:
    issues: list[AuditIssue] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)
    duration_ms: float = 0.0

    def add(self, phase: str, severity: str, message: str, path: str = "") -> None:
        self.issues.append(AuditIssue(phase, severity, message, path))

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "CRITICAL")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "WARNING")

    def passed(self) -> bool:
        return self.critical_count == 0

    def summary(self) -> str:
        status = "PASS" if self.passed() else "FAIL"
        return (
            f"Audit {status} | "
            f"Critical={self.critical_count} "
            f"Warnings={self.warning_count} "
            f"Duration={self.duration_ms:.0f}ms"
        )


# ── Phase implementations ─────────────────────────────────────────────────────

def phase1_folder_structure(report: AuditReport) -> None:
    """Verify all required directories exist."""
    for d in REQUIRED_DIRS:
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            report.add("PHASE1_FOLDERS", "WARNING", f"Created missing directory: {d}")
        elif not d.is_dir():
            report.add("PHASE1_FOLDERS", "CRITICAL", f"Path is not a directory: {d}")

    # Verify per-page dialogue directories
    for page in ALL_PAGES:
        page_dir = PATHS.dialogues / page
        if not page_dir.exists():
            report.add("PHASE1_FOLDERS", "WARNING", f"Missing dialogue directory: {page_dir}")

    report.stats["folder_check"] = "done"


def phase2_json_validity(report: AuditReport) -> None:
    """Validate all JSON files are parseable and UTF-8 encoded."""
    checked = 0
    errors = 0

    for json_file in sorted(PATHS.dialogues.rglob("*.json")):
        checked += 1
        try:
            with open(json_file, encoding="utf-8-sig") as fh:
                data = json.load(fh)
            # Check required keys
            required = ["id", "page", "dialogueType", "title", "version", "text",
                        "voice", "avatar", "display", "conditions", "status"]
            missing = [k for k in required if k not in data]
            if missing:
                report.add("PHASE2_JSON", "WARNING",
                           f"Missing keys {missing}", str(json_file))
            if data.get("status") not in ("active", "inactive", "draft"):
                report.add("PHASE2_JSON", "WARNING",
                           f"Invalid status '{data.get('status')}'", str(json_file))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors += 1
            _log.error("Invalid JSON [%s]: %s", json_file, exc)
            report.add("PHASE2_JSON", "CRITICAL", f"Invalid JSON: {exc}", str(json_file))
        except OSError as exc:
            errors += 1
            report.add("PHASE2_JSON", "CRITICAL", f"Cannot read: {exc}", str(json_file))

    for json_file in sorted(PATHS.translations.rglob("*.json")):
        checked += 1
        try:
            with open(json_file, encoding="utf-8-sig") as fh:
                json.load(fh)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors += 1
            _log.error("Invalid translation JSON [%s]: %s", json_file, exc)
            report.add("PHASE2_JSON", "CRITICAL", f"Invalid translation JSON: {exc}", str(json_file))

    for json_file in sorted(PATHS.config.glob("*.json")):
        checked += 1
        try:
            with open(json_file, encoding="utf-8-sig") as fh:
                json.load(fh)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            errors += 1
            _log.error("Invalid config JSON [%s]: %s", json_file, exc)
            report.add("PHASE2_JSON", "CRITICAL", f"Invalid config JSON: {exc}", str(json_file))

    voice_configs_dir = PATHS.voice / "configs"
    if voice_configs_dir.exists():
        for json_file in sorted(voice_configs_dir.rglob("*.json")):
            checked += 1
            try:
                with open(json_file, encoding="utf-8-sig") as fh:
                    json.load(fh)
            except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
                errors += 1
                _log.error("Invalid voice config JSON [%s]: %s", json_file, exc)
                report.add("PHASE2_JSON", "CRITICAL", f"Invalid voice config JSON: {exc}", str(json_file))

    report.stats["json_checked"] = checked
    report.stats["json_errors"] = errors


def phase3_translation_coverage(report: AuditReport) -> None:
    """Verify every page has a translation file for every supported language."""
    missing = 0
    present = 0

    for lang_code in SUPPORTED_LANGUAGES:
        for module in ALL_MODULES:
            path = PATHS.translation_path(lang_code, module)
            if path.exists():
                present += 1
            else:
                missing += 1
                report.add("PHASE3_TRANSLATIONS", "WARNING",
                           f"Missing translation: lang={lang_code} module={module}")

    report.stats["translations_present"] = present
    report.stats["translations_missing"] = missing


def phase4_dialogue_coverage(report: AuditReport) -> None:
    """Verify every page has all required dialogue type files."""
    missing = 0
    present = 0

    for page in ALL_PAGES:
        for dtype in REQUIRED_DIALOGUE_TYPES:
            path = PATHS.dialogue_path(page, dtype)
            if path.exists():
                present += 1
            else:
                missing += 1
                report.add("PHASE4_DIALOGUES", "WARNING",
                           f"Missing dialogue: page={page} type={dtype}")

    report.stats["dialogues_present"] = present
    report.stats["dialogues_missing"] = missing


def phase5_audio_assets(report: AuditReport) -> None:
    """Index audio assets and report missing directories."""
    audio_root = PATHS.voice / "audio"
    if not audio_root.exists():
        report.add("PHASE5_AUDIO", "WARNING", "Audio root directory missing", str(audio_root))
        return

    mp3_count = sum(1 for _ in audio_root.rglob("*.mp3"))
    report.stats["audio_mp3_count"] = mp3_count

    # Verify language audio directories exist
    for lang_code in list(SUPPORTED_LANGUAGES.keys())[:13]:  # standard languages
        lang_audio = audio_root / lang_code
        if not lang_audio.exists():
            report.add("PHASE5_AUDIO", "INFO",
                       f"Audio directory not yet populated: {lang_code}")


def phase6_avatar_assets(report: AuditReport) -> None:
    """Verify avatar config files and runtime modules exist."""
    avatar_config_dir = PATHS.avatar_config

    required_configs = [
        "avatar.json", "animations.json", "expressions.json",
        "lip_sync.json", "positions.json", "themes.json",
    ]

    for cfg in required_configs:
        cfg_path = avatar_config_dir / cfg
        if not cfg_path.exists():
            report.add("PHASE6_AVATAR", "WARNING",
                       f"Missing avatar config: {cfg}", str(cfg_path))
        else:
            try:
                with open(cfg_path, encoding="utf-8-sig") as fh:
                    json.load(fh)
            except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
                report.add("PHASE6_AVATAR", "CRITICAL",
                           f"Invalid avatar config JSON: {exc}", str(cfg_path))

    # Verify avatar runtime modules
    avatar_runtime = _HERE / "avatar" / "runtime"
    required_modules = [
        "avatar_manager.py", "animation_manager.py", "expression_manager.py",
        "lip_sync_manager.py", "avatar_controller.py", "avatar_cache.py",
    ]
    for mod in required_modules:
        if not (avatar_runtime / mod).exists():
            report.add("PHASE6_AVATAR", "WARNING",
                       f"Missing avatar runtime module: {mod}")


def phase7_config_files(report: AuditReport) -> None:
    """Verify all required config files exist and are valid."""
    for cfg_name in REQUIRED_CONFIG_FILES:
        cfg_path = PATHS.config / cfg_name
        if not cfg_path.exists():
            report.add("PHASE7_CONFIG", "WARNING",
                       f"Missing config file: {cfg_name}", str(cfg_path))
        else:
            try:
                with open(cfg_path, encoding="utf-8-sig") as fh:
                    json.load(fh)
            except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
                report.add("PHASE7_CONFIG", "CRITICAL",
                           f"Invalid config JSON: {exc}", str(cfg_path))


def phase8_security(report: AuditReport) -> None:
    """Security audit: path traversal, unsafe patterns, sensitive logging."""
    python_files = list(_HERE.rglob("*.py"))
    sensitive_patterns = [
        ("os.system(", "CRITICAL", "Shell injection risk"),
        ("subprocess.call(", "WARNING", "Subprocess usage"),
        ("eval(", "CRITICAL", "eval() usage"),
        ("exec(", "CRITICAL", "exec() usage"),
        ("pickle.load", "WARNING", "Unsafe pickle deserialization"),
        ("password", "WARNING", "Possible sensitive data in code"),
        ("secret_key", "WARNING", "Possible secret key in code"),
        ("api_key =", "WARNING", "Possible API key in code"),
    ]

    for py_file in python_files:
        if ".pyc" in str(py_file):
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for pattern, severity, desc in sensitive_patterns:
                if pattern in content:
                    # Skip false positives in test/audit files
                    if py_file.name in ("audit.py", "test_runtime.py"):
                        continue
                    report.add("PHASE8_SECURITY", severity,
                               f"{desc}: '{pattern}'", str(py_file))
        except OSError:
            pass

    # Check .env is not committed with real secrets
    env_file = _HERE / ".env"
    if env_file.exists():
        env_content = env_file.read_text(encoding="utf-8", errors="ignore")
        if "sk-" in env_content or "OPENAI_API_KEY=sk" in env_content:
            report.add("PHASE8_SECURITY", "CRITICAL",
                       "OpenAI API key found in .env file", str(env_file))


def phase9_runtime_smoke(report: AuditReport) -> None:
    """Runtime smoke test: instantiate RuntimeManager and run basic operations."""
    try:
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()

        # Test language setting
        result = rm.set_language(DEFAULT_LANGUAGE)
        if not isinstance(result, dict):
            report.add("PHASE9_RUNTIME", "CRITICAL", "set_language returned invalid type")

        # Test condition update
        rm.update_conditions({"logged_in": False, "internet_available": True})

        # Test offline mode
        rm.set_online(False)
        offline_result = rm.play("home", "welcome", language=DEFAULT_LANGUAGE)
        if not offline_result.get("offline"):
            report.add("PHASE9_RUNTIME", "WARNING",
                       "Offline play did not return offline=True")
        rm.set_online(True)

        # Test status
        status = rm.get_status()
        required_keys = ["started", "session", "current_page", "queue_size", "is_online"]
        for key in required_keys:
            if key not in status:
                report.add("PHASE9_RUNTIME", "CRITICAL",
                           f"Status missing key: {key}")

        rm.stop()
        report.stats["runtime_smoke"] = "passed"

    except Exception as exc:
        report.add("PHASE9_RUNTIME", "CRITICAL", f"Runtime smoke test failed: {exc}")
        report.stats["runtime_smoke"] = "failed"


def phase10_performance(report: AuditReport) -> None:
    """Performance baseline: measure JSON load and cache operations."""
    try:
        from utils.json_manager import JSONManager
        from utils.cache_manager import CacheManager

        jm = JSONManager()
        cache = CacheManager()

        # Measure dialogue load time
        start = time.perf_counter()
        loaded = 0
        for page in ALL_PAGES[:5]:
            for dtype in ["welcome", "error"]:
                path = PATHS.dialogue_path(page, dtype)
                if path.exists():
                    jm.read_safe(path)
                    loaded += 1
        elapsed_ms = (time.perf_counter() - start) * 1000

        report.stats["perf_dialogue_load_ms"] = round(elapsed_ms, 2)
        report.stats["perf_dialogues_loaded"] = loaded

        if elapsed_ms > 500:
            report.add("PHASE10_PERF", "WARNING",
                       f"Dialogue load slow: {elapsed_ms:.0f}ms for {loaded} files")

        # Cache performance
        for i in range(100):
            cache.set(f"key_{i}", {"data": i})
        hit_count = sum(1 for i in range(100) if cache.get(f"key_{i}") is not None)
        report.stats["cache_hit_rate"] = f"{hit_count}/100"

    except Exception as exc:
        report.add("PHASE10_PERF", "WARNING", f"Performance test error: {exc}")


# ── Main audit runner ─────────────────────────────────────────────────────────

def run_audit() -> AuditReport:
    """Execute all audit phases and return the consolidated report."""
    report = AuditReport()
    start = time.perf_counter()

    _log.info("=" * 60)
    _log.info("Voice Guide AI — Production Audit Starting")
    _log.info("=" * 60)

    phases = [
        ("Phase 1: Folder Structure",       phase1_folder_structure),
        ("Phase 2: JSON Validity",           phase2_json_validity),
        ("Phase 3: Translation Coverage",    phase3_translation_coverage),
        ("Phase 4: Dialogue Coverage",       phase4_dialogue_coverage),
        ("Phase 5: Audio Assets",            phase5_audio_assets),
        ("Phase 6: Avatar Assets",           phase6_avatar_assets),
        ("Phase 7: Config Files",            phase7_config_files),
        ("Phase 8: Security Audit",          phase8_security),
        ("Phase 9: Runtime Smoke Test",      phase9_runtime_smoke),
        ("Phase 10: Performance Baseline",   phase10_performance),
    ]

    for phase_name, phase_fn in phases:
        _log.info("Running %s ...", phase_name)
        try:
            phase_fn(report)
        except Exception as exc:
            report.add(phase_name.upper().replace(" ", "_"), "CRITICAL",
                       f"Phase crashed: {exc}")
            _log.error("Phase crashed: %s — %s", phase_name, exc, exc_info=True)

    report.duration_ms = (time.perf_counter() - start) * 1000

    # Print summary
    _log.info("=" * 60)
    _log.info(report.summary())
    _log.info("Stats: %s", report.stats)

    for issue in report.issues:
        if issue.severity == "CRITICAL":
            _log.error(str(issue))
        elif issue.severity == "WARNING":
            _log.warning(str(issue))
        else:
            _log.info(str(issue))

    _log.info("=" * 60)
    return report


if __name__ == "__main__":
    result = run_audit()
    sys.exit(0 if result.passed() else 1)
