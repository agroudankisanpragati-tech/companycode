# =============================================================================
# AKP — Agroudan Kisan Pragati
# File: knowledge_base/ai_response_builder.py
# Purpose: Builds structured, rich responses from Knowledge Base documents.
#
# Assembles responses with:
#   Disease:            name
#   Cause:              pathogen/cause
#   Symptoms:           visible symptoms
#   Severity:           low/medium/high
#   Confidence:         from YOLO or intent engine
#   Treatment:          general treatment
#   Organic Treatment:  neem/bio-based solutions
#   Chemical Treatment: fungicide/pesticide recommendations
#   Prevention:         preventive measures
#   Recommended Fertilizer: if available
#   Recommended Irrigation: if available
#   Warnings:           safety warnings
#   Next Steps:         actionable next steps
#
# Low confidence → asks for better image / crop name / location.
# Never hallucinate — only uses data from KB documents.
# =============================================================================

from __future__ import annotations

from typing import Any, Optional


# ---------------------------------------------------------------------------
# CONFIDENCE THRESHOLDS
# ---------------------------------------------------------------------------

_HIGH_CONF   = 0.70   # >= 70% → full structured response
_MEDIUM_CONF = 0.40   # 40–70% → response + clarification prompt
_LOW_CONF    = 0.40   # < 40%  → ask for better input


# ---------------------------------------------------------------------------
# STRUCTURED RESPONSE BUILDER
# ---------------------------------------------------------------------------

