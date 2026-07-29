# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/disease_ai.py
# Purpose: Disease AI module handler for the Knowledge Router.
#          Queries Disease & Pest Management (diseasepestsolutions) ONLY.
#          DiseaseKnowledgeBase and PestKnowledgeBase are NOT used.
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

_MODULE_ID = "disease_ai"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "disease")
    session_id = request.get("session_id", "")
    confidence = float(request.get("confidence", 1.0))

    store    = get_session_store()
    resolver = get_context_resolver()
    builder  = get_response_builder()

    # ── Context resolution: enrich follow-up queries ──────────────────
    enriched         = resolver.resolve(request, session_id)
    resolved_text    = enriched.get("text", text)
    treatment_filter = enriched.get("treatment_filter", "")
    context_resolved = enriched.get("context_resolved", False)

    # ── Check for pending action (awaiting image) ─────────────────────
    pending = store.get(session_id, Slot.PENDING_ACTION)
    if pending == "awaiting_image" and not context_resolved:
        msg, suggestions = builder.build_pending_action_response(pending, lang)
        if msg:
            log_routing(
                intent=intent, module=_MODULE_ID, kb_hit=False,
                fallback_used=True, session_id=session_id,
                text_snippet=text[:60], extra="pending_action=awaiting_image",
            )
            return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                                  fallback_reason="awaiting_image")

    # ── Low confidence: ask for better input ─────────────────────────
    if confidence < 0.35 and not context_resolved:
        msg, suggestions = builder.build_low_confidence_response(lang, "disease")
        store.set(session_id, Slot.PENDING_ACTION, "awaiting_image")
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=False,
            fallback_used=True, session_id=session_id,
            text_snippet=text[:60], extra=f"low_confidence={confidence:.3f}",
        )
        return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                              fallback_reason="low_confidence")

    # ── KB Search: Disease & Pest Management (diseasepestsolutions) ONLY ───
    # DiseaseKnowledgeBase and PestKnowledgeBase are NOT queried.
    search_text = resolved_text or text
    docs = []
    collection_hit = ""

    if search_text:
        docs = _query_collection(
            "diseasepestsolutions",
            {"$and": [
                {"status": "published"},
                {"$or": [
                    {"diseasePestName": {"$regex": _escape(search_text[:60]), "$options": "i"}},
                    {"cropName":        {"$regex": _escape(search_text[:40]), "$options": "i"}},
                    {"description":     {"$regex": _escape(search_text[:40]), "$options": "i"}},
                    {"aliases":         {"$regex": _escape(search_text[:60]), "$options": "i"}},
                    {"tags":            {"$regex": _escape(search_text[:40]), "$options": "i"}},
                ]},
            ]},
            limit=3,
        )
        if docs:
            collection_hit = "diseasepestsolutions"

    # ── Build structured response ─────────────────────────────────────
    if docs:
        doc = docs[0]
        msg, suggestions = builder.build_disease_response(
            doc, lang, confidence, treatment_filter
        )

        # Update session context
        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        store.set(session_id, Slot.PENDING_ACTION, "")

        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection=collection_hit, session_id=session_id,
            text_snippet=text[:60],
            extra=f"context_resolved={context_resolved} filter={treatment_filter}",
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    # ── No KB record found ────────────────────────────────────────────
    # If we have active disease from context, suggest image upload
    active_disease = store.get(session_id, Slot.ACTIVE_DISEASE)
    if active_disease and not context_resolved:
        if lang == "hi":
            msg = (
                f"'{active_disease}' के बारे में विस्तृत जानकारी के लिए "
                "कृपया प्रभावित पत्ती की छवि अपलोड करें।"
            )
            suggestions = ["छवि अपलोड करें", "रोग का नाम बताएं", "KVK से संपर्क करें"]
        else:
            msg = (
                f"For detailed information about '{active_disease}', "
                "please upload an image of the affected leaf."
            )
            suggestions = ["Upload leaf image", "Provide disease name", "Contact KVK"]
    else:
        if lang == "hi":
            msg = (
                "इस रोग/कीट की जानकारी उपलब्ध नहीं है।\n"
                "बेहतर परिणाम के लिए:\n"
                "1. 📸 प्रभावित पत्ती की छवि अपलोड करें\n"
                "2. 🌾 फसल का नाम बताएं\n"
                "3. 🔍 रोग के लक्षण विस्तार से बताएं"
            )
            suggestions = ["छवि अपलोड करें", "रोग का नाम बताएं", "फसल का नाम बताएं"]
        else:
            msg = (
                "Disease/pest information not found.\n"
                "For better results:\n"
                "1. 📸 Upload an image of the affected leaf\n"
                "2. 🌾 Provide the crop name\n"
                "3. 🔍 Describe the symptoms in detail"
            )
            suggestions = ["Upload leaf image", "Provide disease name", "Provide crop name"]

        store.set(session_id, Slot.PENDING_ACTION, "awaiting_image")

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_kb_record",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_knowledge_record")
