# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: Ai/start_yolo.py
# Purpose: Production startup script for the YOLO FastAPI inference server.
#
# Usage:
#   cd Ai
#   python start_yolo.py
# =============================================================================

from __future__ import annotations

import os
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

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

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("YOLO_HOST", "0.0.0.0")
    port = int(os.getenv("YOLO_PORT", "8000"))

    print(f"\n{'='*60}")
    print(f"  AKP YOLO Inference Server — Starting on {host}:{port}")
    print(f"  AI Root: {_AI_ROOT}")
    print(f"{'='*60}\n")

    uvicorn.run(
        "fastapi_server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
        workers=1,
    )
