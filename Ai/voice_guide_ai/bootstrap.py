"""Voice Guide AI bootstrap helpers."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def install_voice_guide_imports() -> None:
    """Register the Voice Guide AI package namespace for imports."""
    ai_root = Path(__file__).resolve().parent.parent
    module_root = ai_root / "voice_guide_ai"
    config_root = module_root / "config"

    if str(module_root) not in sys.path:
        sys.path.insert(0, str(module_root))

    if config_root.exists():
        spec = importlib.util.spec_from_file_location(
            "config",
            config_root / "__init__.py",
            submodule_search_locations=[str(config_root)],
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules["config"] = module
            spec.loader.exec_module(module)


install_voice_guide_imports()
