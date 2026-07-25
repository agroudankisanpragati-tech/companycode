"""Compatibility bootstrap for the Voice Guide AI package.

This ensures the nested voice_guide_ai package resolves its own
config/runtime modules instead of the top-level AI config.py module.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent
MODULE_ROOT = AI_ROOT / "voice_guide_ai"
MODULE_ROOT_STR = str(MODULE_ROOT)
CONFIG_ROOT = MODULE_ROOT / "config"

# Keep the voice_guide_ai package root ahead of the AI root so imports such as
# `from config.constants import ...` resolve to the package's own config module.
for entry in list(sys.path):
    if entry in {"", str(AI_ROOT)}:
        sys.path.remove(entry)

if MODULE_ROOT.exists() and MODULE_ROOT_STR not in sys.path:
    sys.path.insert(0, MODULE_ROOT_STR)

if CONFIG_ROOT.exists():
    spec = importlib.util.spec_from_file_location(
        "config",
        CONFIG_ROOT / "__init__.py",
        submodule_search_locations=[str(CONFIG_ROOT)],
    )
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        sys.modules["config"] = module
        spec.loader.exec_module(module)
