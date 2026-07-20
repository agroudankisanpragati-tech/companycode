# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/fastapi_bridge.py
# Purpose: Production FastAPI HTTP bridge exposing PragatiAIController to the
#          Node.js backend. Handles text / voice / image pipelines with:
#            - Startup validation of every AI module
#            - Response caching (LRU) for identical text queries
#            - Async file I/O for uploads
#            - Structured JSON performance logs
#            - Pipeline diagnostics endpoint
#            - Graceful degradation when modules are unavailable
#            - Duplicate-request prevention via in-flight tracking
#
# Start: python -m pragati_ai_controller.fastapi_bridge
#   or:  uvicorn pragati_ai_controller.fastapi_bridge:app --host 0.0.0.0 --port 8001
# =============================================================================

from __future__ import annotations

import asyncio
import functools
import hashlib
import json
import logging
import os
import shutil
import sys
import tempfile
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# PATH BOOTSTRAP
# ---------------------------------------------------------------------------

_BRIDGE_DIR = Path(__file__).resolve().parent   # pragati_ai_controller/
_AI_ROOT    = _BRIDGE_DIR.parent                # Ai/

for _p in (str(_AI_ROOT), str(_BRIDGE_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# IMPORTS (after path bootstrap)
# ---------------------------------------------------------------------------

from pragati_ai_controller.config import get_config, PragatiAIConfig
from pragati_ai_controller.controller import get_controller, PragatiAIController
from pragati_ai_controller.startup_validator import run_startup_validation

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_bridge_logger(cfg: PragatiAIConfig) -> logging.Logger:
    logger = logging.getLogger("akp.bridge")
    if logger.handlers:
        return logger
    level = getattr(logging, os.getenv("PAC_LOG_LEVEL", cfg.log_level).upper(), logging.INFO)
    logger.setLevel(level)
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)
    log_path = cfg.logs_dir / "bridge.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(
        filename=log_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


_cfg = get_config()
_log = _build_bridge_logger(_cfg)

# ---------------------------------------------------------------------------
# LRU RESPONSE CACHE
# ---------------------------------------------------------------------------

class _LRUCache:
    """Thread-safe LRU cache for text pipeline responses."""

    def __init__(self, maxsize: int = 256, ttl_seconds: float = 300.0) -> None:
        self._cache:   OrderedDict[str, tuple[dict, float]] = OrderedDict()
        self._maxsize  = maxsize
        self._ttl      = ttl_seconds
        self._lock     = threading.Lock()
        self._hits     = 0
        self._misses   = 0

    def _key(self, text: str, language: str) -> str:
        raw = f"{text.strip().lower()}|{language}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def get(self, text: str, language: str) -> Optional[dict]:
        key = self._key(text, language)
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            value, ts = self._cache[key]
            if time.monotonic() - ts > self._ttl:
                del self._cache[key]
                self._misses += 1
                return None
            self._cache.move_to_end(key)
            self._hits += 1
            return dict(value)

    def set(self, text: str, language: str, value: dict) -> None:
        key = self._key(text, language)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = (value, time.monotonic())
            if len(self._cache) > self._maxsize:
                self._cache.popitem(last=False)

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            return {
                "size":      len(self._cache),
                "maxsize":   self._maxsize,
                "hits":      self._hits,
                "misses":    self._misses,
                "hit_rate":  round(self._hits / total, 4) if total else 0.0,
                "ttl_s":     self._ttl,
            }

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0


_text_cache = _LRUCache(
    maxsize=int(os.getenv("PAC_CACHE_SIZE", "256")),
    ttl_seconds=float(os.getenv("PAC_CACHE_TTL_S", "300")),
)

# ---------------------------------------------------------------------------
# IN-FLIGHT DEDUPLICATION
# ---------------------------------------------------------------------------

class _InFlightTracker:
    """Prevents duplicate concurrent processing of identical requests."""

    def __init__(self) -> None:
        self._inflight: dict[str, asyncio.Event] = {}
        self._results:  dict[str, dict]          = {}
        self._lock = asyncio.Lock()

    async def acquire(self, key: str) -> Optional[dict]:
        """Returns cached result if already in-flight, else marks as in-flight."""
        async with self._lock:
            if key in self._inflight:
                event = self._inflight[key]
            else:
                self._inflight[key] = asyncio.Event()
                return None
        await event.wait()
        return self._results.get(key)

    async def release(self, key: str, result: dict) -> None:
        async with self._lock:
            self._results[key] = result
            event = self._inflight.pop(key, None)
        if event:
            event.set()
        # Clean up result after a short delay
        await asyncio.sleep(2)
        self._results.pop(key, None)


_inflight = _InFlightTracker()

# ---------------------------------------------------------------------------
# PERFORMANCE METRICS
# ---------------------------------------------------------------------------

class _PipelineMetrics:
    """Accumulates per-pipeline performance statistics."""

    def __init__(self) -> None:
        self._lock  = threading.Lock()
        self._data: dict[str, dict] = {
            "text":  {"count": 0, "errors": 0, "total_ms": 0.0, "min_ms": float("inf"), "max_ms": 0.0},
            "voice": {"count": 0, "errors": 0, "total_ms": 0.0, "min_ms": float("inf"), "max_ms": 0.0},
            "image": {"count": 0, "errors": 0, "total_ms": 0.0, "min_ms": float("inf"), "max_ms": 0.0},
        }

    def record(self, pipeline: str, elapsed_ms: float, error: bool = False) -> None:
        with self._lock:
            d = self._data.setdefault(pipeline, {
                "count": 0, "errors": 0, "total_ms": 0.0,
                "min_ms": float("inf"), "max_ms": 0.0,
            })
            d["count"]    += 1
            d["total_ms"] += elapsed_ms
            d["min_ms"]    = min(d["min_ms"], elapsed_ms)
            d["max_ms"]    = max(d["max_ms"], elapsed_ms)
            if error:
                d["errors"] += 1

    def snapshot(self) -> dict:
        with self._lock:
            out = {}
            for pipeline, d in self._data.items():
                count = d["count"]
                out[pipeline] = {
                    "count":    count,
                    "errors":   d["errors"],
                    "avg_ms":   round(d["total_ms"] / count, 2) if count else 0.0,
                    "min_ms":   round(d["min_ms"], 2) if count else 0.0,
                    "max_ms":   round(d["max_ms"], 2),
                    "total_ms": round(d["total_ms"], 2),
                }
            return out


_metrics = _PipelineMetrics()

# ---------------------------------------------------------------------------
# GLOBAL STATE
# ---------------------------------------------------------------------------

_controller:      Optional[PragatiAIController] = None
_startup_report:  dict[str, Any]                = {}
_startup_time:    float                         = time.monotonic()

# ---------------------------------------------------------------------------
# LIFESPAN
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _controller, _startup_report

    _log.info("=" * 60)
    _log.info("  Pragati AI Bridge — Starting Up")
    _log.info("=" * 60)

    # ── AUTO-REBUILD: ensure model is current before anything else ──
    loop = asyncio.get_running_loop()
    try:
        _log.info("AUTO-REBUILD | Checking dataset fingerprint at startup ...")
        from intent_engine.auto_rebuild import ensure_model_is_current, start_background_watcher
        rebuild_ok = await loop.run_in_executor(None, ensure_model_is_current)
        if rebuild_ok:
            _log.info("AUTO-REBUILD | Model is current — proceeding")
        else:
            _log.error("AUTO-REBUILD | Rebuild failed — server will use existing model if available")
        # Start background watcher: re-checks every 60 seconds
        start_background_watcher(interval_seconds=60)
    except Exception as _rb_exc:
        _log.error("AUTO-REBUILD | Startup check failed: %s", _rb_exc)

    # Run startup validation in thread pool (blocking I/O)
    try:
        _startup_report = await loop.run_in_executor(None, run_startup_validation)
        _log.info(
            "Startup validation: status=%s passed=%d warnings=%d errors=%d elapsed=%.0fms",
            _startup_report.get("status"),
            _startup_report.get("passed", 0),
            _startup_report.get("warnings", 0),
            _startup_report.get("errors", 0),
            _startup_report.get("elapsed_ms", 0),
        )
        for check in _startup_report.get("checks", []):
            level = "info" if check["passed"] else ("warning" if not check["critical"] else "error")
            getattr(_log, level)(
                "  [%s] %s — %s",
                check["status"], check["name"], check["message"],
            )
    except Exception as exc:
        _log.error("Startup validation failed: %s", exc)
        _startup_report = {"status": "FAILED", "error": str(exc), "checks": []}

    # Initialise controller
    try:
        _controller = await asyncio.get_running_loop().run_in_executor(None, get_controller)
        _log.info("PragatiAIController initialised successfully")
    except Exception as exc:
        _log.critical("Controller init failed: %s", exc, exc_info=True)

    _log.info("Pragati AI Bridge ready on port %s", os.getenv("PAC_BRIDGE_PORT", "8001"))
    _log.info("=" * 60)

    yield

    _log.info("Pragati AI Bridge shutting down")


# ---------------------------------------------------------------------------
# APP
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Pragati AI Bridge",
    version="1.0.0",
    description="Production HTTP bridge — Pragati AI Controller ↔ Node.js Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------------

class TextRequest(BaseModel):
    text:             str
    session_id:       Optional[str]            = None
    farmer_id:        str                      = ""
    farmer_name:      str                      = ""
    language:         Optional[str]            = None
    location:         Optional[dict[str, Any]] = None
    synthesize_audio: bool                     = False
    use_cache:        bool                     = True
    extra:            Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _ctrl() -> PragatiAIController:
    if _controller is None:
        raise HTTPException(status_code=503, detail={
            "error":   "AI Controller not initialised",
            "hint":    "Check startup validation report at GET /validation",
            "success": False,
        })
    return _controller


def _audio_ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in {
        ".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus"
    }


def _image_ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in {
        ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"
    }


def _log_perf(pipeline: str, elapsed_ms: float, result: dict) -> None:
    _log.info(
        "PIPELINE | %-6s | success=%-5s | intent=%-20s | lang=%-4s | %.1fms",
        pipeline.upper(),
        result.get("success", False),
        result.get("intent", "—"),
        result.get("language", "—"),
        elapsed_ms,
    )


async def _run_in_executor(fn, *args) -> Any:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, functools.partial(fn, *args))


