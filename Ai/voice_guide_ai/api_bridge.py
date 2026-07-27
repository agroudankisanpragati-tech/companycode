"""
Voice Guide AI — FastAPI Bridge Server.

ARCHITECTURE FIXES
------------------

FIX-1  RuntimeManager singleton race
  _INIT_LOCK serialises construction + start() so pygame.mixer.init()
  is called exactly once.

FIX-2  BackgroundTasks block the async event loop
  _BG_POOL (ThreadPoolExecutor) submits all background work as real OS
  threads.  HTTP handlers return _queued() in < 1 ms.

FIX-3  /initialize endpoint
  Accepts {page, language, conditions} and fans out to
  update_conditions + set_language + open_page in the thread pool.
  Returns immediately — no blocking.

FIX-4  Duplicate play from /initialize + /page
  /initialize calls open_page() internally via _bg_initialize.
  The backend route must NOT also call /page after /initialize.
  Bridge-level _DedupeGuard (500 ms) drops duplicate /page calls.
  Runtime-level debounce (300 ms) drops duplicate play() calls.

FIX-5  504 timeouts
  All blocking work (engine.play, TTS generation) runs in the thread
  pool.  HTTP handlers never block on Python I/O.

Endpoints
---------
POST /voice-guide/session/start
POST /voice-guide/session/stop
POST /voice-guide/initialize
POST /voice-guide/page
POST /voice-guide/play
POST /voice-guide/replay
POST /voice-guide/language
POST /voice-guide/conditions
POST /voice-guide/online
GET  /voice-guide/status
GET  /voice-guide/dialogue/{page}/{dialogue_type}
GET  /voice-guide/translation/{lang}/{page}
GET  /voice-guide/avatar/config
GET  /health
"""

from __future__ import annotations

import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.logger import get_logger, setup_logging
from config.settings import SETTINGS
from runtime.runtime_manager import RuntimeManager

_log = get_logger("voice_guide_ai.api_bridge")

# Real thread pool — background work never touches the event loop.
_BG_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="vg-bg")

# Singleton init lock
_INIT_LOCK      = threading.Lock()
_runtime: Optional[RuntimeManager] = None
_runtime_ready: bool = False


def ensure_runtime_started() -> RuntimeManager:
    global _runtime, _runtime_ready
    # Fast path: already started — no lock needed
    if _runtime_ready and _runtime is not None:
        return _runtime

    with _INIT_LOCK:
        # Re-check under lock (double-checked locking)
        if _runtime_ready and _runtime is not None:
            return _runtime

        if _runtime is None:
            setup_logging(level=SETTINGS.log_level)
            try:
                _runtime = RuntimeManager()
            except Exception as exc:
                _log.exception("RuntimeManager construction failed: %s", exc)
                raise HTTPException(
                    status_code=503,
                    detail=f"RuntimeManager construction failed: {exc}",
                ) from exc

        if not getattr(_runtime, "_started", False):
            try:
                _runtime.start()
                _runtime_ready = True
                _log.info("Voice Guide RuntimeManager started successfully")
            except Exception as exc:
                _log.exception("Voice Guide RuntimeManager start() failed: %s", exc)
                raise HTTPException(
                    status_code=503,
                    detail=f"Voice Guide start() failed: {exc}",
                ) from exc

    return _runtime


def get_runtime() -> RuntimeManager:
    return ensure_runtime_started()


# ── Language alias resolution ─────────────────────────────────────────────────

_lm_instance: Optional[Any] = None
_lm_lock = threading.Lock()


def _resolve_alias(language: Optional[str]) -> Optional[str]:
    if not language:
        return language
    global _lm_instance
    if _lm_instance is None:
        with _lm_lock:
            if _lm_instance is None:
                try:
                    from utils.language_manager import LanguageManager
                    _lm_instance = LanguageManager()
                except Exception:
                    return language
    try:
        return _lm_instance.resolve_alias(language)
    except Exception:
        return language


# ── Deduplication guards ──────────────────────────────────────────────────────

_DEDUP_MS = 500


class _DedupeGuard:
    """Thread-safe last-key / last-time guard."""

    def __init__(self) -> None:
        self._lock      = threading.Lock()
        self._last_key:  tuple = ()
        self._last_time: float = 0.0

    def is_duplicate(self, key: tuple) -> bool:
        now = time.monotonic()
        with self._lock:
            if (
                key == self._last_key
                and (now - self._last_time) * 1000 < _DEDUP_MS
            ):
                return True
            self._last_key  = key
            self._last_time = now
            return False


