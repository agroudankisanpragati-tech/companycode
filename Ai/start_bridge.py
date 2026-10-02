# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: Ai/start_bridge.py
# Purpose: Production startup script for the Pragati AI Bridge.
#          Sets sys.path correctly before any imports, loads .env,
#          then launches the FastAPI bridge server.
#
# Usage:
#   cd Ai
#   python start_bridge.py
#
# Or with uvicorn directly:
#   cd Ai
#   python -m uvicorn pragati_ai_controller.fastapi_bridge:app --host 0.0.0.0 --port 8001
# =============================================================================

from __future__ import annotations

import os
import json
import socket
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

# ── Path bootstrap ────────────────────────────────────────────────────────────
_AI_ROOT = Path(__file__).resolve().parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

# ── Load .env ─────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _env = _AI_ROOT / ".env"
    if _env.exists():
        load_dotenv(_env)
    else:
        _backend_env = _AI_ROOT.parent / "backend" / ".env"
        if _backend_env.exists():
            load_dotenv(_backend_env)
except ImportError:
    pass

# ── Launch ────────────────────────────────────────────────────────────────────
def _reuse_or_reject_existing_bridge(port: int) -> bool:
    """Avoid initializing another bridge when the configured port is busy."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            pass
    except OSError:
        return False

    try:
        with urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if response.status == 200 and payload.get("status") == "healthy":
                print(f"Pragati AI Bridge is already healthy on port {port}; reusing it.")
                return True
    except (OSError, URLError, ValueError) as exc:
        print(f"Port {port} is already occupied, but its owner is not a healthy Pragati AI Bridge.")
        print(f"No second bridge was started. Check the process using port {port}. ({exc})")
        raise SystemExit(1) from exc

    print(f"Port {port} is already occupied by another service; no second bridge was started.")
    raise SystemExit(1)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("PAC_BRIDGE_HOST", "0.0.0.0")
    port = int(os.getenv("PAC_BRIDGE_PORT", "8001"))

    if _reuse_or_reject_existing_bridge(port):
        raise SystemExit(0)

    print(f"\n{'='*60}")
    print(f"  Pragati AI Bridge — Starting on {host}:{port}")
    print(f"  AI Root: {_AI_ROOT}")
    print(f"{'='*60}\n")

    uvicorn.run(
        "pragati_ai_controller.fastapi_bridge:app",
        host=host,
        port=port,
        reload=False,
        log_level=os.getenv("PAC_LOG_LEVEL", "info").lower(),
        workers=1,
    )
