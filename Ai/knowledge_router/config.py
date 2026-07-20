# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/config.py
# Purpose: All paths, constants, and runtime configuration for the
#          Knowledge Router module. Every path is derived from this
#          file's location — no hardcoded absolute paths anywhere.
# =============================================================================

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# ROOT RESOLUTION
# KR_ROOT → Ai/knowledge_router/
# AI_ROOT → Ai/
# ---------------------------------------------------------------------------
KR_ROOT: Path = Path(__file__).parent.resolve()
AI_ROOT: Path = KR_ROOT.parent.resolve()

# ---------------------------------------------------------------------------
# INTENT → MODULE MAPPING
# Keys must match intent labels produced by intent_engine.predictor exactly.
# Values are the canonical module identifiers used throughout the router.
# ---------------------------------------------------------------------------
INTENT_MODULE_MAP: dict[str, str] = {
    "disease":    "disease_ai",
    "pest":       "disease_ai",   # pest queries route to disease_ai handler (shares knowledge base)
    "crop":       "crop_ai",
    "soil":       "soil_analysis",
    "weather":    "weather",
    "market":     "market",
    "government": "government_schemes",
    "fertilizer": "fertilizer",
    "irrigation": "irrigation",
    "seed":       "seed",
    "machinery":  "machinery",
    "general":    "general_ai",
    "greeting":   "greeting",
    "emergency":  "emergency",
    "unknown":    "general_ai",   # safety net: unknown always hits general_ai
}

# Ordered list of all supported module identifiers
SUPPORTED_MODULES: tuple[str, ...] = (
    "disease_ai",
    "crop_ai",
    "soil_analysis",
    "weather",
    "market",
    "government_schemes",
    "fertilizer",
    "irrigation",
    "seed",
    "machinery",
    "general_ai",
    "greeting",
    "emergency",
)

# ---------------------------------------------------------------------------
# ROUTING CONSTANTS
# ---------------------------------------------------------------------------
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.30
DEFAULT_FALLBACK_MODULE: str        = "general_ai"
ROUTER_VERSION: str                 = "1.0.0"

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
DEFAULT_LOG_LEVEL: str = "INFO"
LOG_MAX_BYTES: int     = 10 * 1024 * 1024   # 10 MB
LOG_BACKUP_COUNT: int  = 5

# ---------------------------------------------------------------------------
# CONFIGURATION DATACLASS
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class KnowledgeRouterConfig:
    """
    Immutable runtime configuration for the Knowledge Router.

    Usage:
        from knowledge_router.config import get_config
        cfg = get_config()
    """
    kr_root:    Path
    ai_root:    Path

    logs_dir:    Path
    outputs_dir: Path
    configs_dir: Path

    intent_module_map:    dict[str, str]
    supported_modules:    tuple[str, ...]
    fallback_module:      str
    confidence_threshold: float
    router_version:       str
    log_level:            str


# ---------------------------------------------------------------------------
# DIRECTORY BOOTSTRAP
# ---------------------------------------------------------------------------
def _ensure_dirs(cfg: KnowledgeRouterConfig) -> None:
    for directory in (cfg.logs_dir, cfg.outputs_dir, cfg.configs_dir):
        directory.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# CONFIG FACTORY
# ---------------------------------------------------------------------------
_instance: Optional[KnowledgeRouterConfig] = None


def get_config(force_rebuild: bool = False) -> KnowledgeRouterConfig:
    """
    Returns the singleton KnowledgeRouterConfig.
    Builds once on first call; cached for all subsequent calls.

    Args:
        force_rebuild: Rebuild from scratch (useful in tests).

    Returns:
        KnowledgeRouterConfig: Immutable runtime configuration object.
    """
    global _instance

    if _instance is not None and not force_rebuild:
        return _instance

    _instance = KnowledgeRouterConfig(
        kr_root    = KR_ROOT,
        ai_root    = AI_ROOT,
        logs_dir    = KR_ROOT / "logs",
        outputs_dir = KR_ROOT / "outputs",
        configs_dir = KR_ROOT / "configs",
        intent_module_map    = INTENT_MODULE_MAP,
        supported_modules    = SUPPORTED_MODULES,
        fallback_module      = os.getenv("KR_FALLBACK_MODULE", DEFAULT_FALLBACK_MODULE),
        confidence_threshold = float(
            os.getenv("KR_CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE_THRESHOLD)
        ),
        router_version = ROUTER_VERSION,
        log_level      = os.getenv("KR_LOG_LEVEL", DEFAULT_LOG_LEVEL),
    )

    _ensure_dirs(_instance)
    return _instance


# ---------------------------------------------------------------------------
# SELF-TEST
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    cfg = get_config()
    print("\n" + "=" * 60)
    print("  AKP Knowledge Router — Configuration Diagnostic")
    print("=" * 60)
    print(f"\n  KR Root      : {cfg.kr_root}")
    print(f"  AI Root      : {cfg.ai_root}")
    print(f"  Logs Dir     : {cfg.logs_dir}")
    print(f"  Outputs Dir  : {cfg.outputs_dir}")
    print(f"\n  Router Ver   : {cfg.router_version}")
    print(f"  Fallback     : {cfg.fallback_module}")
    print(f"  Threshold    : {cfg.confidence_threshold}")
    print(f"\n  Intent → Module Map ({len(cfg.intent_module_map)}):")
    for intent, module in cfg.intent_module_map.items():
        print(f"    {intent:<15} → {module}")
    print("\n" + "=" * 60 + "\n")
