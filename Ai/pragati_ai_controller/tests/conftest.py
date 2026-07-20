# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: pragati_ai_controller/tests/conftest.py
# Purpose: pytest configuration — bootstraps sys.path so all AI modules
#          are importable from any test file without manual path manipulation.
# =============================================================================

from __future__ import annotations

import sys
from pathlib import Path

# Ai/ root — parent of pragati_ai_controller/
_AI_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

# pragati_ai_controller/ itself
_PAC_ROOT = Path(__file__).resolve().parent.parent
if str(_PAC_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(_PAC_ROOT.parent))