_page_guard = _DedupeGuard()
_play_guard = _DedupeGuard()
_lang_guard = _DedupeGuard()
_init_guard = _DedupeGuard()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _runtime
    setup_logging(level=SETTINGS.log_level)
    try:
        from startup_validator import validate
        result = validate()
        if not result["passed"]:
            _log.error("Startup validation FAILED: %s", result["issues"])
        else:
            _log.info("Startup validation passed (warnings=%d)", result["warning_count"])
    except Exception as _ve:
        _log.warning("Startup validator could not run: %s", _ve)
    # Start the runtime synchronously in the lifespan so it is fully ready
    # before any HTTP request arrives.  This eliminates the race where the
    # first /session/start or /initialize request also calls
    # ensure_runtime_started() concurrently and creates a second RuntimeManager.
    try:
        ensure_runtime_started()
    except Exception as exc:
        _log.error("RuntimeManager failed to start at lifespan: %s", exc, exc_info=True)
    yield
    _BG_POOL.shutdown(wait=False)
    with _INIT_LOCK:
        if _runtime:
            _runtime.stop()
            _runtime = None


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Voice Guide AI Bridge",
    version="1.0.0",
    description="HTTP bridge for Voice Guide AI RuntimeManager",
    lifespan=lifespan,
)

_cors_origins = os.getenv("VOICE_GUIDE_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class PageRequest(BaseModel):
    page: str
    language: Optional[str] = None


class PlayRequest(BaseModel):
    page: str
    dialogue_type: str = "welcome"
    language: Optional[str] = None
    priority: int = 5
    context: Optional[dict[str, Any]] = None


class ReplayRequest(BaseModel):
    dialogue_id: Optional[str] = None


class LanguageRequest(BaseModel):
    language: str


class ConditionsRequest(BaseModel):
    conditions: dict[str, Any]


class OnlineRequest(BaseModel):
    online: bool


class InitializeRequest(BaseModel):
    page: str
    language: Optional[str] = None
    conditions: Optional[dict[str, Any]] = None


# ── Immediate ACK ─────────────────────────────────────────────────────────────

def _queued(page: str = "", language: str = "", **extra: Any) -> dict[str, Any]:
    return {"success": True, "queued": True, "page": page, "language": language, **extra}


# ── Background task implementations ──────────────────────────────────────────

def _bg_open_page(page: str, language: Optional[str]) -> None:
    try:
        rt = get_runtime()
        rt.open_page(page, language)
    except Exception as exc:
        _log.error("bg open_page failed: page=%s — %s", page, exc, exc_info=True)


def _bg_play(
    page: str,
    dialogue_type: str,
    language: Optional[str],
    priority: int,
    context: Optional[dict[str, Any]],
) -> None:
    try:
        rt = get_runtime()
        rt.play(page, dialogue_type, language, priority, context)
    except Exception as exc:
        _log.error("bg play failed: page=%s type=%s — %s", page, dialogue_type, exc, exc_info=True)


def _bg_replay(dialogue_id: Optional[str]) -> None:
    try:
        rt = get_runtime()
        rt.replay(dialogue_id)
    except Exception as exc:
        _log.error("bg replay failed: id=%s — %s", dialogue_id, exc, exc_info=True)


def _bg_set_language(language: str) -> None:
    try:
        rt = get_runtime()
        rt.set_language(language)
    except Exception as exc:
        _log.error("bg set_language failed: lang=%s — %s", language, exc, exc_info=True)


def _bg_update_conditions(conditions: dict[str, Any]) -> None:
    try:
        rt = get_runtime()
        rt.update_conditions(conditions)
    except Exception as exc:
        _log.error("bg update_conditions failed: %s", exc, exc_info=True)


def _bg_initialize(
    page: str,
    language: Optional[str],
    conditions: Optional[dict[str, Any]],
) -> None:
    """
    FIX-4: Combined init — conditions → language → open_page.
    open_page() internally calls dialogue_runtime.play() which posts
    STOP + PLAY to the serial worker.  No separate /play call needed.
    """
    try:
        rt = get_runtime()
        if conditions:
            rt.update_conditions(conditions)
        if language:
            rt.set_language(language)
        rt.open_page(page, language)
    except Exception as exc:
        _log.error("bg initialize failed: page=%s — %s", page, exc, exc_info=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "voice-guide-ai-bridge",
        "version": "1.0.0",
        "runtime_ready": _runtime_ready,
    }


@app.get("/voice-guide/health")
def voice_guide_health():
    try:
        rt = get_runtime()
        status = rt.get_status()
        return {
            "status": "ok",
            "started": status.get("started"),
            "is_online": status.get("is_online"),
            "queue_size": status.get("queue_size"),
            "cache_stats": status.get("cache_stats"),
        }
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


@app.post("/voice-guide/session/start")
def session_start():
    try:
        rt = get_runtime()
        return {"success": True, "status": rt.get_status()}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("session/start failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"session/start failed: {exc}") from exc


@app.post("/voice-guide/session/stop")
def session_stop():
    try:
        rt = get_runtime()
        rt.stop()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("session/stop failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"session/stop failed: {exc}") from exc


@app.post("/voice-guide/initialize")
def initialize(req: InitializeRequest):
    """
    FIX-4: Single initialisation endpoint.
    Submits _bg_initialize to thread pool and returns immediately.
    _bg_initialize calls open_page() which triggers play() internally.
    The backend route must NOT call /page after this — that would duplicate.
    """
    lang = _resolve_alias(req.language)
    page = req.page

    if _init_guard.is_duplicate((page, lang or "")):
        _log.debug("Deduped /initialize: page=%s lang=%s", page, lang)
        return _queued(page=page, language=lang or "", state="deduped")

    _BG_POOL.submit(_bg_initialize, page, lang, req.conditions)
    return _queued(page=page, language=lang or "", state="scheduled")


@app.post("/voice-guide/page")
def open_page(req: PageRequest):
    """
    Navigate to a page and trigger the welcome/revisit dialogue.
    Returns immediately — all work in thread pool.
    """
    lang = _resolve_alias(req.language)
    page = req.page

    if _page_guard.is_duplicate((page, lang or "")):
        _log.debug("Deduped /page: page=%s lang=%s", page, lang)
        return _queued(page=page, language=lang or "", state="deduped")

    _BG_POOL.submit(_bg_open_page, page, lang)
    return _queued(page=page, language=lang or "", state="scheduled")


@app.post("/voice-guide/play")
def play_dialogue(req: PlayRequest):
    """
    Play a specific dialogue type for a page.
    Returns immediately — all work in thread pool.
    """
    lang  = _resolve_alias(req.language)
    page  = req.page
    dtype = req.dialogue_type

    if _play_guard.is_duplicate((page, dtype, lang or "")):
        _log.debug("Deduped /play: page=%s type=%s lang=%s", page, dtype, lang)
        return _queued(page=page, language=lang or "", dialogue_type=dtype, state="deduped")

    _BG_POOL.submit(_bg_play, page, dtype, lang, req.priority, req.context)
    return _queued(page=page, language=lang or "", dialogue_type=dtype, state="scheduled")


@app.post("/voice-guide/replay")
def replay_dialogue(req: ReplayRequest):
    _BG_POOL.submit(_bg_replay, req.dialogue_id)
    return {"success": True, "queued": True, "dialogue_id": req.dialogue_id}


@app.post("/voice-guide/language")
def set_language(req: LanguageRequest):
    lang = _resolve_alias(req.language) or req.language

    if _lang_guard.is_duplicate((lang,)):
        _log.debug("Deduped /language: lang=%s", lang)
        return {"success": True, "queued": True, "language": lang, "state": "deduped"}

    _BG_POOL.submit(_bg_set_language, lang)
    return {"success": True, "queued": True, "language": lang, "state": "scheduled"}


@app.post("/voice-guide/conditions")
def update_conditions(req: ConditionsRequest):
    _BG_POOL.submit(_bg_update_conditions, req.conditions)
    return {"success": True, "queued": True}


@app.post("/voice-guide/online")
def set_online(req: OnlineRequest):
    try:
        rt = get_runtime()
        rt.set_online(req.online)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("set_online failed: %s", exc)
        return {"success": False, "error": str(exc)}


@app.get("/voice-guide/status")
def get_status():
    try:
        rt = get_runtime()
        return {"success": True, "data": rt.get_status()}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("get_status failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"get_status failed: {exc}") from exc


@app.get("/voice-guide/dialogue/{page}/{dialogue_type}")
def get_dialogue(page: str, dialogue_type: str, lang: str = "hi"):
    get_runtime()
    try:
        from utils.dialogue_loader import DialogueLoader
        from utils.language_manager import LanguageManager
        loader = DialogueLoader()
        lm     = LanguageManager()
        dialogue = loader.load(page, dialogue_type)
        if dialogue is None:
            raise HTTPException(
                status_code=404, detail=f"Dialogue not found: {page}/{dialogue_type}"
            )
        try:
            translations    = lm.load_translation(lang, page)
            dialogue_id     = dialogue.get("id", "")
            translated_text = translations.get(dialogue_id, dialogue.get("text", ""))
        except Exception:
            translated_text = dialogue.get("text", "")
        return {
            "success": True,
            "data": {"dialogue": dialogue, "text": translated_text, "language": lang},
        }
    except HTTPException:
        raise
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@app.get("/voice-guide/translation/{lang}/{page}")
def get_translation(lang: str, page: str):
    try:
        from utils.language_manager import LanguageManager
        lm = LanguageManager()
        translations = lm.load_translation(lang, page)
        return {"success": True, "data": translations, "language": lang, "page": page}
    except Exception as exc:
        return {"success": False, "error": str(exc), "data": {}}


@app.get("/voice-guide/avatar/config")
def get_avatar_config():
    try:
        import json
        from config.paths import PATHS
        cfg_path = PATHS.avatar_config_json
        if cfg_path.exists():
            with open(cfg_path, encoding="utf-8-sig") as fh:
                cfg = json.load(fh)
            return {"success": True, "data": cfg}
        return {"success": False, "error": "Avatar config not found"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("VOICE_GUIDE_BRIDGE_PORT", "8002"))
    host = os.getenv("VOICE_GUIDE_BRIDGE_HOST", "0.0.0.0")
    uvicorn.run("api_bridge:app", host=host, port=port, reload=False, log_level="info")
