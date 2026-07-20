# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/greeting.py
# Purpose: Dedicated local greeting handler.
#          Returns instant static responses for greetings.
#          OpenAI is NEVER called for greetings.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _lang, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "greeting"

_GREETINGS_HI = [
    "नमस्ते! मैं प्रगति AI हूँ — आपका कृषि सहायक।",
    "राम राम! मैं आपकी खेती में कैसे सहायता कर सकता हूँ?",
    "नमस्कार! आज मैं आपकी क्या सहायता कर सकता हूँ?",
]

_GREETINGS_EN = [
    "Namaste! I am Pragati AI — your farming assistant.",
    "Hello! How can I help you with your farming today?",
    "Good morning! I am here to assist you with all your farming needs.",
]

_SUGGESTIONS_HI = [
    "रोग पहचान के लिए छवि अपलोड करें",
    "फसल सिफारिश लें",
    "मंडी भाव देखें",
    "मौसम जानकारी",
    "सरकारी योजनाएं",
]

_SUGGESTIONS_EN = [
    "Upload image for disease detection",
    "Get crop recommendation",
    "Check mandi prices",
    "Weather information",
    "Government schemes",
]

_GREETING_MAP: dict[str, int] = {
    "namaste":       0,
    "नमस्ते":        0,
    "नमस्कार":       2,
    "ram ram":       1,
    "राम राम":       1,
    "jai shree ram": 1,
    "hello":         1,
    "hi":            1,
    "hey":           1,
    "good morning":  2,
    "good afternoon":2,
    "good evening":  2,
    "सुप्रभात":      2,
    "शुभ प्रभात":    2,
}


def handle(request: dict[str, Any]) -> dict[str, Any]:
    """
    Returns an instant local greeting response.
    OpenAI is NEVER called from this handler.
    """
    lang       = _lang(request)
    text       = _text(request).lower()
    session_id = request.get("session_id", "")

    # Initialize session language
    store = get_session_store()
    store.set(session_id, Slot.LANGUAGE, lang)
    store.set(session_id, Slot.ACTIVE_INTENT, "greeting")

    idx = 0
    for keyword, variant_idx in _GREETING_MAP.items():
        if keyword in text:
            idx = variant_idx
            break

    if lang == "hi":
        msg         = _GREETINGS_HI[idx]
        suggestions = _SUGGESTIONS_HI
    else:
        msg         = _GREETINGS_EN[idx]
        suggestions = _SUGGESTIONS_EN

    log_routing(
        intent="greeting", module=_MODULE_ID, kb_hit=False,
        fallback_used=False, session_id=session_id,
        text_snippet=text[:60],
    )

    return build_response(
        module_id   = _MODULE_ID,
        intent      = "greeting",
        language    = lang,
        message     = msg,
        suggestions = suggestions,
    )