# ---------------------------------------------------------------------------
# ENDPOINTS — ROOT AGENT HEALTH
# ---------------------------------------------------------------------------

@app.get("/root-agent/health")
async def root_agent_health():
    """
    Root Agent health — verifies Intent Engine is loaded and routing is active.
    Confirms: OpenAI is NOT the primary engine.
    """
    try:
        from root_agent.root_agent import get_root_agent
        agent = get_root_agent()
        health_data = await _run_in_executor(agent.health)
        return JSONResponse(content={
            "architecture": "local_root_agent_primary",
            "openai_primary": False,
            "intent_engine_primary": True,
            **health_data,
        })
    except Exception as exc:
        _log.error("root_agent_health error: %s", exc)
        raise HTTPException(status_code=500, detail={"error": str(exc), "success": False})


# ---------------------------------------------------------------------------
# ENDPOINTS — HEALTH & STATUS
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Liveness + module status probe."""
    try:
        result = await _run_in_executor(_ctrl().health_check)
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as exc:
        _log.error("Health check error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/status")
async def status():
    """Per-module load status."""
    try:
        module_status = await _run_in_executor(_ctrl().get_module_status)
        return JSONResponse(content={
            "modules":        module_status,
            "startup_report": _startup_report,
            "cache":          _text_cache.stats(),
            "metrics":        _metrics.snapshot(),
            "uptime_s":       round(time.monotonic() - _startup_time, 1),
        })
    except HTTPException:
        raise
    except Exception as exc:
        _log.error("Status error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/validation")
async def validation():
    """Returns the startup validation report."""
    return JSONResponse(content=_startup_report)


@app.get("/diagnostics")
async def diagnostics():
    """Full pipeline diagnostics — metrics, cache, module status, uptime."""
    try:
        module_status = await _run_in_executor(_ctrl().get_module_status)
        health_data   = await _run_in_executor(_ctrl().health_check)
    except HTTPException:
        module_status = {}
        health_data   = {}

    return JSONResponse(content={
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "uptime_s":        round(time.monotonic() - _startup_time, 1),
        "pipeline_metrics": _metrics.snapshot(),
        "cache":           _text_cache.stats(),
        "modules":         module_status,
        "assets":          health_data.get("assets", {}),
        "startup_status":  _startup_report.get("status", "UNKNOWN"),
        "startup_passed":  _startup_report.get("passed", 0),
        "startup_warnings": _startup_report.get("warnings", 0),
        "startup_errors":  _startup_report.get("errors", 0),
    })


# ---------------------------------------------------------------------------
# ENDPOINTS — TEXT PIPELINE
# ---------------------------------------------------------------------------

@app.post("/process/text")
async def process_text(req: TextRequest):
    """
    Text → Intent Engine → Knowledge Router → Response.
    Supports LRU caching and in-flight deduplication.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail={
            "error": "text field is required and must not be empty",
            "success": False,
        })

    language = req.language or _cfg.default_language

    # Cache lookup (skip for synthesize_audio requests)
    if req.use_cache and not req.synthesize_audio:
        cached = _text_cache.get(req.text, language)
        if cached:
            cached["cached"] = True
            _log.debug("Cache HIT | text='%s...' lang=%s", req.text[:30], language)
            return JSONResponse(content=cached)

    # In-flight deduplication key
    dedup_key = hashlib.sha256(
        f"{req.text.strip()}|{language}|{req.farmer_id}".encode()
    ).hexdigest()[:24]

    existing = await _inflight.acquire(dedup_key)
    if existing is not None:
        existing["deduplicated"] = True
        return JSONResponse(content=existing)

    t0 = time.perf_counter()
    try:
        cfg = get_config()
        audio_out: Optional[Path] = None
        if req.synthesize_audio and req.session_id:
            audio_out = cfg.outputs_dir / "audio" / f"{req.session_id}_response.wav"
            audio_out.parent.mkdir(parents=True, exist_ok=True)

        result = await _run_in_executor(
            _ctrl().process,
            req.text,
            req.session_id,
            req.farmer_id,
            req.farmer_name,
            req.language,
            req.location,
            req.synthesize_audio,
            audio_out,
            req.extra,
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("text", elapsed_ms, error=not result.get("success", True))
        _log_perf("text", elapsed_ms, result)

        # Cache successful non-audio responses
        if result.get("success") and not req.synthesize_audio:
            _text_cache.set(req.text, language, result)

        result["cached"]       = False
        result["deduplicated"] = False
        await _inflight.release(dedup_key, result)
        return JSONResponse(content=result)

    except HTTPException:
        await _inflight.release(dedup_key, {"success": False, "error": "pipeline_error"})
        raise
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("text", elapsed_ms, error=True)
        _log.error("process_text error: %s", exc, exc_info=True)
        await _inflight.release(dedup_key, {"success": False, "error": str(exc)})
        raise HTTPException(status_code=500, detail={"error": str(exc), "success": False})


# ---------------------------------------------------------------------------
# ENDPOINTS — VOICE PIPELINE
# ---------------------------------------------------------------------------

@app.post("/process/voice")
async def process_voice(
    audio:            UploadFile    = File(...),
    session_id:       Optional[str] = Form(None),
    farmer_id:        str           = Form(""),
    farmer_name:      str           = Form(""),
    language:         Optional[str] = Form(None),
    synthesize_audio: bool          = Form(True),
):
    """
    Voice → STT → Intent Engine → Knowledge Router → TTS → Response.
    Audio file is written to a temp path, processed, then deleted.
    """
    filename = audio.filename or "upload.wav"
    if not _audio_ext_ok(filename):
        raise HTTPException(status_code=400, detail={
            "error":   f"Unsupported audio format: {Path(filename).suffix}",
            "allowed": [".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aac", ".opus"],
            "success": False,
        })

    suffix   = Path(filename).suffix.lower()
    tmp_path: Optional[str] = None
    t0 = time.perf_counter()

    try:
        # Write upload to temp file asynchronously
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        content = await audio.read()
        await asyncio.get_running_loop().run_in_executor(None, Path(tmp_path).write_bytes, content)

        cfg       = get_config()
        audio_out: Optional[Path] = None
        if synthesize_audio and session_id:
            audio_out = cfg.outputs_dir / "audio" / f"{session_id}_response.wav"
            audio_out.parent.mkdir(parents=True, exist_ok=True)

        result = await _run_in_executor(
            _ctrl().process,
            Path(tmp_path),
            session_id,
            farmer_id,
            farmer_name,
            language or None,
            None,
            synthesize_audio,
            audio_out,
            None,
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("voice", elapsed_ms, error=not result.get("success", True))
        _log_perf("voice", elapsed_ms, result)
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("voice", elapsed_ms, error=True)
        _log.error("process_voice error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(exc), "success": False})
    finally:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# ENDPOINTS — IMAGE PIPELINE
# ---------------------------------------------------------------------------

@app.post("/process/image")
async def process_image(
    image:      UploadFile    = File(...),
    session_id: Optional[str] = Form(None),
    farmer_id:  str           = Form(""),
    language:   Optional[str] = Form(None),
):
    """
    Image → Disease AI (YOLO) → Knowledge Base → Response.
    Image file is written to a temp path, processed, then deleted.
    """
    filename = image.filename or "upload.jpg"
    if not _image_ext_ok(filename):
        raise HTTPException(status_code=400, detail={
            "error":   f"Unsupported image format: {Path(filename).suffix}",
            "allowed": [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"],
            "success": False,
        })

    suffix   = Path(filename).suffix.lower()
    tmp_path: Optional[str] = None
    t0 = time.perf_counter()

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        content = await image.read()
        await asyncio.get_running_loop().run_in_executor(None, Path(tmp_path).write_bytes, content)

        result = await _run_in_executor(
            _ctrl().process,
            Path(tmp_path),
            session_id,
            farmer_id,
            "",
            language or None,
            None,
            False,
            None,
            None,
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("image", elapsed_ms, error=not result.get("success", True))
        _log_perf("image", elapsed_ms, result)
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        _metrics.record("image", elapsed_ms, error=True)
        _log.error("process_image error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(exc), "success": False})
    finally:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# ENDPOINTS — AUDIO SERVE
# ---------------------------------------------------------------------------

@app.get("/audio/{session_id}")
async def get_audio(session_id: str):
    """Serves the TTS-generated WAV file for a session."""
    cfg      = get_config()
    wav_path = cfg.outputs_dir / "audio" / f"{session_id}_response.wav"
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(
        path       = str(wav_path),
        media_type = "audio/wav",
        filename   = f"{session_id}_response.wav",
    )


# ---------------------------------------------------------------------------
# ENDPOINTS — SESSION MANAGEMENT
# ---------------------------------------------------------------------------

@app.get("/session/{session_id}/history")
async def get_session_history(session_id: str):
    """Returns the full conversation history for a session."""
    try:
        history = await _run_in_executor(_ctrl().get_session_history, session_id)
        return JSONResponse(content={
            "session_id": session_id,
            "history":    history,
            "count":      len(history),
        })
    except Exception as exc:
        _log.error("get_session_history error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/session/{session_id}/context")
async def get_session_context(session_id: str):
    """Returns the current session context."""
    try:
        ctx = await _run_in_executor(_ctrl().get_session_context, session_id)
        return JSONResponse(content={"session_id": session_id, "context": ctx})
    except Exception as exc:
        _log.error("get_session_context error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/session/{session_id}/store")
async def get_session_store(session_id: str):
    """Returns the KB-layer session store context (active disease, crop, YOLO result)."""
    try:
        from knowledge_base.session_store import get_session_store as _get_store
        store = _get_store()
        data  = store.get_all(session_id)
        return JSONResponse(content={"session_id": session_id, "store": data})
    except Exception as exc:
        _log.error("get_session_store error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/session/{session_id}")
async def end_session(session_id: str):
    """Ends a session and flushes memory to disk."""
    try:
        await _run_in_executor(_ctrl().end_session, session_id)
        return JSONResponse(content={"success": True, "session_id": session_id})
    except Exception as exc:
        _log.error("end_session error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# ENDPOINTS — CACHE MANAGEMENT
# ---------------------------------------------------------------------------

@app.delete("/cache")
async def clear_cache():
    """Clears the text response cache."""
    _text_cache.clear()
    _log.info("Text response cache cleared")
    return JSONResponse(content={"success": True, "message": "Cache cleared"})


# ---------------------------------------------------------------------------
# ENDPOINTS — MANUAL REBUILD
# ---------------------------------------------------------------------------

@app.post("/rebuild")
async def manual_rebuild(force: bool = False):
    """
    Manually triggers dataset rebuild + model retrain.
    Use after adding new JSON training examples.
    Set force=true to rebuild even if fingerprint is unchanged.
    """
    _log.info("MANUAL REBUILD requested | force=%s", force)
    loop = asyncio.get_running_loop()
    try:
        from intent_engine.auto_rebuild import ensure_model_is_current
        success = await loop.run_in_executor(None, lambda: ensure_model_is_current(force=force))
        # Clear response cache so new model is used immediately
        _text_cache.clear()
        # Reset root agent singleton so it reloads the new model
        try:
            import root_agent.root_agent as _ra
            _ra._root_agent_instance = None
        except Exception:
            pass
        return JSONResponse(content={
            "success": success,
            "message": "Rebuild complete. Cache cleared. Model reloaded." if success
                       else "Rebuild failed. Check logs.",
        })
    except Exception as exc:
        _log.error("manual_rebuild error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(exc), "success": False})


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PAC_BRIDGE_PORT", "8001"))
    host = os.getenv("PAC_BRIDGE_HOST", "0.0.0.0")
    _log.info("Starting Pragati AI Bridge on %s:%d", host, port)
    uvicorn.run(
        "pragati_ai_controller.fastapi_bridge:app",
        host      = host,
        port      = port,
        reload    = False,
        log_level = os.getenv("PAC_LOG_LEVEL", "info").lower(),
        workers   = 1,   # single worker — controller is a singleton
    )
