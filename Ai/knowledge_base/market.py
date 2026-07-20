# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/market.py
# Purpose: Market price module handler. Context-aware — uses active crop.
#          If no crop/district provided, asks a follow-up question.
# =============================================================================

from __future__ import annotations

import logging
import re
from typing import Any

from knowledge_base._base import _escape, _lang, _query_collection, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store
from knowledge_base.context_resolver import get_context_resolver

_MODULE_ID = "market"
_log = logging.getLogger("akp.kb.market")

# ---------------------------------------------------------------------------
# CROP KEYWORDS — extracted from user text
# ---------------------------------------------------------------------------

_CROP_KEYWORDS = [
    "gehu", "gehun", "wheat", "chawal", "rice", "dhan", "paddy",
    "sarson", "mustard", "soybean", "soya", "cotton", "kapas",
    "onion", "pyaz", "pyaaz", "tamatar", "tomato", "aloo", "potato",
    "chana", "gram", "moong", "urad", "arhar", "tur", "masoor",
    "makka", "maize", "corn", "ganna", "sugarcane", "bajra", "jowar",
    "til", "sesame", "sunflower", "surajmukhi", "groundnut", "moongfali",
    # Devanagari
    "\u0917\u0947\u0939\u0942\u0902", "\u091a\u093e\u0935\u0932", "\u0938\u0930\u0938\u094b\u0902", "\u0938\u094b\u092f\u093e\u092c\u0940\u0928", "\u0915\u092a\u093e\u0938",
    "\u092a\u094d\u092f\u093e\u091c", "\u091f\u092e\u093e\u091f\u0930", "\u0906\u0932\u0942", "\u091a\u0928\u093e", "\u092e\u0942\u0902\u0917", "\u0909\u0921\u093c\u0926",
    "\u092e\u0915\u094d\u0915\u093e", "\u0917\u0928\u094d\u0928\u093e", "\u092c\u093e\u091c\u0930\u093e", "\u091c\u094d\u0935\u093e\u0930",
]

_DISTRICT_KEYWORDS = [
    "jaipur", "jodhpur", "kota", "ajmer", "bikaner", "udaipur",
    "alwar", "bharatpur", "sikar", "nagaur", "barmer", "pali",
    "delhi", "mumbai", "pune", "nashik", "indore", "bhopal",
    "lucknow", "kanpur", "agra", "varanasi", "patna", "ranchi",
    "chandigarh", "ludhiana", "amritsar", "jalandhar",
    "hyderabad", "bangalore", "chennai", "kolkata", "ahmedabad",
    # Devanagari
    "\u091c\u092f\u092a\u0941\u0930", "\u091c\u094b\u0927\u092a\u0941\u0930", "\u0915\u094b\u091f\u093e", "\u0905\u091c\u092e\u0947\u0930", "\u092c\u0940\u0915\u093e\u0928\u0947\u0930",
    "\u0909\u0926\u092f\u092a\u0941\u0930", "\u0905\u0932\u0935\u0930", "\u0928\u093e\u0917\u094c\u0930", "\u0938\u0940\u0915\u0930",
]


def _extract_crop(text: str) -> str:
    """Extracts crop name from user text."""
    t = text.lower()
    for kw in _CROP_KEYWORDS:
        if kw.lower() in t:
            return kw
    return ""


def _extract_district(text: str) -> str:
    """Extracts district/location from user text."""
    t = text.lower()
    for kw in _DISTRICT_KEYWORDS:
        if kw.lower() in t:
            return kw
    return ""


