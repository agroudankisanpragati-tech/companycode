# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/crop_ai.py
# Purpose: Crop AI module handler for the Knowledge Router.
#          Queries CropKnowledgeBase. Context-aware. Structured responses.
# =============================================================================

from __future__ import annotations

from typing import Any

from knowledge_base._base import (
    _escape, _lang, _query_collection, _text, build_response,
)
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver
from knowledge_base.ai_response_builder import get_response_builder

_MODULE_ID = "crop_ai"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "crop")
    session_id = request.get("session_id", "")

    store    = get_session_store()
    resolver = get_context_resolver()
    builder  = get_response_builder()

    # ── Context resolution ────────────────────────────────────────────
    enriched      = resolver.resolve(request, session_id)
    resolved_text = enriched.get("text", text)
    active_crop   = enriched.get("active_crop", "")

    # Use active crop from context if text is a follow-up
    search_text = resolved_text or active_crop or text

    # ── KB Search ─────────────────────────────────────────────────────
    docs = []
    if search_text:
        docs = _query_collection(
            "cropknowledgebases",
            {"$or": [
                {"cropName":    {"$regex": _escape(search_text[:60]), "$options": "i"}},
                {"description": {"$regex": _escape(search_text[:40]), "$options": "i"}},
            ]},
            limit=3,
        )

    if docs:
        doc = docs[0]
        msg, suggestions = builder.build_crop_response(doc, lang)

        # Fallback to basic format if builder returns empty
        if not msg:
            if lang == "hi":
                msg = (
                    f"🌾 फसल: {doc.get('cropName', '')}\n"
                    f"{doc.get('description', '')[:250]}\n"
                    f"📅 मौसम: {doc.get('season', '')} | 🌍 मिट्टी: {doc.get('soilType', '')}"
                )
                suggestions = ["बुवाई का समय", "उर्वरक सलाह", "सिंचाई जानकारी", "रोग पहचान"]
            else:
                msg = (
                    f"🌾 Crop: {doc.get('cropName', '')}\n"
                    f"{doc.get('description', '')[:250]}\n"
                    f"📅 Season: {doc.get('season', '')} | 🌍 Soil: {doc.get('soilType', '')}"
                )
                suggestions = ["Sowing time", "Fertilizer advice", "Irrigation info", "Disease detection"]

        # Update session context
        crop_name = doc.get("cropName", "")
        if crop_name:
            store.set(session_id, Slot.ACTIVE_CROP, crop_name)
        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )

        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="cropknowledgebases", session_id=session_id,
            text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    # ── No record found ───────────────────────────────────────────────
    if lang == "hi":
        msg = (
            "इस फसल की जानकारी उपलब्ध नहीं है।\n"
            "कृपया फसल का सही नाम बताएं।\n"
            "उदाहरण: गेहूं, धान, मक्का, टमाटर, मूंग"
        )
        suggestions = ["फसल सिफारिश लें", "मिट्टी जांच करें", "मौसम देखें"]
    else:
        msg = (
            "Crop information not found.\n"
            "Please provide the correct crop name.\n"
            "Example: Wheat, Rice, Maize, Tomato, Moong"
        )
        suggestions = ["Get crop recommendation", "Check soil health", "View weather"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_crop_record",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_crop_record")
