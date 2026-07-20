# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/irrigation.py
# Purpose: Irrigation module handler. Context-aware — uses active crop.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _escape, _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver

_MODULE_ID = "irrigation"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "irrigation")
    session_id = request.get("session_id", "")

    store    = get_session_store()
    resolver = get_context_resolver()

    enriched    = resolver.resolve(request, session_id)
    active_crop = enriched.get("active_crop", "")
    search_text = enriched.get("text", text) or active_crop or text

    docs = []
    if search_text:
        docs = _query_collection(
            "irrigationschedules",
            {"cropName": {"$regex": _escape(search_text[:50]), "$options": "i"}},
            limit=3,
        )

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"💧 सिंचाई — {d.get('cropName', '')}\n"
                f"🔧 विधि: {d.get('irrigationMethod', '')} | "
                f"⏱️ अंतराल: {d.get('intervalDays', '')} दिन\n"
                f"📏 मात्रा: {d.get('waterAmount', '')} | "
                f"🌱 अवस्था: {d.get('growthStage', '')}"
            )
            if d.get("notes"):
                msg += f"\n📋 नोट: {d.get('notes', '')[:150]}"
            suggestions = ["सिंचाई कैलेंडर", "ड्रिप सिंचाई", "नमी जांच करें"]
        else:
            msg = (
                f"💧 Irrigation — {d.get('cropName', '')}\n"
                f"🔧 Method: {d.get('irrigationMethod', '')} | "
                f"⏱️ Interval: {d.get('intervalDays', '')} days\n"
                f"📏 Amount: {d.get('waterAmount', '')} | "
                f"🌱 Stage: {d.get('growthStage', '')}"
            )
            if d.get("notes"):
                msg += f"\n📋 Note: {d.get('notes', '')[:150]}"
            suggestions = ["Irrigation calendar", "Drip irrigation", "Check soil moisture"]

        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="irrigationschedules", session_id=session_id,
            text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    if lang == "hi":
        msg = (
            "सिंचाई की जानकारी के लिए फसल का नाम और विकास अवस्था बताएं।"
            + (f"\n(सक्रिय फसल: {active_crop})" if active_crop else "")
        )
        suggestions = ["फसल का नाम बताएं", "मिट्टी नमी देखें", "सिंचाई पेज"]
    else:
        msg = (
            "Provide crop name and growth stage for irrigation guidance."
            + (f"\n(Active crop: {active_crop})" if active_crop else "")
        )
        suggestions = ["Provide crop name", "Check soil moisture", "Irrigation page"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_irrigation_data",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_irrigation_data")
