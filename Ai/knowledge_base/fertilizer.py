# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/fertilizer.py
# Purpose: Fertilizer module handler. Context-aware — uses active crop.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _escape, _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver

_MODULE_ID = "fertilizer"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "fertilizer")
    session_id = request.get("session_id", "")

    store    = get_session_store()
    resolver = get_context_resolver()

    enriched    = resolver.resolve(request, session_id)
    active_crop = enriched.get("active_crop", "")
    search_text = enriched.get("text", text) or active_crop or text

    docs = []
    if search_text:
        docs = _query_collection(
            "fertilizerproducts",
            {"$or": [
                {"name":         {"$regex": _escape(search_text[:60]), "$options": "i"}},
                {"cropSuitable": {"$regex": _escape(search_text[:40]), "$options": "i"}},
                {"nutrientType": {"$regex": _escape(search_text[:30]), "$options": "i"}},
            ]},
            limit=3,
        )

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"🌿 उर्वरक: {d.get('name', '')}\n"
                f"🔬 पोषक तत्व: {d.get('nutrientType', '')} | NPK: {d.get('npkRatio', '')}\n"
                f"🌾 उपयुक्त फसल: {d.get('cropSuitable', '')}\n"
                f"📏 मात्रा: {d.get('recommendedDose', '')}"
            )
            if d.get("applicationMethod"):
                msg += f"\n📋 विधि: {d.get('applicationMethod', '')}"
            suggestions = ["उर्वरक कैलकुलेटर", "जैविक विकल्प", "मिट्टी जांच करें"]
        else:
            msg = (
                f"🌿 Fertilizer: {d.get('name', '')}\n"
                f"🔬 Nutrient: {d.get('nutrientType', '')} | NPK: {d.get('npkRatio', '')}\n"
                f"🌾 Suitable crops: {d.get('cropSuitable', '')}\n"
                f"📏 Dose: {d.get('recommendedDose', '')}"
            )
            if d.get("applicationMethod"):
                msg += f"\n📋 Method: {d.get('applicationMethod', '')}"
            suggestions = ["Fertilizer calculator", "Organic alternatives", "Check soil health"]

        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="fertilizerproducts", session_id=session_id,
            text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    if lang == "hi":
        msg = (
            "उर्वरक की जानकारी के लिए फसल का नाम और मिट्टी का प्रकार बताएं।"
            + (f"\n(सक्रिय फसल: {active_crop})" if active_crop else "")
        )
        suggestions = ["फसल का नाम बताएं", "मिट्टी जांच करें", "जैविक खेती"]
    else:
        msg = (
            "Provide crop name and soil type for fertilizer recommendations."
            + (f"\n(Active crop: {active_crop})" if active_crop else "")
        )
        suggestions = ["Provide crop name", "Check soil health", "Organic farming"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_fertilizer_data",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_fertilizer_data")
