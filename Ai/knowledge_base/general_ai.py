# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/general_ai.py
# Purpose: General AI catch-all handler. Context-aware — uses session state
#          to provide relevant suggestions based on conversation history.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _lang, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "general_ai"

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


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "general")
    session_id = request.get("session_id", "")

    import logging as _logging
    _glog = _logging.getLogger("akp.kb.general_ai")
    _glog.warning(
        "GENERAL_AI_HANDLER called | session=%s | intent=%s | text='%s' "
        "— This should only happen for truly general queries.",
        session_id, intent, text[:80],
    )

    store          = get_session_store()
    active_disease = store.get(session_id, Slot.ACTIVE_DISEASE)
    active_crop    = store.get(session_id, Slot.ACTIVE_CROP)
    last_intent    = store.get(session_id, Slot.ACTIVE_INTENT)

    # Build context-aware message
    if lang == "hi":
        if active_disease:
            msg = (
                f"मैं आपकी सहायता के लिए यहाँ हूँ।\n"
                f"पिछली बातचीत में: {active_disease} रोग की जानकारी दी गई थी।\n"
                f"क्या आप उसके बारे में और जानना चाहते हैं?"
            )
            suggestions = [
                "जैविक उपचार देखें",
                "रासायनिक उपचार देखें",
                "रोकथाम के उपाय",
                "छवि अपलोड करें",
            ]
        elif active_crop:
            msg = (
                f"मैं आपकी सहायता के लिए यहाँ हूँ।\n"
                f"पिछली बातचीत में: {active_crop} फसल की जानकारी दी गई थी।\n"
                f"क्या आप उसके बारे में और जानना चाहते हैं?"
            )
            suggestions = [
                "उर्वरक सलाह",
                "सिंचाई जानकारी",
                "रोग पहचान",
                "मंडी भाव",
            ]
        elif text:
            msg = (
                f"मैं आपकी सहायता के लिए यहाँ हूँ।\n"
                f"आपने पूछा: \"{text[:100]}\"\n"
                "कृपया नीचे दिए विकल्पों में से चुनें या अधिक जानकारी दें।"
            )
            suggestions = _SUGGESTIONS_HI
        else:
            msg = "नमस्ते! मैं प्रगति AI हूँ। मैं आपकी खेती में सहायता कर सकता हूँ।"
            suggestions = _SUGGESTIONS_HI
    else:
        if active_disease:
            msg = (
                f"I'm here to help.\n"
                f"Previous context: Information about '{active_disease}' was provided.\n"
                "Would you like to know more about it?"
            )
            suggestions = [
                "View organic treatment",
                "View chemical treatment",
                "Prevention methods",
                "Upload leaf image",
            ]
        elif active_crop:
            msg = (
                f"I'm here to help.\n"
                f"Previous context: Information about '{active_crop}' crop was provided.\n"
                "Would you like to know more about it?"
            )
            suggestions = [
                "Fertilizer advice",
                "Irrigation info",
                "Disease detection",
                "Mandi prices",
            ]
        elif text:
            msg = (
                f"I'm here to help. You asked: \"{text[:100]}\"\n"
                "Please choose from the options below or provide more details."
            )
            suggestions = _SUGGESTIONS_EN
        else:
            msg = "Hello! I am Pragati AI. I can help you with farming queries."
            suggestions = _SUGGESTIONS_EN

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=False, session_id=session_id,
        text_snippet=text[:60],
        extra=f"active_disease={active_disease} active_crop={active_crop}",
    )

    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions)
