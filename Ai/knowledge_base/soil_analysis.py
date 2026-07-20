# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/soil_analysis.py
# Purpose: Soil analysis module handler. Routing audit log included.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "soil_analysis"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "soil")
    session_id = request.get("session_id", "")
    farmer_id  = request.get("farmer_id", "")

    store = get_session_store()

    # Try to fetch farmer's soil report if farmer_id available
    docs   = []
    kb_hit = False
    if farmer_id:
        docs = _query_collection("soilreports", {"farmerId": farmer_id}, limit=1)
        if docs:
            kb_hit = True

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"🌍 मिट्टी रिपोर्ट\n"
                f"pH: {d.get('ph', 'N/A')} | "
                f"नाइट्रोजन: {d.get('nitrogen', 'N/A')} | "
                f"फास्फोरस: {d.get('phosphorus', 'N/A')} | "
                f"पोटाश: {d.get('potassium', 'N/A')}\n"
                f"मिट्टी प्रकार: {d.get('soilType', 'N/A')}\n"
                f"सिफारिश: {d.get('recommendation', '')[:200]}"
            )
            suggestions = ["उर्वरक सलाह", "फसल सिफारिश", "मिट्टी स्वास्थ्य स्कोर"]
        else:
            msg = (
                f"🌍 Soil Report\n"
                f"pH: {d.get('ph', 'N/A')} | "
                f"Nitrogen: {d.get('nitrogen', 'N/A')} | "
                f"Phosphorus: {d.get('phosphorus', 'N/A')} | "
                f"Potassium: {d.get('potassium', 'N/A')}\n"
                f"Soil Type: {d.get('soilType', 'N/A')}\n"
                f"Recommendation: {d.get('recommendation', '')[:200]}"
            )
            suggestions = ["Fertilizer advice", "Crop recommendation", "Soil health score"]

        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="soilreports", session_id=session_id,
            text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    if lang == "hi":
        msg = (
            "🌍 मिट्टी स्वास्थ्य जांच\n"
            "अपनी मिट्टी रिपोर्ट अपलोड करें या डैशबोर्ड पर जाएं।\n"
            "मिट्टी जांच से मिलेगा:\n"
            "• pH स्तर\n"
            "• पोषक तत्व स्तर (N, P, K)\n"
            "• उर्वरक सिफारिश\n"
            "• फसल सिफारिश"
        )
        suggestions = ["मिट्टी रिपोर्ट अपलोड करें", "मिट्टी स्वास्थ्य स्कोर देखें", "उर्वरक सलाह"]
    else:
        msg = (
            "🌍 Soil Health Analysis\n"
            "Upload your soil report or visit the dashboard.\n"
            "Soil testing provides:\n"
            "• pH level\n"
            "• Nutrient levels (N, P, K)\n"
            "• Fertilizer recommendation\n"
            "• Crop recommendation"
        )
        suggestions = ["Upload soil report", "View soil health score", "Fertilizer advice"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        fallback_used=True, session_id=session_id,
        text_snippet=text[:60],
    )
    return build_response(_MODULE_ID, intent, lang, msg, suggestions=suggestions)
