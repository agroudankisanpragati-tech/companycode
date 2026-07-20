# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/startup_validator.py
# Purpose: Validates every module, model, config, and dependency at startup.
#          Generates a structured validation report. Never crashes the app —
#          marks optional modules as warnings, critical ones as errors.
# =============================================================================

from __future__ import annotations

import importlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_AI_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

# Load .env before validation
try:
    from dotenv import load_dotenv
    _env = _AI_ROOT / ".env"
    if _env.exists():
        load_dotenv(_env, override=False)
    else:
        _backend_env = _AI_ROOT.parent / "backend" / ".env"
        if _backend_env.exists():
            load_dotenv(_backend_env, override=False)
except ImportError:
    pass

from pragati_ai_controller.config import get_config


# ---------------------------------------------------------------------------
# VALIDATION RESULT
# ---------------------------------------------------------------------------

class CheckResult:
    def __init__(self, name: str, passed: bool, message: str, critical: bool = False):
        self.name     = name
        self.passed   = passed
        self.message  = message
        self.critical = critical

    def to_dict(self) -> dict[str, Any]:
        return {
            "name":     self.name,
            "passed":   self.passed,
            "message":  self.message,
            "critical": self.critical,
            "status":   "PASS" if self.passed else ("CRITICAL" if self.critical else "WARN"),
        }


# ---------------------------------------------------------------------------
# VALIDATOR
# ---------------------------------------------------------------------------

