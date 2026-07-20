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
import sys
from pathlib import Path

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
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("PAC_BRIDGE_HOST", "0.0.0.0")
    port = int(os.getenv("PAC_BRIDGE_PORT", "8001"))

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
