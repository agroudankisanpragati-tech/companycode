"""
Voice Guide AI — Production Health Check Endpoint.

Lightweight health check that can be called by:
  - Docker HEALTHCHECK
  - Kubernetes liveness/readiness probes
  - Load balancer health checks
  - CI/CD pipelines

Returns exit code 0 on healthy, 1 on unhealthy.

Run:
    python voice_guide_ai/healthcheck.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))


def check() -> dict:
    checks: dict = {}
    healthy = True

    # 1. Config files
    try:
        from config.paths import PATHS
        from config.settings import SETTINGS
        checks["config"] = "ok"
        checks["language"] = SETTINGS.default_language
    except Exception as exc:
        checks["config"] = f"FAIL: {exc}"
        healthy = False

    # 2. Dialogues directory
    try:
        from config.paths import PATHS as _PATHS
        dialogue_count = sum(1 for _ in _PATHS.dialogues.rglob("*.json"))
        checks["dialogues"] = f"ok ({dialogue_count} files)"
        if dialogue_count == 0:
            checks["dialogues"] = "WARNING: no dialogue files found"
    except Exception as exc:
        checks["dialogues"] = f"FAIL: {exc}"
        healthy = False

    # 3. Translations directory
    try:
        from config.paths import PATHS as _PATHS
        translation_count = sum(1 for _ in _PATHS.translations.rglob("*.json"))
        checks["translations"] = f"ok ({translation_count} files)"
        if translation_count == 0:
            checks["translations"] = "WARNING: no translation files found"
    except Exception as exc:
        checks["translations"] = f"FAIL: {exc}"
        healthy = False

    # 4. Runtime instantiation
    try:
        from runtime.runtime_manager import RuntimeManager
        rm = RuntimeManager()
        rm.start()
        status = rm.get_status()
        rm.stop()
        checks["runtime"] = "ok"
    except Exception as exc:
        checks["runtime"] = f"FAIL: {exc}"
        healthy = False

    # 5. Cache manager
    try:
        from utils.cache_manager import CacheManager
        cache = CacheManager()
        cache.set("_health", True)
        assert cache.get("_health") is True
        cache.delete("_health")
        checks["cache"] = "ok"
    except Exception as exc:
        checks["cache"] = f"FAIL: {exc}"
        healthy = False

    # 6. JSON manager
    try:
        from utils.json_manager import JSONManager
        from config.paths import PATHS
        jm = JSONManager()
        # Try loading one dialogue
        for json_file in PATHS.dialogues.rglob("*.json"):
            data = jm.read_safe(json_file)
            if data:
                checks["json_manager"] = "ok"
                break
        else:
            checks["json_manager"] = "WARNING: no dialogues to test"
    except Exception as exc:
        checks["json_manager"] = f"FAIL: {exc}"
        healthy = False

    return {
        "healthy": healthy,
        "service": "voice-guide-ai",
        "version": "1.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "checks": checks,
    }


if __name__ == "__main__":
    result = check()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["healthy"] else 1)
