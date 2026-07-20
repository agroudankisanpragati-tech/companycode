# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/diagnostics.py
# Purpose: Full system diagnostics, integration report, performance report,
#          and deployment readiness report. Run standalone or import.
# Run: python -m pragati_ai_controller.diagnostics
# =============================================================================

from __future__ import annotations

import json
import os
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_AI_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

# Load .env before any diagnostics
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

from pragati_ai_controller.config import CONTROLLER_VERSION, get_config
from pragati_ai_controller.startup_validator import run_startup_validation


# ---------------------------------------------------------------------------
# SYSTEM INFO
# ---------------------------------------------------------------------------

def _system_info() -> dict[str, Any]:
    info: dict[str, Any] = {
        "os":           platform.system(),
        "os_version":   platform.version()[:60],
        "python":       platform.python_version(),
        "cpu_count":    os.cpu_count() or 1,
        "architecture": platform.machine(),
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        info["ram_total_gb"]     = round(vm.total / (1024 ** 3), 2)
        info["ram_available_gb"] = round(vm.available / (1024 ** 3), 2)
        info["cpu_percent"]      = psutil.cpu_percent(interval=0.5)
    except ImportError:
        pass
    try:
        import torch
        info["torch_version"] = torch.__version__
        info["cuda_available"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            info["gpu_name"]    = torch.cuda.get_device_name(0)
            info["gpu_vram_gb"] = round(
                torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2
            )
    except ImportError:
        info["torch_version"]  = "not installed"
        info["cuda_available"] = False
    return info


# ---------------------------------------------------------------------------
# ASSET INVENTORY
# ---------------------------------------------------------------------------

def _asset_inventory(cfg) -> dict[str, Any]:
    ai_root = cfg.ai_root

    def _check(path: Path) -> dict[str, Any]:
        exists  = path.exists()
        size_kb = round(path.stat().st_size / 1024, 1) if exists and path.is_file() else None
        return {"path": str(path), "exists": exists, "size_kb": size_kb}

    voices_dir = ai_root / "voice_models" / "voices"
    onnx_files = list(voices_dir.rglob("*.onnx")) if voices_dir.exists() else []

    stt_dir    = ai_root / "speech_to_text" / "models" / "faster_whisper"
    stt_models: list[str] = []
    if stt_dir.exists():
        try:
            stt_models = [d.name for d in stt_dir.iterdir() if d.is_dir()]
        except Exception:
            pass

    return {
        "yolo_weights":     _check(ai_root / "weights" / "checkpoints" / "best.pt"),
        "intent_model":     _check(ai_root / "intent_engine" / "models" / "intent_classifier.pkl"),
        "tfidf_vectorizer": _check(ai_root / "intent_engine" / "models" / "tfidf_vectorizer.pkl"),
        "label_encoder":    _check(ai_root / "intent_engine" / "models" / "label_encoder.pkl"),
        "dataset_index":    _check(ai_root / "outputs" / "dataset_index.json"),
        "piper_exe":        _check(ai_root / "voice_models" / "piper" / "piper.exe"),
        "voice_models":     {"count": len(onnx_files), "files": [str(f) for f in onnx_files]},
        "stt_models":       {"count": len(stt_models), "models": stt_models},
    }


# ---------------------------------------------------------------------------
# MODULE STATUS
# ---------------------------------------------------------------------------

def _module_status() -> dict[str, Any]:
    try:
        from pragati_ai_controller.ai_manager import get_ai_manager
        return get_ai_manager().get_status()
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# PERFORMANCE BENCHMARK
# ---------------------------------------------------------------------------

def _performance_benchmark() -> dict[str, Any]:
    results: dict[str, Any] = {}

    try:
        from pragati_ai_controller.pipeline import get_text_pipeline
        pipeline = get_text_pipeline()
        times = []
        for _ in range(3):
            t0 = time.perf_counter()
            pipeline.run("crop disease treatment", session_id="diag_bench", farmer_id="")
            times.append(round((time.perf_counter() - t0) * 1000.0, 2))
        results["text_pipeline_ms"] = {
            "runs":   times,
            "avg_ms": round(sum(times) / len(times), 2),
            "min_ms": min(times),
            "max_ms": max(times),
        }
    except Exception as exc:
        results["text_pipeline_ms"] = {"error": str(exc)}

    try:
        from pragati_ai_controller.ai_manager import get_ai_manager
        am    = get_ai_manager()
        times = []
        for _ in range(3):
            t0 = time.perf_counter()
            am.predict_intent("मेरी फसल में बीमारी है")
            times.append(round((time.perf_counter() - t0) * 1000.0, 2))
        results["intent_engine_ms"] = {
            "runs":   times,
            "avg_ms": round(sum(times) / len(times), 2),
        }
    except Exception as exc:
        results["intent_engine_ms"] = {"error": str(exc)}

    return results


# ---------------------------------------------------------------------------
# MONGODB DIAGNOSTICS
# ---------------------------------------------------------------------------

def _mongodb_diagnostics() -> dict[str, Any]:
    try:
        import pymongo
        uri        = os.getenv("MONGO_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
        db_name    = os.getenv("MONGO_DB_NAME", "kisan-pragati")
        collection = os.getenv("MONGO_COLLECTION", "diseaseknowledgebases")
        client     = pymongo.MongoClient(uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        count = client[db_name][collection].count_documents({})
        client.close()
        return {
            "status":         "connected",
            "uri":            uri,
            "db":             db_name,
            "collection":     collection,
            "document_count": count,
        }
    except ImportError:
        return {"status": "pymongo_not_installed"}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# DEPLOYMENT READINESS
# ---------------------------------------------------------------------------

def _deployment_readiness(validation: dict, assets: dict, modules: dict) -> dict[str, Any]:
    critical_checks = [c for c in validation.get("checks", []) if c.get("critical") and not c.get("passed")]
    warnings        = [c for c in validation.get("checks", []) if not c.get("critical") and not c.get("passed")]

    yolo_ready   = assets.get("yolo_weights",  {}).get("exists", False)
    intent_ready = assets.get("intent_model",  {}).get("exists", False)
    voice_ready  = assets.get("voice_models",  {}).get("count", 0) > 0
    stt_ready    = assets.get("stt_models",    {}).get("count", 0) > 0

    core_ready = yolo_ready and intent_ready
    full_ready = core_ready and voice_ready and stt_ready

    return {
        "overall":         "PRODUCTION_READY" if full_ready else ("CORE_READY" if core_ready else "NOT_READY"),
        "core_pipeline":   core_ready,
        "voice_pipeline":  voice_ready and stt_ready,
        "image_pipeline":  yolo_ready,
        "critical_issues": len(critical_checks),
        "warnings":        len(warnings),
        "checklist": {
            "yolo_weights":  yolo_ready,
            "intent_model":  intent_ready,
            "voice_model":   voice_ready,
            "stt_model":     stt_ready,
            "dataset_index": assets.get("dataset_index", {}).get("exists", False),
        },
        "recommendations": _get_recommendations(yolo_ready, intent_ready, voice_ready, stt_ready),
    }


def _get_recommendations(yolo: bool, intent: bool, voice: bool, stt: bool) -> list[str]:
    recs = []
    if not yolo:
        recs.append("Train YOLO model: python train.py — weights/checkpoints/best.pt missing")
    if not intent:
        recs.append("Train Intent Engine: python -m intent_engine.trainer — models missing")
    if not voice:
        recs.append("Download Piper voice model to voice_models/voices/hindi/")
    if not stt:
        recs.append("Faster-Whisper will auto-download on first STT request")
    if not recs:
        recs.append("All systems operational — ready for production deployment")
    return recs


# ---------------------------------------------------------------------------
# FULL DIAGNOSTICS REPORT
# ---------------------------------------------------------------------------

def run_diagnostics() -> dict[str, Any]:
    """Run full system diagnostics and return structured report."""
    cfg = get_config()
    t0  = time.perf_counter()

    validation = run_startup_validation()
    system     = _system_info()
    assets     = _asset_inventory(cfg)
    modules    = _module_status()
    mongodb    = _mongodb_diagnostics()
    perf       = _performance_benchmark()
    readiness  = _deployment_readiness(validation, assets, modules)

    elapsed = round((time.perf_counter() - t0) * 1000.0, 2)

    report = {
        "report_type":      "pragati_ai_diagnostics",
        "version":          CONTROLLER_VERSION,
        "timestamp":        datetime.now(timezone.utc).isoformat(),
        "elapsed_ms":       elapsed,
        "system":           system,
        "assets":           assets,
        "modules":          modules,
        "mongodb":          mongodb,
        "performance":      perf,
        "validation":       validation,
        "deployment":       readiness,
    }

    report_path = cfg.outputs_dir / "diagnostics_report.json"
    try:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
    except Exception:
        pass

    return report


# ---------------------------------------------------------------------------
# INTEGRATION REPORT
# ---------------------------------------------------------------------------

def run_integration_report() -> dict[str, Any]:
    """Generate integration report showing pipeline connectivity."""
    cfg = get_config()

    pipelines: dict[str, Any] = {}

    # Text pipeline
    try:
        from pragati_ai_controller.pipeline import get_text_pipeline
        t0 = time.perf_counter()
        rr, lang, metrics, err = get_text_pipeline().run(
            text="crop disease", session_id="integ_report", farmer_id=""
        )
        pipelines["text"] = {
            "status":   "ok" if not err else "error",
            "error":    err,
            "intent":   rr.get("intent", ""),
            "language": lang,
            "total_ms": metrics.get("total_ms", 0.0),
        }
    except Exception as exc:
        pipelines["text"] = {"status": "error", "error": str(exc)}

    # Voice pipeline (module availability check only)
    try:
        from pragati_ai_controller.ai_manager import get_ai_manager
        am = get_ai_manager()
        pipelines["voice"] = {
            "stt_available":    am.is_stt_available(),
            "tts_available":    am.is_tts_available(),
            "intent_available": am.is_intent_available(),
            "router_available": am.is_router_available(),
        }
    except Exception as exc:
        pipelines["voice"] = {"status": "error", "error": str(exc)}

    # Image pipeline (service availability check)
    try:
        from inference_service import InferenceService
        svc = InferenceService()
        h   = svc.health_check()
        pipelines["image"] = {
            "inference_service": "ok",
            "weights_exists":    h.get("weights_exists", False),
            "device":            h.get("device", ""),
        }
    except Exception as exc:
        pipelines["image"] = {"inference_service": "unavailable", "error": str(exc)}

    # Knowledge Base
    try:
        from knowledge_service import KnowledgeService
        ks = KnowledgeService()
        kh = ks.health_check()
        pipelines["knowledge_base"] = {
            "status":     kh.get("status", "unknown"),
            "db":         kh.get("db", ""),
            "collection": kh.get("collection", ""),
        }
    except Exception as exc:
        pipelines["knowledge_base"] = {"status": "error", "error": str(exc)}

    report = {
        "report_type": "integration_report",
        "version":     CONTROLLER_VERSION,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "pipelines":   pipelines,
    }

    report_path = cfg.outputs_dir / "integration_report.json"
    try:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
    except Exception:
        pass

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("  Pragati AI — Full System Diagnostics")
    print("=" * 65)

    report = run_diagnostics()

    dep = report["deployment"]
    print(f"\n  Overall Status  : {dep['overall']}")
    print(f"  Core Pipeline   : {'✓' if dep['core_pipeline'] else '✗'}")
    print(f"  Voice Pipeline  : {'✓' if dep['voice_pipeline'] else '✗'}")
    print(f"  Image Pipeline  : {'✓' if dep['image_pipeline'] else '✗'}")
    print(f"  Critical Issues : {dep['critical_issues']}")
    print(f"  Warnings        : {dep['warnings']}")

    print(f"\n  Checklist:")
    for k, v in dep["checklist"].items():
        print(f"    {'✓' if v else '✗'}  {k}")

    print(f"\n  Recommendations:")
    for r in dep["recommendations"]:
        print(f"    → {r}")

    print(f"\n  MongoDB         : {report['mongodb']['status']}")
    print(f"  Elapsed         : {report['elapsed_ms']} ms")

    cfg = get_config()
    print(f"\n  Full report     : {cfg.outputs_dir / 'diagnostics_report.json'}")
    print("=" * 65 + "\n")

    integ = run_integration_report()
    print("  Integration Report:")
    for pipeline, status in integ["pipelines"].items():
        print(f"    {pipeline:<16}: {status}")
    print(f"\n  Integration report: {cfg.outputs_dir / 'integration_report.json'}")
    print("=" * 65 + "\n")
