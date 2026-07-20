# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/machinery.py
# Purpose: Machinery module handler. Routing audit log included.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _lang, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "machinery"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "machinery")
    session_id = request.get("session_id", "")

    store = get_session_store()
    store.set(session_id, Slot.ACTIVE_INTENT, "machinery")

    if lang == "hi":
        msg = (
            "🚜 कृषि यंत्र जानकारी\n"
            "कृषि यंत्रों की जानकारी के लिए:\n"
            "• KVK केंद्र से संपर्क करें\n"
            "• KVK पेज पर जाएं\n"
            "• सब्सिडी योजना के लिए आवेदन करें\n\n"
            "📞 KVK हेल्पलाइन: 1800-180-1551"
        )
        suggestions = ["KVK पेज खोलें", "यंत्र किराए पर लें", "सब्सिडी योजना"]
    else:
        msg = (
            "🚜 Farm Machinery Information\n"
            "For farm machinery:\n"
            "• Contact your KVK center\n"
            "• Visit the KVK page\n"
            "• Apply for subsidy scheme\n\n"
            "📞 KVK Helpline: 1800-180-1551"
        )
        suggestions = ["Open KVK page", "Rent machinery", "Subsidy scheme"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        session_id=session_id, text_snippet=text[:60],
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions)
