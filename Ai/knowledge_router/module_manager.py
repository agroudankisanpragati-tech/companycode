# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_router/module_manager.py
# Purpose: Auto-discovers and registers all AI modules for the Knowledge
#          Router. Continues gracefully if any individual module fails to
#          load. Provides a unified handle() interface per module.
# =============================================================================

from __future__ import annotations

import importlib
import logging
import sys
from dataclasses import dataclass, field
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Callable, Optional

from knowledge_router.config import KnowledgeRouterConfig, get_config

# ---------------------------------------------------------------------------
# LOGGER
# ---------------------------------------------------------------------------

def _build_logger(cfg: KnowledgeRouterConfig) -> logging.Logger:
    logger = logging.getLogger("akp.router.module_manager")
    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, cfg.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    import io
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    log_file = cfg.logs_dir / "module_manager.log"
    fh = RotatingFileHandler(
        filename=log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    logger.propagate = False
    return logger


# ---------------------------------------------------------------------------
# MODULE DESCRIPTOR
# ---------------------------------------------------------------------------

@dataclass
class ModuleDescriptor:
    """
    Describes a registered AI module.

    Attributes:
        module_id:   Canonical identifier (e.g. "disease_ai").
        is_loaded:   True if the module loaded without errors.
        handler:     Callable that processes a request dict and returns a dict.
        error:       Load error message if is_loaded is False.
        module_path: Python import path attempted during auto-load.
    """
    module_id:   str
    is_loaded:   bool
    handler:     Optional[Callable[[dict[str, Any]], dict[str, Any]]]
    error:       str = ""
    module_path: str = ""


# ---------------------------------------------------------------------------
# STUB HANDLER FACTORY
# ---------------------------------------------------------------------------

def _make_stub_handler(module_id: str, error: str) -> Callable[[dict[str, Any]], dict[str, Any]]:
    """Returns a stub handler for modules that failed to load."""
    def _stub(request: dict[str, Any]) -> dict[str, Any]:
        return {
            "status":    "module_unavailable",
            "module_id": module_id,
            "error":     error,
            "data":      None,
        }
    return _stub


# ---------------------------------------------------------------------------
# MODULE IMPORT CANDIDATES
# Each entry: (module_id, python_import_path, handler_attr)
# The router tries each import path in order and uses the first that succeeds.
# ---------------------------------------------------------------------------

_MODULE_CANDIDATES: list[tuple[str, str, str]] = [
    ("disease_ai",        "knowledge_base.disease_ai",        "handle"),
    ("crop_ai",           "knowledge_base.crop_ai",           "handle"),
    ("soil_analysis",     "knowledge_base.soil_analysis",     "handle"),
    ("weather",           "knowledge_base.weather",           "handle"),
    ("market",            "knowledge_base.market",            "handle"),
    ("government_schemes","knowledge_base.government_schemes","handle"),
    ("fertilizer",        "knowledge_base.fertilizer",        "handle"),
    ("irrigation",        "knowledge_base.irrigation",        "handle"),
    ("seed",              "knowledge_base.seed",              "handle"),
    ("machinery",         "knowledge_base.machinery",         "handle"),
    ("general_ai",        "knowledge_base.general_ai",        "handle"),
    ("greeting",          "knowledge_base.greeting",          "handle"),  # Local greeting handler
    ("emergency",         "knowledge_base.emergency",         "handle"),  # Local emergency handler
]


# ---------------------------------------------------------------------------
# MODULE MANAGER
# ---------------------------------------------------------------------------

class ModuleManager:
    """
    Auto-loads and manages all AI knowledge modules.

    - Attempts to import each module from the knowledge_base package.
    - Registers a stub handler for any module that fails to load.
    - Continues without raising even if all modules fail.
    - Provides a unified dispatch interface via get_handler().

    Usage:
        manager = ModuleManager()
        manager.load_all()
        handler = manager.get_handler("disease_ai")
        result  = handler(request_dict)
    """

    def __init__(self, cfg: Optional[KnowledgeRouterConfig] = None) -> None:
        self._cfg     = cfg or get_config()
        self._log     = _build_logger(self._cfg)
        self._modules: dict[str, ModuleDescriptor] = {}
        self._loaded  = False

    # ------------------------------------------------------------------
    # LOAD ALL MODULES
    # ------------------------------------------------------------------

    def load_all(self) -> "ModuleManager":
        """
        Attempts to import every registered module.
        Failed imports are logged and replaced with stub handlers.

        Returns:
            self — for chaining: manager = ModuleManager().load_all()
        """
        if self._loaded:
            return self

        # Ensure Ai/ is on sys.path so knowledge_base imports resolve
        ai_root_str = str(self._cfg.ai_root)
        if ai_root_str not in sys.path:
            sys.path.insert(0, ai_root_str)

        for module_id, import_path, handler_attr in _MODULE_CANDIDATES:
            descriptor = self._try_load(module_id, import_path, handler_attr)
            self._modules[module_id] = descriptor

        loaded_count = sum(1 for d in self._modules.values() if d.is_loaded)
        failed_count = len(self._modules) - loaded_count

        self._log.info(
            "Module loading complete — loaded=%d  failed=%d  total=%d",
            loaded_count, failed_count, len(self._modules),
        )
        self._loaded = True
        return self

    def _try_load(
        self,
        module_id:    str,
        import_path:  str,
        handler_attr: str,
    ) -> ModuleDescriptor:
        try:
            mod     = importlib.import_module(import_path)
            handler = getattr(mod, handler_attr, None)

            if handler is None or not callable(handler):
                raise AttributeError(
                    f"Module '{import_path}' has no callable attribute '{handler_attr}'"
                )

            self._log.info("Loaded module %-20s <- %s", module_id, import_path)
            return ModuleDescriptor(
                module_id   = module_id,
                is_loaded   = True,
                handler     = handler,
                module_path = import_path,
            )

        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            self._log.warning(
                "Module %-20s FAILED to load (%s) — stub registered",
                module_id, error_msg,
            )
            return ModuleDescriptor(
                module_id   = module_id,
                is_loaded   = False,
                handler     = _make_stub_handler(module_id, error_msg),
                error       = error_msg,
                module_path = import_path,
            )

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def get_handler(self, module_id: str) -> Callable[[dict[str, Any]], dict[str, Any]]:
        """
        Returns the handler callable for the given module_id.
        Falls back to the general_ai stub if module_id is unknown.

        Args:
            module_id: Canonical module identifier.

        Returns:
            Callable that accepts a request dict and returns a result dict.
        """
        self._ensure_loaded()
        descriptor = self._modules.get(module_id)
        if descriptor is None:
            self._log.warning("Unknown module_id '%s' — using fallback", module_id)
            descriptor = self._modules.get(self._cfg.fallback_module)

        if descriptor is None or descriptor.handler is None:
            return _make_stub_handler(module_id, "module_not_registered")

        return descriptor.handler

    def get_descriptor(self, module_id: str) -> Optional[ModuleDescriptor]:
        """Returns the ModuleDescriptor for a given module_id, or None."""
        self._ensure_loaded()
        return self._modules.get(module_id)

    def list_modules(self) -> list[dict[str, Any]]:
        """Returns a summary list of all registered modules and their status."""
        self._ensure_loaded()
        return [
            {
                "module_id":   d.module_id,
                "is_loaded":   d.is_loaded,
                "module_path": d.module_path,
                "error":       d.error,
            }
            for d in self._modules.values()
        ]

    def is_module_loaded(self, module_id: str) -> bool:
        """Returns True if the module loaded successfully."""
        self._ensure_loaded()
        descriptor = self._modules.get(module_id)
        return descriptor is not None and descriptor.is_loaded

    # ------------------------------------------------------------------
    # INTERNAL
    # ------------------------------------------------------------------

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load_all()


# ---------------------------------------------------------------------------
# MODULE-LEVEL SINGLETON
# ---------------------------------------------------------------------------

_manager_instance: Optional[ModuleManager] = None


def get_module_manager(force_rebuild: bool = False) -> ModuleManager:
    """
    Returns the singleton ModuleManager, loading all modules on first call.

    Args:
        force_rebuild: Create a fresh instance (useful in tests).

    Returns:
        ModuleManager: Ready-to-use, all modules attempted.
    """
    global _manager_instance
    if _manager_instance is None or force_rebuild:
        _manager_instance = ModuleManager()
        _manager_instance.load_all()
    return _manager_instance