class StartupValidator:
    """Runs all startup checks and returns a structured report."""

    def __init__(self) -> None:
        self._cfg     = get_config()
        self._results: list[CheckResult] = []

    def run(self) -> dict[str, Any]:
        t0 = time.perf_counter()

        self._check_python_version()
        self._check_env_file()
        self._check_directories()
        self._check_yolo_weights()
        self._check_intent_model()
        self._check_root_agent()
        self._check_session_store()
        self._check_context_resolver()
        self._check_voice_model()
        self._check_stt_model()
        self._check_knowledge_base()
        self._check_dataset_index()
        self._check_mongodb()
        self._check_imports()
        self._check_bridge_config()

        elapsed = round((time.perf_counter() - t0) * 1000.0, 2)

        passed   = [r for r in self._results if r.passed]
        warnings = [r for r in self._results if not r.passed and not r.critical]
        errors   = [r for r in self._results if not r.passed and r.critical]

        overall = "READY" if not errors else "DEGRADED"

        report = {
            "status":        overall,
            "timestamp":     datetime.now(timezone.utc).isoformat(),
            "elapsed_ms":    elapsed,
            "total_checks":  len(self._results),
            "passed":        len(passed),
            "warnings":      len(warnings),
            "errors":        len(errors),
            "checks":        [r.to_dict() for r in self._results],
        }

        report_path = self._cfg.outputs_dir / "startup_validation.json"
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(report, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            pass

        return report

    # ------------------------------------------------------------------
    # CHECKS
    # ------------------------------------------------------------------

    def _check_python_version(self) -> None:
        major, minor = sys.version_info.major, sys.version_info.minor
        ok = (major == 3 and minor >= 10)
        self._results.append(CheckResult(
            name     = "python_version",
            passed   = ok,
            message  = f"Python {major}.{minor} — {'OK' if ok else 'requires 3.10+'}",
            critical = not ok,
        ))

    def _check_env_file(self) -> None:
        ai_env     = self._cfg.ai_root / ".env"
        backend_env = self._cfg.ai_root.parent / "backend" / ".env"
        if ai_env.exists():
            self._results.append(CheckResult("env_file", True, str(ai_env)))
        elif backend_env.exists():
            self._results.append(CheckResult("env_file", True, f"Using backend .env: {backend_env}"))
        else:
            self._results.append(CheckResult(
                "env_file", False,
                f"No .env found at {ai_env} or {backend_env} — using system env vars",
                critical=False,
            ))

    def _check_directories(self) -> None:
        cfg = self._cfg
        dirs = {
            "logs_dir":    cfg.logs_dir,
            "outputs_dir": cfg.outputs_dir,
            "memory_dir":  cfg.memory_dir,
            "configs_dir": cfg.configs_dir,
        }
        for name, path in dirs.items():
            try:
                path.mkdir(parents=True, exist_ok=True)
                self._results.append(CheckResult(name, True, str(path)))
            except Exception as exc:
                self._results.append(CheckResult(name, False, str(exc), critical=True))

    def _check_yolo_weights(self) -> None:
        weights = self._cfg.ai_root / "weights" / "checkpoints" / "best.pt"
        exists  = weights.exists() and weights.stat().st_size > 0
        self._results.append(CheckResult(
            name     = "yolo_weights",
            passed   = exists,
            message  = str(weights) if exists else f"NOT FOUND: {weights}",
            critical = False,
        ))

    def _check_intent_model(self) -> None:
        model_pkl = self._cfg.ai_root / "intent_engine" / "models" / "intent_classifier.pkl"
        vec_pkl   = self._cfg.ai_root / "intent_engine" / "models" / "tfidf_vectorizer.pkl"
        ok = model_pkl.exists() and vec_pkl.exists()
        self._results.append(CheckResult(
            name     = "intent_model",
            passed   = ok,
            message  = "intent_classifier.pkl + tfidf_vectorizer.pkl found" if ok
                       else f"Missing: {model_pkl.name} or {vec_pkl.name}",
            critical = False,
        ))

    def _check_voice_model(self) -> None:
        voices_dir = self._cfg.ai_root / "voice_models" / "voices"
        piper_exe  = self._cfg.ai_root / "voice_models" / "piper" / "piper.exe"
        onnx_files = list(voices_dir.rglob("*.onnx")) if voices_dir.exists() else []
        ok = piper_exe.exists() and len(onnx_files) > 0
        self._results.append(CheckResult(
            name     = "voice_model",
            passed   = ok,
            message  = f"piper.exe + {len(onnx_files)} voice model(s) found" if ok
                       else "piper.exe or .onnx voice model missing",
            critical = False,
        ))

    def _check_stt_model(self) -> None:
        stt_dir = self._cfg.ai_root / "speech_to_text" / "models" / "faster_whisper"
        found   = False
        if stt_dir.exists():
            try:
                found = any(stt_dir.iterdir())
            except Exception:
                found = False
        self._results.append(CheckResult(
            name     = "stt_model",
            passed   = found,
            message  = f"Faster-Whisper model found at {stt_dir}" if found
                       else f"No STT model in {stt_dir} — will auto-download on first use",
            critical = False,
        ))

    def _check_knowledge_base(self) -> None:
        kb_dir = self._cfg.ai_root / "knowledge_base"
        ok = kb_dir.exists()
        self._results.append(CheckResult(
            name     = "knowledge_base",
            passed   = ok,
            message  = f"Knowledge base directory found: {kb_dir}" if ok
                       else f"Knowledge base not found at {kb_dir}",
            critical = False,
        ))

    def _check_dataset_index(self) -> None:
        idx = self._cfg.ai_root / "outputs" / "dataset_index.json"
        ok  = idx.exists() and idx.stat().st_size > 0
        self._results.append(CheckResult(
            name     = "dataset_index",
            passed   = ok,
            message  = str(idx) if ok else f"NOT FOUND: {idx} — run dataset_indexer.py",
            critical = False,
        ))

    def _check_mongodb(self) -> None:
        try:
            import pymongo
            uri = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
            client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=3000)
            client.admin.command("ping")
            client.close()
            self._results.append(CheckResult("mongodb", True, f"Connected: {uri}"))
        except ImportError:
            self._results.append(CheckResult("mongodb", False, "pymongo not installed", critical=False))
        except Exception as exc:
            self._results.append(CheckResult("mongodb", False, f"Connection failed: {exc}", critical=False))

    def _check_imports(self) -> None:
        modules = [
            ("torch",          "torch",          False),
            ("ultralytics",    "ultralytics",    False),
            ("faster_whisper", "faster_whisper", False),
            ("sklearn",        "sklearn",        False),
            ("numpy",          "numpy",          True),
            ("cv2",            "cv2",            False),
            ("fastapi",        "fastapi",        True),
            ("uvicorn",        "uvicorn",        True),
            ("pydantic",       "pydantic",       False),
            ("pymongo",        "pymongo",        False),
        ]
        for display, mod, critical in modules:
            try:
                importlib.import_module(mod)
                self._results.append(CheckResult(f"import_{display}", True, f"{display} available"))
            except ImportError:
                self._results.append(CheckResult(
                    f"import_{display}", False,
                    f"{display} not installed — pip install {display}",
                    critical=critical,
                ))

    def _check_session_store(self) -> None:
        """Validates that SessionStore and ContextResolver load correctly."""
        try:
            from knowledge_base.session_store import get_session_store, Slot
            store = get_session_store()
            store.set("_startup_test", Slot.ACTIVE_DISEASE, "test")
            val = store.get("_startup_test", Slot.ACTIVE_DISEASE)
            store.delete("_startup_test")
            ok = val == "test"
            self._results.append(CheckResult(
                name    = "session_store",
                passed  = ok,
                message = "SessionStore read/write OK" if ok else "SessionStore test failed",
                critical= False,
            ))
        except Exception as exc:
            self._results.append(CheckResult(
                name    = "session_store",
                passed  = False,
                message = f"SessionStore failed: {exc}",
                critical= False,
            ))

    def _check_context_resolver(self) -> None:
        """Validates that ContextResolver loads and resolves correctly."""
        try:
            from knowledge_base.context_resolver import get_context_resolver
            resolver = get_context_resolver()
            req = {"text": "उसका इलाज", "language": "devanagari", "intent": "disease"}
            enriched = resolver.resolve(req, "")
            ok = isinstance(enriched, dict) and "context_resolved" in enriched
            self._results.append(CheckResult(
                name    = "context_resolver",
                passed  = ok,
                message = "ContextResolver OK" if ok else "ContextResolver test failed",
                critical= False,
            ))
        except Exception as exc:
            self._results.append(CheckResult(
                name    = "context_resolver",
                passed  = False,
                message = f"ContextResolver failed: {exc}",
                critical= False,
            ))

    def _check_root_agent(self) -> None:
        """Validates that the Root Agent loads and the Intent Engine model is functional."""
        try:
            from root_agent.root_agent import get_root_agent
            agent = get_root_agent()
            health = agent.health()
            intent_status = health.get("intent_engine", "unavailable")
            router_status = health.get("knowledge_router", "unavailable")
            ok = intent_status == "loaded"
            msg = (
                f"Root Agent ready | intent_engine={intent_status} "
                f"knowledge_router={router_status} "
                f"openai_fallback={health.get('openai_fallback', 'disabled')}"
            )
            self._results.append(CheckResult(
                name     = "root_agent",
                passed   = ok,
                message  = msg if ok else f"Root Agent degraded: intent_engine={intent_status}",
                critical = False,
            ))
        except Exception as exc:
            self._results.append(CheckResult(
                name     = "root_agent",
                passed   = False,
                message  = f"Root Agent failed to initialise: {exc}",
                critical = False,
            ))

    def _check_bridge_config(self) -> None:
        port = os.getenv("PAC_BRIDGE_PORT", "8001")
        host = os.getenv("PAC_BRIDGE_HOST", "0.0.0.0")
        self._results.append(CheckResult(
            name    = "bridge_config",
            passed  = True,
            message = f"Bridge configured on {host}:{port}",
        ))


# ---------------------------------------------------------------------------
# CONVENIENCE
# ---------------------------------------------------------------------------

def run_startup_validation() -> dict[str, Any]:
    """Run all startup checks and return the report."""
    return StartupValidator().run()


if __name__ == "__main__":
    report = run_startup_validation()
    print(json.dumps(report, indent=2, ensure_ascii=False))