def handle(request: dict[str, Any]) -> dict[str, Any]:
    lang       = _lang(request)
    text       = _text(request)
    intent     = request.get("intent", "market")
    session_id = request.get("session_id", "")
    location   = request.get("location", {})

    store    = get_session_store()
    resolver = get_context_resolver()

    # ── Debug log ─────────────────────────────────────────────────────
    _log.info(
        "MARKET_HANDLER | session=%s | raw_text='%s' | lang=%s | intent=%s",
        session_id, text, lang, intent,
    )

    enriched    = resolver.resolve(request, session_id)
    active_crop = enriched.get("active_crop", "")

    # ── Extract crop and district from text ───────────────────────────
    crop_from_text     = _extract_crop(text)
    district_from_text = _extract_district(text)

    # ── Resolve district from location context ────────────────────────
    district = district_from_text
    if not district and isinstance(location, dict):
        district = location.get("district") or location.get("state") or ""
    if not district:
        stored_loc = store.get(session_id, Slot.LOCATION)
        if isinstance(stored_loc, dict):
            district = stored_loc.get("district") or stored_loc.get("state") or ""

    # ── Resolve crop ──────────────────────────────────────────────────
    crop = crop_from_text or active_crop

    _log.info(
        "MARKET_HANDLER | crop='%s' | district='%s' | active_crop='%s'",
        crop, district, active_crop,
    )

    # ── If no crop specified, ask follow-up ───────────────────────────
    if not crop:
        if lang == "hi":
            msg = (
                "📊 मंडी भाव जानकारी\n"
                "किस फसल का मंडी भाव जानना चाहते हैं?\n\n"
                "उदाहरण: गेहूं, सरसों, चावल, चना, सोयाबीन"
            )
            if district:
                msg = f"📊 {district} मंडी भाव\n" + msg.split("\n", 1)[1]
            suggestions = [
                "गेहूं का भाव",
                "सरसों का भाव",
                "चावल का भाव",
                "चना का भाव",
                "सोयाबीन का भाव",
            ]
        else:
            msg = (
                "📊 Mandi Price Information\n"
                "Which crop price would you like to know?\n\n"
                "Example: Wheat, Mustard, Rice, Gram, Soybean"
            )
            if district:
                msg = f"📊 {district} Mandi Prices\n" + msg.split("\n", 1)[1]
            suggestions = [
                "Wheat price",
                "Mustard price",
                "Rice price",
                "Gram price",
                "Soybean price",
            ]

        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=False,
            mandi_used=True, session_id=session_id,
            text_snippet=text[:60], extra="asking_crop_followup",
        )
        return build_response(
            _MODULE_ID, intent, lang, msg,
            suggestions=suggestions,
            fallback_reason="asking_crop_followup",
        )

    # ── Search MongoDB for crop price ─────────────────────────────────
    search_text = crop
    docs = []

    # Try with district filter first
    if district:
        docs = _query_collection(
            "marketpricehistories",
            {
                "commodity": {"$regex": _escape(search_text[:50]), "$options": "i"},
                "$or": [
                    {"market":   {"$regex": _escape(district[:30]), "$options": "i"}},
                    {"state":    {"$regex": _escape(district[:30]), "$options": "i"}},
                    {"district": {"$regex": _escape(district[:30]), "$options": "i"}},
                ],
            },
            limit=5,
        )

    # Fallback: search by crop only
    if not docs:
        docs = _query_collection(
            "marketpricehistories",
            {"commodity": {"$regex": _escape(search_text[:50]), "$options": "i"}},
            limit=5,
        )

    _log.info(
        "MARKET_HANDLER | db_query crop='%s' district='%s' | docs_found=%d",
        search_text, district, len(docs),
    )

    if docs:
        d = docs[0]
        if lang == "hi":
            msg = (
                f"📊 मंडी भाव — {d.get('commodity', crop)}\n"
                f"🏪 मंडी: {d.get('market', '')} | 📍 राज्य: {d.get('state', '')}\n"
                f"💰 न्यूनतम: ₹{d.get('minPrice', '')} | "
                f"अधिकतम: ₹{d.get('maxPrice', '')} | "
                f"मॉडल: ₹{d.get('modalPrice', '')}"
            )
            date_val = d.get("date") or d.get("priceDate", "")
            if date_val:
                msg += f"\n📅 तारीख: {date_val}"
            suggestions = ["सभी मंडी भाव देखें", "अपनी फसल का भाव देखें", "मंडी पेज खोलें"]
        else:
            msg = (
                f"📊 Mandi Price — {d.get('commodity', crop)}\n"
                f"🏪 Market: {d.get('market', '')} | 📍 State: {d.get('state', '')}\n"
                f"💰 Min: ₹{d.get('minPrice', '')} | "
                f"Max: ₹{d.get('maxPrice', '')} | "
                f"Modal: ₹{d.get('modalPrice', '')}"
            )
            date_val = d.get("date") or d.get("priceDate", "")
            if date_val:
                msg += f"\n📅 Date: {date_val}"
            suggestions = ["View all mandi prices", "Check your crop price", "Open mandi page"]

        resolver.update_from_response(
            session_id=session_id, intent=intent, module_id=_MODULE_ID,
            response_data=docs, response_text=msg, language=lang,
        )
        log_routing(
            intent=intent, module=_MODULE_ID, kb_hit=True,
            kb_collection="marketpricehistories", mandi_used=True,
            session_id=session_id, text_snippet=text[:60],
        )
        return build_response(_MODULE_ID, intent, lang, msg, data=docs, suggestions=suggestions)

    # ── No data found — redirect to mandi page ────────────────────────
    if lang == "hi":
        msg = (
            f"📊 {crop} का मंडी भाव अभी उपलब्ध नहीं है।\n"
            "लाइव मंडी भाव के लिए मंडी पेज पर जाएं।"
        )
        suggestions = ["मंडी पेज खोलें", "दूसरी फसल का भाव देखें", "राज्य बताएं"]
    else:
        msg = (
            f"📊 Live price for {crop} is not available right now.\n"
            "Visit the mandi prices page for live market rates."
        )
        suggestions = ["Open mandi page", "Check another crop", "Provide state"]

    log_routing(
        intent=intent, module=_MODULE_ID, kb_hit=False,
        mandi_used=True, fallback_used=True, session_id=session_id,
        text_snippet=text[:60], extra=f"no_price_data crop={crop}",
    )
    return build_response(
        _MODULE_ID, intent, lang, msg,
        suggestions=suggestions,
        fallback_reason="no_price_data",
    )
