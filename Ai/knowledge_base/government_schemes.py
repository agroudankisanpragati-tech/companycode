# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/government_schemes.py
# Purpose: Government schemes module handler. Routing audit log included.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _escape, _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver

_MODULE_ID = "government_schemes"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "government")
    session_id = request.get("session_id", "")

    store    = get_session_store()
    resolver = get_context_resolver()

    enriched    = resolver.resolve(request, session_id)
    search_text = enriched.get("text", text) or text

    docs = []
    if search_text:
        docs = _query_collection(
            "govtschemes",
            {"$or": [
                {"title":       {"$regex": _escape(search_text[:60]), "$options": "i"}},
                {"description": {"$regex": _escape(search_text[:40]), "$options": "i"}},
                {"category":    {"$regex": _escape(search_text[:30]), "$options": "i"}},
            ]},
            limit=3,
        )

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"📋 योजना: {d.get('title', '')}\n"
                f"{d.get('description', '')[:250]}\n"
                f"🏷️ श्रेणी: {d.get('category', '')} | "
                f"💰 लाभ: {d.get('benefits', '')[:150]}"
            )
            if d.get("eligibility"):
                msg += f"\n✅ पात्रता: {d.get('eligibility', '')[:150]}"
            if d.get("applicationLink") or d.get("applyUrl"):
                msg += f"\n🔗 आवेदन: {d.get('applicationLink') or d.get('applyUrl', '')}"
            suggestions = ["पात्रता जांचें", "आवेदन करें", "सभी योजनाएं देखें"]
        else:
            msg = (
                f"📋 Scheme: {d.get('title', '')}\n"
                f"{d.get('description', '')[:250]}\n"
                f"🏷️ Category: {d.get('category', '')} | "
                f"💰 Benefits: {d.get('benefits', '')[:150]}"
            )
            if d.get("eligibility"):
                msg += f"\n✅ Eligibility: {d.get('eligibility', '')[:150]}"
            if d.get("applicationLink") or d.get("applyUrl"):
                msg += f"\n🔗 Apply: {d.get('applicationLink') or d.get('applyUrl', '')}"
            suggestions = ["Check eligibility", "Apply now", "View all schemes"]

        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="govtschemes", government_used=True,
            session_id=session_id, text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    if lang == "hi":
        msg = "सरकारी योजनाओं की जानकारी के लिए योजना पेज पर जाएं।"
        suggestions = ["योजना पेज खोलें", "PM-KISAN", "KCC योजना", "PMFBY"]
    else:
        msg = "Visit the schemes page for government agriculture schemes."
        suggestions = ["Open schemes page", "PM-KISAN", "KCC scheme", "PMFBY"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        government_used=True, fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra="no_scheme_found",
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions,
                          fallback_reason="no_scheme_found")