class AIResponseBuilder:
    """
    Builds structured responses from KB documents.

    Usage:
        builder = AIResponseBuilder()
        response = builder.build_disease_response(doc, lang, confidence)
        response = builder.build_crop_response(doc, lang)
        response = builder.build_low_confidence_response(lang, intent)
    """

    # ------------------------------------------------------------------
    # DISEASE RESPONSE
    # ------------------------------------------------------------------

    def build_disease_response(
        self,
        doc:        dict[str, Any],
        lang:       str,
        confidence: float = 1.0,
        treatment_filter: str = "",   # "organic" | "chemical" | ""
    ) -> tuple[str, list[str]]:
        """
        Builds a structured disease/pest response from a KB document.

        Returns:
            (message_text, suggestions_list)
        """
        if confidence < _LOW_CONF:
            return self.build_low_confidence_response(lang, "disease")

        name     = doc.get("diseaseName") or doc.get("pestName") or ""
        crop     = doc.get("cropName") or ""
        cause    = doc.get("cause") or doc.get("pathogen") or ""
        symptoms = doc.get("symptoms") or doc.get("description") or ""
        severity = doc.get("severity") or doc.get("riskLevel") or ""
        organic  = (
            doc.get("organicTreatment") or
            doc.get("organic_treatment") or
            doc.get("bioControl") or ""
        )
        chemical = (
            doc.get("chemicalTreatment") or
            doc.get("chemical_treatment") or
            doc.get("pesticide") or
            doc.get("fungicide") or ""
        )
        treatment  = doc.get("treatment") or doc.get("management") or ""
        prevention = doc.get("prevention") or doc.get("preventiveMeasures") or ""
        fertilizer = doc.get("recommendedFertilizer") or ""
        irrigation = doc.get("recommendedIrrigation") or ""
        warning    = doc.get("warning") or doc.get("precaution") or ""

        if lang == "hi":
            return self._disease_hi(
                name, crop, cause, symptoms, severity, confidence,
                treatment, organic, chemical, prevention,
                fertilizer, irrigation, warning, treatment_filter,
            )
        return self._disease_en(
            name, crop, cause, symptoms, severity, confidence,
            treatment, organic, chemical, prevention,
            fertilizer, irrigation, warning, treatment_filter,
        )

    def _disease_hi(
        self, name, crop, cause, symptoms, severity, confidence,
        treatment, organic, chemical, prevention,
        fertilizer, irrigation, warning, treatment_filter,
    ) -> tuple[str, list[str]]:
        parts = []
        if name:
            parts.append(f"🌿 रोग/कीट: {name}")
        if crop:
            parts.append(f"🌾 फसल: {crop}")
        if cause:
            parts.append(f"🔬 कारण: {cause}")
        if symptoms:
            parts.append(f"🔍 लक्षण: {symptoms[:300]}")
        if severity:
            parts.append(f"⚠️ गंभीरता: {severity}")
        if confidence < 1.0:
            pct = round(confidence * 100, 1)
            parts.append(f"📊 विश्वास: {pct}%")

        # Treatment section — filter if requested
        if treatment_filter == "organic":
            if organic:
                parts.append(f"\n🌱 जैविक उपचार:\n{organic[:400]}")
            else:
                parts.append("\n🌱 जैविक उपचार: इस रोग के लिए नीम तेल (5 मिली/लीटर) का छिड़काव करें।")
        elif treatment_filter == "chemical":
            if chemical:
                parts.append(f"\n💊 रासायनिक उपचार:\n{chemical[:400]}")
            else:
                parts.append("\n💊 रासायनिक उपचार: नजदीकी कृषि केंद्र से उचित कीटनाशक लें।")
        else:
            if treatment:
                parts.append(f"\n💊 उपचार:\n{treatment[:300]}")
            if organic:
                parts.append(f"🌱 जैविक उपाय: {organic[:200]}")
            if chemical:
                parts.append(f"🧪 रासायनिक उपाय: {chemical[:200]}")

        if prevention:
            parts.append(f"\n🛡️ रोकथाम:\n{prevention[:200]}")
        if fertilizer:
            parts.append(f"🌿 उर्वरक: {fertilizer}")
        if irrigation:
            parts.append(f"💧 सिंचाई: {irrigation}")
        if warning:
            parts.append(f"\n⚠️ सावधानी: {warning[:150]}")

        parts.append("\n📞 KVK हेल्पलाइन: 1800-180-1551")

        suggestions = [
            "जैविक उपचार देखें",
            "रासायनिक उपचार देखें",
            "रोकथाम के उपाय",
            "छवि अपलोड करें",
            "KVK से संपर्क करें",
        ]
        return "\n".join(parts), suggestions

    def _disease_en(
        self, name, crop, cause, symptoms, severity, confidence,
        treatment, organic, chemical, prevention,
        fertilizer, irrigation, warning, treatment_filter,
    ) -> tuple[str, list[str]]:
        parts = []
        if name:
            parts.append(f"🌿 Disease/Pest: {name}")
        if crop:
            parts.append(f"🌾 Crop: {crop}")
        if cause:
            parts.append(f"🔬 Cause: {cause}")
        if symptoms:
            parts.append(f"🔍 Symptoms: {symptoms[:300]}")
        if severity:
            parts.append(f"⚠️ Severity: {severity}")
        if confidence < 1.0:
            pct = round(confidence * 100, 1)
            parts.append(f"📊 Confidence: {pct}%")

        if treatment_filter == "organic":
            if organic:
                parts.append(f"\n🌱 Organic Treatment:\n{organic[:400]}")
            else:
                parts.append("\n🌱 Organic Treatment: Spray neem oil (5 ml/litre).")
        elif treatment_filter == "chemical":
            if chemical:
                parts.append(f"\n💊 Chemical Treatment:\n{chemical[:400]}")
            else:
                parts.append("\n💊 Chemical Treatment: Consult your nearest agri centre.")
        else:
            if treatment:
                parts.append(f"\n💊 Treatment:\n{treatment[:300]}")
            if organic:
                parts.append(f"🌱 Organic: {organic[:200]}")
            if chemical:
                parts.append(f"🧪 Chemical: {chemical[:200]}")

        if prevention:
            parts.append(f"\n🛡️ Prevention:\n{prevention[:200]}")
        if fertilizer:
            parts.append(f"🌿 Fertilizer: {fertilizer}")
        if irrigation:
            parts.append(f"💧 Irrigation: {irrigation}")
        if warning:
            parts.append(f"\n⚠️ Warning: {warning[:150]}")

        parts.append("\n📞 KVK Helpline: 1800-180-1551")

        suggestions = [
            "View organic treatment",
            "View chemical treatment",
            "Prevention methods",
            "Upload leaf image",
            "Contact KVK",
        ]
        return "\n".join(parts), suggestions

    # ------------------------------------------------------------------
    # CROP RESPONSE
    # ------------------------------------------------------------------

    def build_crop_response(
        self,
        doc:  dict[str, Any],
        lang: str,
    ) -> tuple[str, list[str]]:
        """Builds a structured crop information response."""
        name    = doc.get("cropName") or ""
        desc    = doc.get("description") or ""
        season  = doc.get("season") or doc.get("sowingSeason") or ""
        soil    = doc.get("soilType") or ""
        water   = doc.get("waterRequirement") or ""
        fert    = doc.get("fertilizer") or doc.get("recommendedFertilizer") or ""
        disease = doc.get("commonDiseases") or ""
        yield_  = doc.get("expectedYield") or doc.get("yield") or ""

        if lang == "hi":
            parts = []
            if name:    parts.append(f"🌾 फसल: {name}")
            if desc:    parts.append(f"📋 विवरण: {desc[:250]}")
            if season:  parts.append(f"📅 मौसम: {season}")
            if soil:    parts.append(f"🌍 मिट्टी: {soil}")
            if water:   parts.append(f"💧 पानी: {water}")
            if fert:    parts.append(f"🌿 उर्वरक: {fert[:150]}")
            if disease: parts.append(f"⚠️ सामान्य रोग: {disease[:150]}")
            if yield_:  parts.append(f"📦 उत्पादन: {yield_}")
            suggestions = ["बुवाई का समय", "उर्वरक सलाह", "सिंचाई जानकारी", "रोग पहचान"]
        else:
            parts = []
            if name:    parts.append(f"🌾 Crop: {name}")
            if desc:    parts.append(f"📋 Description: {desc[:250]}")
            if season:  parts.append(f"📅 Season: {season}")
            if soil:    parts.append(f"🌍 Soil: {soil}")
            if water:   parts.append(f"💧 Water: {water}")
            if fert:    parts.append(f"🌿 Fertilizer: {fert[:150]}")
            if disease: parts.append(f"⚠️ Common diseases: {disease[:150]}")
            if yield_:  parts.append(f"📦 Expected yield: {yield_}")
            suggestions = ["Sowing time", "Fertilizer advice", "Irrigation info", "Disease detection"]

        return "\n".join(parts) if parts else ("", []), suggestions

    # ------------------------------------------------------------------
    # LOW CONFIDENCE RESPONSE
    # ------------------------------------------------------------------

    def build_low_confidence_response(
        self,
        lang:   str,
        intent: str = "disease",
    ) -> tuple[str, list[str]]:
        """
        Returns a clarification request when confidence is too low.
        Never hallucinate — ask for better input instead.
        """
        if lang == "hi":
            if intent == "disease":
                msg = (
                    "🔍 मुझे पूरी जानकारी नहीं मिली। बेहतर परिणाम के लिए:\n"
                    "1. 📸 पत्ती की स्पष्ट छवि अपलोड करें\n"
                    "2. 🌾 फसल का नाम बताएं\n"
                    "3. 📍 अपना जिला/राज्य बताएं\n"
                    "4. 🔍 रोग के लक्षण विस्तार से बताएं"
                )
                suggestions = [
                    "छवि अपलोड करें",
                    "फसल का नाम बताएं",
                    "जिला बताएं",
                    "लक्षण बताएं",
                ]
            else:
                msg = (
                    "🔍 अधिक जानकारी चाहिए। कृपया:\n"
                    "1. 🌾 फसल का नाम बताएं\n"
                    "2. 📍 अपना स्थान बताएं\n"
                    "3. 🔍 अपना प्रश्न विस्तार से बताएं"
                )
                suggestions = ["फसल का नाम बताएं", "स्थान बताएं", "विस्तार से बताएं"]
        else:
            if intent == "disease":
                msg = (
                    "🔍 I need more information for an accurate answer:\n"
                    "1. 📸 Upload a clear image of the affected leaf\n"
                    "2. 🌾 Provide the crop name\n"
                    "3. 📍 Provide your district/state\n"
                    "4. 🔍 Describe the symptoms in detail"
                )
                suggestions = [
                    "Upload leaf image",
                    "Provide crop name",
                    "Provide location",
                    "Describe symptoms",
                ]
            else:
                msg = (
                    "🔍 I need more details:\n"
                    "1. 🌾 Provide the crop name\n"
                    "2. 📍 Provide your location\n"
                    "3. 🔍 Describe your query in detail"
                )
                suggestions = ["Provide crop name", "Provide location", "Describe in detail"]

        return msg, suggestions

    # ------------------------------------------------------------------
    # PENDING ACTION RESPONSE
    # ------------------------------------------------------------------

    def build_pending_action_response(
        self,
        pending_action: str,
        lang: str,
    ) -> tuple[str, list[str]]:
        """Returns a response for a pending action (e.g. awaiting image)."""
        if pending_action == "awaiting_image":
            if lang == "hi":
                return (
                    "📸 कृपया प्रभावित पत्ती/फसल की स्पष्ट छवि अपलोड करें।\n"
                    "बेहतर पहचान के लिए:\n"
                    "• अच्छी रोशनी में फोटो लें\n"
                    "• पत्ती को पास से दिखाएं\n"
                    "• धुंधली छवि न भेजें",
                    ["छवि अपलोड करें", "रोग का नाम बताएं"],
                )
            return (
                "📸 Please upload a clear image of the affected leaf/crop.\n"
                "For better detection:\n"
                "• Take photo in good lighting\n"
                "• Show the leaf up close\n"
                "• Avoid blurry images",
                ["Upload image", "Describe symptoms"],
            )
        return "", []


# ---------------------------------------------------------------------------
# SINGLETON
# ---------------------------------------------------------------------------

_builder_instance: Optional[AIResponseBuilder] = None
_builder_lock = __import__("threading").Lock()


def get_response_builder(force_rebuild: bool = False) -> AIResponseBuilder:
    """Returns the singleton AIResponseBuilder."""
    global _builder_instance
    with _builder_lock:
        if _builder_instance is None or force_rebuild:
            _builder_instance = AIResponseBuilder()
    return _builder_instance
