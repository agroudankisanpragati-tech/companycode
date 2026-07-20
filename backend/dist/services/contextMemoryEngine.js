"use strict";
/**
 * Context Memory Engine
 *
 * Resolves conversational references from FarmerMemory.conversationHistory.
 * Enables multi-turn context awareness:
 *
 *   Turn 1: "मेरी मूंग में बीमारी है"
 *   Turn 2: "फोटो भेजिए" (AI)
 *   Turn 3: [image uploaded → YOLO → Yellow Mosaic Virus]
 *   Turn 4: "इलाज बताओ"  ← resolves to "Yellow Mosaic Virus treatment for moong"
 *   Turn 5: "दूसरी दवा"  ← resolves to "alternative medicine for Yellow Mosaic Virus"
 *   Turn 6: "ऑर्गेनिक तरीका" ← resolves to "organic treatment for Yellow Mosaic Virus"
 *
 * Rules:
 * - Reads from FarmerMemory (already loaded by controller)
 * - Zero DB calls — works on the in-memory history slice
 * - Never modifies the original message — returns enriched context
 * - Non-fatal — if resolution fails, original message is used
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContextReferences = resolveContextReferences;
exports.buildContextSummary = buildContextSummary;
// ─── Reference patterns ───────────────────────────────────────────────────────
// Pronouns and references that indicate the user is referring to prior context
const REFERENCE_PATTERNS = [
    // Disease/treatment — Latin romanised
    /^(us(ka|ki|ke)|iska|iski|iske|uska|uski|uske)\s*(ilaj|ilaaj|upchar|upay|dawai|dawa|treatment|medicine)/i,
    /^(doosri|dusri|aur|or)\s*(dawa|dawai|medicine|upay|upchar|treatment)/i,
    /^(organic|jaivik)\s*(tarika|upay|treatment|method)/i,
    /^(rasaynik|chemical)\s*(tarika|upay|treatment|method)/i,
    /^(aur|or)\s*(upay|tarika|method|solution)/i,
    /^(bachav|prevention|rokne ka tarika)/i,
    /^(symptoms|lakshan|pehchaan)/i,
    /^(kya|kaise|kyun)\s*(hota|hoti|hote|hai|hain)/i,
    // Disease/treatment — Devanagari
    /^(\u0907\u0932\u093e\u091c|\u0909\u092a\u091a\u093e\u0930|\u0909\u092a\u093e\u092f|\u0926\u0935\u093e\u0908|\u0926\u0935\u093e)/,
    /^(\u0926\u0942\u0938\u0930\u0940|\u0914\u0930)\s*(\u0926\u0935\u093e|\u0926\u0935\u093e\u0908|\u0909\u092a\u093e\u092f|\u0909\u092a\u091a\u093e\u0930)/,
    /^(\u091c\u0948\u0935\u093f\u0915|\u0911\u0930\u094d\u0917\u0947\u0928\u093f\u0915)\s*(\u0924\u0930\u0940\u0915\u093e|\u0909\u092a\u093e\u092f)/,
    /^(\u0930\u093e\u0938\u093e\u092f\u0928\u093f\u0915)\s*(\u0924\u0930\u0940\u0915\u093e|\u0909\u092a\u093e\u092f)/,
    /^(\u0914\u0930|\u092d\u0940)\s*(\u0909\u092a\u093e\u092f|\u0924\u0930\u0940\u0915\u093e|\u091c\u093e\u0928\u0915\u093e\u0930\u0940)/,
    /^(\u0932\u0915\u094d\u0937\u0923|\u092a\u0939\u091a\u093e\u0928)/,
    /^(\u0915\u094d\u092f\u093e|\u0915\u0948\u0938\u0947|\u0915\u094d\u092f\u0942\u0902)\s*(\u0939\u094b\u0924\u093e|\u0939\u094b\u0924\u0940|\u0939\u0948|\u0939\u0948\u0902)/,
    // Crop references
    /^(us(ki|ke)|iska|iski)\s*(fasal|crop|kheti)/i,
    /^(aur|or)\s*(fasal|crop|variety|kism)/i,
    // Scheme references
    /^(us(ki|ke)|iska)\s*(yojana|scheme|labh|benefit)/i,
    /^(apply|avedan)\s*(kaise|karna)/i,
    // Market references
    /^(aaj ka|today's|current)\s*(bhav|rate|price)/i,
    /^(bechna|sell|kab bechun)/i,
    // General follow-up — Latin
    /^(aur|or|bhi|also|more|zyada)\s*(batao|bataiye|jankari|information)/i,
    /^(samjhao|explain|detail|details)/i,
    /^(haan|yes|theek hai|ok|okay|sahi)/i,
    // General follow-up — Devanagari
    /^(\u0914\u0930|\u092d\u0940)\s*(\u092c\u0924\u093e\u0913|\u092c\u0924\u093e\u0907\u090f|\u091c\u093e\u0928\u0915\u093e\u0930\u0940)/,
    /^(\u0938\u092e\u091d\u093e\u0913|\u0935\u093f\u0938\u094d\u0924\u093e\u0930)/,
    /^(\u0939\u093e\u0902|\u0920\u0940\u0915 \u0939\u0948|\u0938\u0939\u0940)/,
];
// ─── Entity extractors from conversation history ──────────────────────────────
function extractLastDisease(history) {
    // Search recent turns in reverse for disease mentions
    const diseasePatterns = [
        /disease[:\s]+([A-Za-z\s]+?)(?:\.|,|on|$)/i,
        /([A-Za-z\s]+?)\s+(?:disease|blight|rust|wilt|rot|mildew|mosaic|spot|borer|aphid)/i,
        /diagnosed[:\s]+([A-Za-z\s]+?)(?:\.|,|$)/i,
        /detected[:\s]+([A-Za-z\s]+?)(?:\.|,|$)/i,
        /class_name[:\s"]+([A-Za-z_\s]+?)(?:"|,|})/i,
    ];
    for (const turn of [...history].reverse()) {
        for (const pattern of diseasePatterns) {
            const match = turn.content.match(pattern);
            if (match?.[1]?.trim() && match[1].trim().length > 2) {
                return match[1].trim().replace(/_/g, ' ');
            }
        }
    }
    return '';
}
function extractLastCrop(history) {
    const cropList = [
        'moong', 'mung', 'wheat', 'gehu', 'rice', 'paddy', 'dhaan', 'tomato', 'tamatar',
        'corn', 'maize', 'makka', 'cotton', 'kapas', 'sugarcane', 'ganna', 'potato', 'aloo',
        'onion', 'pyaz', 'mustard', 'sarson', 'gram', 'chana', 'soybean', 'soya', 'bajra',
        'jowar', 'groundnut', 'mungfali', 'sunflower', 'surajmukhi', 'chilli', 'mirch',
        'brinjal', 'baingan', 'cucumber', 'kheera', 'pumpkin', 'kaddu', 'arhar', 'tur',
        'urad', 'masoor', 'lentil',
    ];
    for (const turn of [...history].reverse()) {
        const lower = turn.content.toLowerCase();
        for (const crop of cropList) {
            if (lower.includes(crop))
                return crop;
        }
    }
    return '';
}
function extractLastScheme(history) {
    const schemePatterns = [
        /scheme[:\s]+([A-Za-z\s\-]+?)(?:\.|,|$)/i,
        /(PM-KISAN|PMFBY|KCC|eNAM|Soil Health Card|Kisan Credit)/i,
        /yojana[:\s]+([A-Za-z\s]+?)(?:\.|,|$)/i,
    ];
    for (const turn of [...history].reverse()) {
        for (const pattern of schemePatterns) {
            const match = turn.content.match(pattern);
            if (match?.[1]?.trim())
                return match[1].trim();
        }
    }
    return '';
}
function extractLastCommodity(history) {
    const commodities = [
        'wheat', 'rice', 'paddy', 'maize', 'corn', 'cotton', 'sugarcane', 'potato',
        'onion', 'tomato', 'mustard', 'gram', 'soybean', 'groundnut', 'bajra', 'jowar',
        'arhar', 'moong', 'urad', 'sunflower',
    ];
    for (const turn of [...history].reverse()) {
        const lower = turn.content.toLowerCase();
        for (const c of commodities) {
            if (lower.includes(c))
                return c;
        }
    }
    return '';
}
function extractLastLocation(history) {
    const locationPattern = /(?:in|at|near|from|location[:\s]+)([A-Za-z\s]+?)(?:\.|,|$)/i;
    for (const turn of [...history].reverse()) {
        const match = turn.content.match(locationPattern);
        if (match?.[1]?.trim() && match[1].trim().length > 2) {
            return match[1].trim();
        }
    }
    return '';
}
// ─── Reference detector ───────────────────────────────────────────────────────
function isReferenceMessage(message) {
    const trimmed = message.trim();
    // Very short messages are likely references
    if (trimmed.split(/\s+/).length <= 3) {
        return REFERENCE_PATTERNS.some(p => p.test(trimmed));
    }
    return REFERENCE_PATTERNS.some(p => p.test(trimmed));
}
// ─── Main resolver ────────────────────────────────────────────────────────────
/**
 * Resolve conversational references in a user message using conversation history.
 * Returns enriched message with resolved context appended.
 *
 * Zero DB calls — operates on the history slice already in memory.
 */
