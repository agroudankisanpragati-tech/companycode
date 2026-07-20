# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/seed.py
# Purpose: Seed module handler. Context-aware — uses active crop.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _escape, _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver

_MODULE_ID = "seed"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "seed")
    session_id = request.get("session_id", "")

    store    = get_session_store()
    resolver = get_context_resolver()

    enriched    = resolver.resolve(request, session_id)
    active_crop = enriched.get("active_crop", "")
    search_text = enriched.get("text", text) or active_crop or text

    docs = []
    if search_text:
        docs = _query_collection(
            "nurseryproducts",
            {"$or": [
                {"name":     {"$regex": _escape(search_text[:60]), "$options": "i"}},
                {"cropType": {"$regex": _escape(search_text[:40]), "$options": "i"}},
            ]},
            limit=3,
        )

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"🌱 बीज: {d.get('name', '')}\n"
                f"🌾 फसल: {d.get('cropType', '')} | 🔬 किस्म: {d.get('variety', '')}\n"
                f"💰 मूल्य: ₹{d.get('price', '')} | "
                f"📦 उपलब्धता: {d.get('availability', '')}"
            )
            if d.get("sowingTime"):
                msg += f"\n📅 बुवाई का समय: {d.get('sowingTime', '')}"
            if d.get("yieldPerAcre"):
                msg += f"\n📊 उत्पादन: {d.get('yieldPerAcre', '')} प्रति एकड़"
            suggestions = ["बीज खरीदें", "बुवाई का समय", "बीज उपचार"]
        else:
            msg = (
                f"🌱 Seed: {d.get('name', '')}\n"
                f"🌾 Crop: {d.get('cropType', '')} | 🔬 Variety: {d.get('variety', '')}\n"
                f"💰 Price: ₹{d.get('price', '')} | "
                f"📦 Availability: {d.get('availability', '')}"
            )
            if d.get("sowingTime"):
                msg += f"\n📅 Sowing time: {d.get('sowingTime', '')}"
            if d.get("yieldPerAcre"):
                msg += f"\n📊 Yield: {d.get('yieldPerAcre', '')} per acre"
            suggestions = ["Buy seeds", "Sowing time", "Seed treatment"]

        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="nurseryproducts", session_id=session_id,
            text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    if lang == "hi":
        msg = (
            "बीज की जानकारी के लिए फसल का नाम बताएं।"
            + (f"\n(सक्रिय फसल: {active_crop})" if active_crop else "")
        )
        suggestions = ["फसल का नाम बताएं", "नर्सरी पेज", "बीज उपचार"]
    else:
        msg = (
            "Provide crop name for seed information."
            + (f"\n(Active crop: {active_crop})" if active_crop else "")
        )
        suggestions = ["Provide crop name", "Nursery page", "Seed treatment"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_seed_data",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_seed_data")
