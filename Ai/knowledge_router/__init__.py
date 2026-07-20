# =============================================================================
# AKP — Agroudan Kisan Pragati
# Package: knowledge_router
# =============================================================================

from __future__ import annotations

from knowledge_router.config import KnowledgeRouterConfig, get_config

def __getattr__(name: str):
    _lazy = {
        "KnowledgeRouter":    ("knowledge_router.router",             "KnowledgeRouter"),
        "get_router":         ("knowledge_router.router",             "get_router"),
        "route_intent":       ("knowledge_router.router",             "route_intent"),
        "DispatchRequest":    ("knowledge_router.request_dispatcher", "DispatchRequest"),
        "get_dispatcher":     ("knowledge_router.request_dispatcher", "get_dispatcher"),
        "ModuleManager":      ("knowledge_router.module_manager",     "ModuleManager"),
        "get_module_manager": ("knowledge_router.module_manager",     "get_module_manager"),
        "FallbackHandler":    ("knowledge_router.fallback_handler",   "FallbackHandler"),
        "get_fallback_handler":("knowledge_router.fallback_handler",  "get_fallback_handler"),
        "ResponseFormatter":  ("knowledge_router.response_formatter", "ResponseFormatter"),
        "get_formatter":      ("knowledge_router.response_formatter", "get_formatter"),
    }
    if name in _lazy:
        import importlib
        mod_name, attr = _lazy[name]
        module = importlib.import_module(mod_name)
        value  = getattr(module, attr)
        globals()[name] = value
        return value
    raise AttributeError(f"module 'knowledge_router' has no attribute {name!r}")

__all__ = [
    "KnowledgeRouterConfig", "get_config",
    "KnowledgeRouter", "get_router", "route_intent",
    "DispatchRequest", "get_dispatcher",
    "ModuleManager", "get_module_manager",
    "FallbackHandler", "get_fallback_handler",
    "ResponseFormatter", "get_formatter",
]