function resolveContextReferences(message, history) {
    if (!message?.trim() || history.length === 0) {
        return { original: message, enriched: message, resolved: false, resolvedRefs: {} };
    }
    const isRef = isReferenceMessage(message);
    if (!isRef) {
        return { original: message, enriched: message, resolved: false, resolvedRefs: {} };
    }
    // Extract entities from recent history
    const diseaseName = extractLastDisease(history);
    const cropName = extractLastCrop(history);
    const schemeName = extractLastScheme(history);
    const commodity = extractLastCommodity(history);
    const location = extractLastLocation(history);
    const refs = {};
    const contextParts = [];
    if (diseaseName) {
        refs.diseaseName = diseaseName;
        contextParts.push(`disease: ${diseaseName}`);
    }
    if (cropName) {
        refs.cropName = cropName;
        contextParts.push(`crop: ${cropName}`);
    }
    if (schemeName) {
        refs.schemeName = schemeName;
        contextParts.push(`scheme: ${schemeName}`);
    }
    if (commodity) {
        refs.commodity = commodity;
        contextParts.push(`commodity: ${commodity}`);
    }
    if (location) {
        refs.location = location;
        contextParts.push(`location: ${location}`);
    }
    if (contextParts.length === 0) {
        return { original: message, enriched: message, resolved: false, resolvedRefs: {} };
    }
    // Enrich the message with resolved context
    const enriched = `${message} [context: ${contextParts.join(', ')}]`;
    return {
        original: message,
        enriched,
        resolved: true,
        resolvedRefs: refs,
    };
}
/**
 * Build a compact context summary from recent history for logging.
 */
function buildContextSummary(history) {
    if (history.length === 0)
        return 'no history';
    const last = history.slice(-4);
    return last.map(t => `${t.role === 'user' ? 'F' : 'AI'}: ${t.content.slice(0, 60)}`).join(' | ');
}
//# sourceMappingURL=contextMemoryEngine.js.map