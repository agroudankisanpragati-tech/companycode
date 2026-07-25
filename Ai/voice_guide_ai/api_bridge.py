"""
Voice Guide AI — FastAPI Bridge Server.

Exposes the RuntimeManager over HTTP so the Node.js backend can
call it without spawning a subprocess.

Endpoints
---------
POST /voice-guide/session/start
POST /voice-guide/session/stop
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

Run:
    cd Ai
    python -m voice_guide_ai.api_bridge
  or
    python voice_guide_ai/api_bridge.py
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

# Ensure voice_guide_ai internals are importable when run directly.
# Only insert the package root (voice_guide_ai/) itself — never the parent
# Ai/ directory, because Ai/config.py would shadow voice_guide_ai/config/.
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

# ── Singleton runtime ─────────────────────────────────────────────────────────

_runtime: Optional[RuntimeManager] = None
_runtime_ready: bool = False


def ensure_runtime_started() -> RuntimeManager:
    global _runtime, _runtime_ready
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


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _runtime
    setup_logging(level=SETTINGS.log_level)
    # Run startup validation
    try:
        import sys
        from pathlib import Path
        _vpath = Path(__file__).resolve().parent
        if str(_vpath) not in sys.path:
            sys.path.insert(0, str(_vpath))
        from startup_validator import validate
        result = validate()
        if not result["passed"]:
            _log.error("Startup validation FAILED: %s", result["issues"])
        else:
            _log.info("Startup validation passed (warnings=%d)", result["warning_count"])
    except Exception as _ve:
        _log.warning("Startup validator could not run: %s", _ve)
    try:
        ensure_runtime_started()
    except Exception as exc:
        # Log but do not crash the server — health endpoint must stay reachable
        _log.error("RuntimeManager failed to start at lifespan: %s", exc, exc_info=True)
    yield
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
    """Detailed health check for Voice Guide AI subsystems."""
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


@app.post("/voice-guide/page")
def open_page(req: PageRequest):
    rt = get_runtime()
    try:
        result = rt.open_page(req.page, req.language)
        # Inject translated text for frontend TTS.
        # result["dialogue_result"] is the EngineResult dict from DialogueRuntime.play().
        # The text field lives at result["dialogue_result"]["text"] if the selector
        # merged it, otherwise we look it up from translations using the dialogue_id.
        text = ""
        dr = result.get("dialogue_result") if isinstance(result, dict) else None
        if isinstance(dr, dict):
            text = dr.get("text") or ""
            if not text:
                try:
                    from utils.language_manager import LanguageManager
                    lang = req.language or rt._session_manager.current_language or "hi"
                    dialogue_id = dr.get("dialogue_id") or ""
                    if dialogue_id:
                        lm = LanguageManager()
                        translations = lm.load_translation(lang, req.page)
                        text = translations.get(dialogue_id, "")
                        # Fallback: try without sequence suffix (e.g. scheme_welcome_001 -> scheme_welcome)
                        if not text:
                            base = "_".join(dialogue_id.split("_")[:-1])
                            text = translations.get(base, "")
                except Exception:
                    pass
        if text:
            result["text"] = text
            result["events"] = result.get("events") or [{"event_type": "page_opened", "payload": {"text": text, "page": req.page}}]
        return {"success": True, "data": result}
    except Exception as exc:
        _log.exception("open_page failed: %s", exc)
        return {"success": False, "error": str(exc)}


@app.post("/voice-guide/play")
def play_dialogue(req: PlayRequest):
    rt = get_runtime()
    try:
        result = rt.play(
            req.page,
            req.dialogue_type,
            req.language,
            req.priority,
            req.context,
        )
        # Inject translated text for frontend TTS.
        if isinstance(result, dict) and not result.get("text"):
            try:
                from utils.language_manager import LanguageManager
                lang = req.language or rt._session_manager.current_language or "hi"
                lm = LanguageManager()
                translations = lm.load_translation(lang, req.page)
                dialogue_id = result.get("dialogue_id") or f"{req.page}_{req.dialogue_type}_001"
                text = translations.get(dialogue_id, "")
                if not text:
                    # Fallback: strip sequence suffix
                    base = "_".join(dialogue_id.split("_")[:-1])
                    text = translations.get(base, "")
                if text:
                    result["text"] = text
            except Exception:
                pass
        return {"success": True, "data": result}
    except Exception as exc:
        _log.exception("play_dialogue failed: %s", exc)
        return {"success": False, "error": str(exc)}


@app.post("/voice-guide/replay")
def replay_dialogue(req: ReplayRequest):
    rt = get_runtime()
    try:
        result = rt.replay(req.dialogue_id)
        # Inject translated text for frontend TTS.
        if isinstance(result, dict) and not result.get("text"):
            try:
                from utils.language_manager import LanguageManager
                last = rt._dialogue_runtime._replay.last()
                if last:
                    lang = rt._session_manager.current_language or "hi"
                    lm = LanguageManager()
                    translations = lm.load_translation(lang, last.page)
                    dialogue_id = result.get("dialogue_id") or last.dialogue_id
                    text = translations.get(dialogue_id, "")
                    if not text:
                        base = "_".join(dialogue_id.split("_")[:-1])
                        text = translations.get(base, "")
                    if text:
                        result["text"] = text
            except Exception:
                pass
        return {"success": True, "data": result}
    except Exception as exc:
        _log.exception("replay_dialogue failed: %s", exc)
        return {"success": False, "error": str(exc)}


@app.post("/voice-guide/language")
def set_language(req: LanguageRequest):
    try:
        rt = get_runtime()
        result = rt.set_language(req.language)
        # After language switch, re-play the current page in the new language
        # so the user immediately hears the translated dialogue.
        current_page = rt._session_manager.current_page
        text = ""
        if current_page:
            try:
                from utils.language_manager import LanguageManager
                lm = LanguageManager()
                translations = lm.load_translation(req.language, current_page)
                # Determine which dialogue type was last played
                last = rt._dialogue_runtime._replay.last()
                if last and last.page == current_page:
                    dialogue_id = last.dialogue_id
                    text = translations.get(dialogue_id, "")
                    if not text:
                        base = "_".join(dialogue_id.split("_")[:-1])
                        text = translations.get(base, "")
                if not text:
                    # Fallback: welcome text for current page
                    for key, val in translations.items():
                        if "welcome" in key and isinstance(val, str):
                            text = val
                            break
            except Exception:
                pass
        return {"success": True, "data": result, "text": text, "page": current_page}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("set_language failed: %s", exc)
        return {"success": False, "error": str(exc)}


@app.post("/voice-guide/conditions")
def update_conditions(req: ConditionsRequest):
    try:
        rt = get_runtime()
        rt.update_conditions(req.conditions)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("conditions update failed: %s", exc)
        return {"success": False, "error": str(exc)}


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
    """
    Return the dialogue JSON + translated text for a page/type/language.
    Used by the frontend to pre-fetch dialogue content.
    """
    rt = get_runtime()
    try:
        from utils.dialogue_loader import DialogueLoader
        from utils.language_manager import LanguageManager
        loader = DialogueLoader()
        lm = LanguageManager()
        dialogue = loader.load(page, dialogue_type)
        if dialogue is None:
            raise HTTPException(status_code=404, detail=f"Dialogue not found: {page}/{dialogue_type}")
        # Resolve translated text
        try:
            translations = lm.load_translation(lang, page)
            dialogue_id = dialogue.get("id", "")
            translated_text = translations.get(dialogue_id, dialogue.get("text", ""))
        except Exception:
            translated_text = dialogue.get("text", "")
        return {
            "success": True,
            "data": {
                "dialogue": dialogue,
                "text": translated_text,
                "language": lang,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@app.get("/voice-guide/translation/{lang}/{page}")
def get_translation(lang: str, page: str):
    """Return all translations for a language+page combination."""
    try:
        from utils.language_manager import LanguageManager
        lm = LanguageManager()
        translations = lm.load_translation(lang, page)
        return {"success": True, "data": translations, "language": lang, "page": page}
    except Exception as exc:
        return {"success": False, "error": str(exc), "data": {}}


@app.get("/voice-guide/avatar/config")
def get_avatar_config():
    """Return avatar configuration for the frontend renderer."""
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
