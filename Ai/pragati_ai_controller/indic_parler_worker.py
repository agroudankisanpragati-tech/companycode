"""Persistent client for the isolated Indic Parler inference environment."""

from __future__ import annotations

import atexit
import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

_AI_ROOT = Path(__file__).resolve().parents[1]
_WORKER_SCRIPT = Path(__file__).with_name("indic_parler_tts.py")
_LOCK = threading.Lock()
_PROCESS: subprocess.Popen[str] | None = None
_MODEL_LOADED = False


def _python_executable() -> Path:
    configured = os.getenv("INDIC_PARLER_PYTHON")
    if configured:
        return Path(configured).expanduser().resolve()
    if os.name == "nt":
        return _AI_ROOT / "parler_tts_env" / "Scripts" / "python.exe"
    return _AI_ROOT / "parler_tts_env" / "bin" / "python"


def get_worker_status() -> dict[str, Any]:
    interpreter = _python_executable()
    worker_running = _PROCESS is not None and _PROCESS.poll() is None
    return {
        "provider": "indic-parler",
        "model": os.getenv("INDIC_PARLER_MODEL", "ai4bharat/indic-parler-tts"),
        "configured": interpreter.is_file(),
        "worker_running": _PROCESS is not None and _PROCESS.poll() is None,
        "loaded": _MODEL_LOADED and worker_running,
        "interpreter": str(interpreter),
        "fallback": "browser-speech-synthesis",
    }


def _start_worker() -> subprocess.Popen[str]:
    global _PROCESS
    if _PROCESS is not None and _PROCESS.poll() is None:
        return _PROCESS

    interpreter = _python_executable()
    if not interpreter.is_file():
        raise RuntimeError(
            f"Indic Parler environment is missing: {interpreter}. "
            "Create Ai/parler_tts_env and install Ai/requirements-indic-parler.txt."
        )

    env = os.environ.copy()
    env["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
    env["TRANSFORMERS_VERBOSITY"] = "error"
    _PROCESS = subprocess.Popen(
        [str(interpreter), "-u", str(_WORKER_SCRIPT), "--worker"],
        cwd=str(_AI_ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,   # pass through so errors appear in bridge terminal
        text=True,
        encoding="utf-8",
        bufsize=1,
        env=env,
    )
    return _PROCESS


def synthesize(text: str, language: str) -> dict[str, str]:
    """Send one request to the persistent isolated worker and return its WAV."""
    global _MODEL_LOADED
    with _LOCK:
        process = _start_worker()
        if process.stdin is None or process.stdout is None:
            raise RuntimeError("Indic Parler worker did not expose its request pipes")

        try:
            process.stdin.write(json.dumps({"text": text, "language": language}, ensure_ascii=False) + "\n")
            process.stdin.flush()
            line = process.stdout.readline()
        except (BrokenPipeError, OSError) as exc:
            _stop_worker()
            raise RuntimeError("Indic Parler worker stopped unexpectedly; restart the AI bridge and retry") from exc

        if not line:
            _stop_worker()
            raise RuntimeError("Indic Parler worker returned no response")

        try:
            result = json.loads(line)
        except json.JSONDecodeError as exc:
            _stop_worker()
            raise RuntimeError("Indic Parler worker returned an invalid response") from exc

        if result.get("error"):
            raise RuntimeError(result["error"])
        _MODEL_LOADED = True
        return {"audio_base64": result["audio_base64"], "language": result["language"]}


def _stop_worker() -> None:
    global _PROCESS, _MODEL_LOADED
    process, _PROCESS = _PROCESS, None
    _MODEL_LOADED = False
    if process is None or process.poll() is not None:
        return
    try:
        process.stdin and process.stdin.close()
        process.terminate()
        process.wait(timeout=5)
    except Exception:
        process.kill()


atexit.register(_stop_worker)
