# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/emergency.py
# Purpose: Dedicated local emergency farming guidance handler.
#          Returns immediate actionable guidance for farming emergencies.
#          OpenAI is NEVER called for emergencies.
# =============================================================================

from __future__ import annotations

from typing import Any
from knowledge_base._base import _lang, _text, build_response
from knowledge_base.routing_logger import log_routing
from knowledge_base.session_store import Slot, get_session_store

_MODULE_ID = "emergency"

_EMERGENCY_GENERAL_HI = (
    "🚨 आपातकालीन कृषि सहायता\n\n"
    "तत्काल कदम:\n"
    "1. प्रभावित पौधों को अलग करें — रोग फैलने से रोकें\n"
    "2. KVK हेल्पलाइन पर कॉल करें: 1800-180-1551 (निःशुल्क)\n"
    "3. नजदीकी कृषि अधिकारी से संपर्क करें\n"
    "4. प्रभावित पत्तियों/फसल की फोटो लें\n"
    "5. सिंचाई तुरंत बंद करें यदि जड़ सड़न हो\n\n"
    "रोग पहचान के लिए ऊपर 'छवि अपलोड' करें।"
)

_EMERGENCY_GENERAL_EN = (
    "🚨 Emergency Farming Assistance\n\n"
    "Immediate steps:\n"
    "1. Isolate affected plants — prevent disease spread\n"
    "2. Call KVK Helpline: 1800-180-1551 (toll-free)\n"
    "3. Contact your nearest agriculture officer\n"
    "4. Take photos of affected leaves/crops\n"
    "5. Stop irrigation immediately if root rot is suspected\n\n"
    "Upload an image above for instant disease identification."
)

_EMERGENCY_PEST_HI = (
    "🚨 कीट आपातकाल\n\n"
    "तत्काल कदम:\n"
    "1. प्रभावित क्षेत्र को अलग करें\n"
    "2. नीम तेल (5 मिली/लीटर) का छिड़काव करें\n"
    "3. KVK हेल्पलाइन: 1800-180-1551\n"
    "4. रात में प्रकाश जाल लगाएं\n"
    "5. कीट की पहचान के लिए छवि अपलोड करें"
)

_EMERGENCY_PEST_EN = (
    "🚨 Pest Emergency\n\n"
    "Immediate steps:\n"
    "1. Isolate the affected area\n"
    "2. Spray neem oil (5 ml/litre)\n"
    "3. KVK Helpline: 1800-180-1551\n"
    "4. Set light traps at night\n"
    "5. Upload image for pest identification"
)

_EMERGENCY_FLOOD_HI = (
    "🚨 बाढ़/जलभराव आपातकाल\n\n"
    "तत्काल कदम:\n"
    "1. खेत से पानी निकालने की व्यवस्था करें\n"
    "2. जड़ों को हवा मिलने दें\n"
    "3. फसल बीमा क्लेम के लिए: 14447\n"
    "4. PM फसल बीमा योजना हेल्पलाइन: 1800-200-7710\n"
    "5. नुकसान की फोटो और वीडियो रखें"
)

_EMERGENCY_FLOOD_EN = (
    "🚨 Flood/Waterlogging Emergency\n\n"
    "Immediate steps:\n"
    "1. Arrange drainage from the field\n"
    "2. Allow roots to breathe\n"
    "3. Crop insurance claim: 14447\n"
    "4. PM Fasal Bima Yojana helpline: 1800-200-7710\n"
    "5. Keep photos and videos of damage"
)

_EMERGENCY_POISON_HI = (
    "🚨 कीटनाशक विषाक्तता आपातकाल\n\n"
    "तत्काल कदम:\n"
    "1. 🏥 तुरंत नजदीकी अस्पताल जाएं\n"
    "2. राष्ट्रीय विष नियंत्रण केंद्र: 1800-116-117\n"
    "3. एम्बुलेंस: 108\n"
    "4. कीटनाशक का डिब्बा/लेबल साथ ले जाएं\n"
    "5. खुली हवा में रहें"
)

_EMERGENCY_POISON_EN = (
    "🚨 Pesticide Poisoning Emergency\n\n"
    "Immediate steps:\n"
    "1. 🏥 Go to nearest hospital immediately\n"
    "2. National Poison Control: 1800-116-117\n"
    "3. Ambulance: 108\n"
    "4. Carry the pesticide container/label\n"
    "5. Stay in open air"
)

_PEST_KEYWORDS   = {"कीट", "pest", "insect", "locust", "टिड्डी", "aphid", "whitefly"}
_FLOOD_KEYWORDS  = {"बाढ़", "flood", "waterlog", "जलभराव", "drought", "सूखा"}
_POISON_KEYWORDS = {"poison", "विष", "toxic", "pesticide poisoning", "कीटनाशक विषाक्त"}


def _detect_emergency_type(text: str) -> str:
    text_lower = text.lower()
    if any(kw in text_lower for kw in _POISON_KEYWORDS):
        return "poison"
    if any(kw in text_lower for kw in _FLOOD_KEYWORDS):
        return "flood"
    if any(kw in text_lower for kw in _PEST_KEYWORDS):
        return "pest"
    return "general"


def handle(request: dict[str, Any]) -> dict[str, Any]:
    """
    Returns immediate local emergency farming guidance.
    OpenAI is NEVER called from this handler.
    """
    lang           = _lang(request)
    text           = _text(request)
    session_id     = request.get("session_id", "")
    emergency_type = _detect_emergency_type(text)

    # Clear any pending action — emergency takes priority
    store = get_session_store()
    store.set(session_id, Slot.PENDING_ACTION, "")
    store.set(session_id, Slot.ACTIVE_INTENT, "emergency")

    if lang == "hi":
        msg_map = {
            "poison":  _EMERGENCY_POISON_HI,
            "flood":   _EMERGENCY_FLOOD_HI,
            "pest":    _EMERGENCY_PEST_HI,
            "general": _EMERGENCY_GENERAL_HI,
        }
        suggestions = [
            "KVK हेल्पलाइन: 1800-180-1551",
            "रोग पहचान के लिए छवि अपलोड करें",
            "फसल बीमा क्लेम करें",
            "नजदीकी कृषि अधिकारी से मिलें",
        ]
    else:
        msg_map = {
            "poison":  _EMERGENCY_POISON_EN,
            "flood":   _EMERGENCY_FLOOD_EN,
            "pest":    _EMERGENCY_PEST_EN,
            "general": _EMERGENCY_GENERAL_EN,
        }
        suggestions = [
            "KVK Helpline: 1800-180-1551",
            "Upload image for disease detection",
            "File crop insurance claim",
            "Contact nearest agriculture officer",
        ]

    msg = msg_map.get(emergency_type, msg_map["general"])

    log_routing(
        intent="emergency", module=_MODULE_ID, kb_hit=False,
        fallback_used=False, session_id=session_id,
        text_snippet=text[:60], extra=f"emergency_type={emergency_type}",
    )

    return build_response(
        module_id   = _MODULE_ID,
        intent      = "emergency",
        language    = lang,
        message     = msg,
        data        = {"emergency_type": emergency_type},
        suggestions = suggestions,
    )
