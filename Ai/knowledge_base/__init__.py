# =============================================================================
# AKP — Agroudan Kisan Pragati
# Package: knowledge_base
# Purpose: AI module handlers for the Knowledge Router.
#          Each module exposes a handle(request) function that accepts a
#          router request dict and returns a structured response dict.
# =============================================================================

from __future__ import annotations

__version__: str = "1.1.0"

# Convenience re-exports for external consumers
from knowledge_base.session_store import get_session_store, SessionStore, Slot
from knowledge_base.context_resolver import get_context_resolver, ContextResolver
from knowledge_base.ai_response_builder import get_response_builder, AIResponseBuilder
from knowledge_base.routing_logger import log_routing

__all__ = [
    "get_session_store",
    "SessionStore",
    "Slot",
    "get_context_resolver",
    "ContextResolver",
    "get_response_builder",
    "AIResponseBuilder",
    "log_routing",
]
