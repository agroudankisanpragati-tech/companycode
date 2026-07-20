"use strict";
/**
 * Pronunciation Engine — Phase 6
 *
 * Uses LanguageDictionary aliases to correct pronunciation of:
 * - Crop names (e.g. "Urad Dal" → "उड़द दाल" for Hindi TTS)
 * - Disease names (e.g. "Leaf Blight" → "पत्ती झुलसा")
 * - Rajasthan dialect terms
 * - Fertilizer names (DAP, NPK, Urea — keep as-is for TTS)
 *
 * Rules:
 * - English selected → speak English term
 * - Any other lang   → speak Hindi term (or dialect if available)
 * - Technical terms (DAP, NPK, pH) → always speak as-is
 * - Unknown terms → pass through unchanged (queued for review by aliasEngine)
 *
 * This engine is called by the voiceEngine route before TTS synthesis.
 * It does NOT modify the display text — only the TTS text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPronunciation = getPronunciation;
exports.applyPronunciationCorrections = applyPronunciationCorrections;
exports.batchGetPronunciations = batchGetPronunciations;
exports.buildSSML = buildSSML;
const LanguageDictionary_1 = require("../models/LanguageDictionary");
const languageDictionaryService_1 = require("./languageDictionaryService");
// ─── Terms that should never be translated for TTS ───────────────────────────
const PRESERVE_AS_IS = new Set([
    'dap', 'npk', 'urea', 'mop', 'ph', 'ec', 'n', 'p', 'k',
    'yolo', 'ai', 'api', 'url', 'id', 'otp', 'sms',
]);
// ─── Dialect field map (mirrors languageDictionaryService) ────────────────────
const DIALECT_FIELD = {
    mwr: 'marwari', mew: 'mewari', dhu: 'dhundhari', hao: 'hadoti',
    shk: 'shekhawati', bag: 'bagri', wag: 'wagdi', mti: 'mewati',
    gdw: 'godwari', ahi: 'ahirwati', mlv: 'malvi',
};
/**
 * Get the correct TTS text for a single term.
 * @param term      English term from AI/DB output
 * @param langCode  App language code ('hi', 'mwr', 'en', …)
 */
async function getPronunciation(term, langCode) {
    const trimmed = term.trim();
    const normalized = (0, languageDictionaryService_1.normalizeKey)(trimmed);
    // Preserve technical terms as-is
    if (PRESERVE_AS_IS.has(normalized)) {
        return { original: trimmed, ttsText: trimmed, langUsed: langCode, foundInDictionary: false };
    }
    // English → speak English
    if (langCode === 'en') {
        return { original: trimmed, ttsText: trimmed, langUsed: 'en', foundInDictionary: false };
    }
    // Look up in dictionary
    const entry = await LanguageDictionary_1.LanguageDictionary.findOne({
        approved: true,
        $or: [{ normalizedKey: normalized }, { aliases: normalized }],
    }).lean();
    if (!entry) {
        return { original: trimmed, ttsText: trimmed, langUsed: langCode, foundInDictionary: false };
    }
    // Dialect field lookup
    const dialectField = DIALECT_FIELD[langCode];
    const dialectText = dialectField ? entry[dialectField] : undefined;
    const ttsText = dialectText || entry.hindi || trimmed;
    return {
        original: trimmed,
        ttsText,
        langUsed: langCode,
        foundInDictionary: true,
    };
}
/**
 * Apply pronunciation corrections to a full text string.
 * Replaces known terms with their correct TTS equivalents.
 * Unknown terms are passed through unchanged.
 *
 * @param text      Full text to process (AI response, DB content)
 * @param langCode  App language code
 */
async function applyPronunciationCorrections(text, langCode) {
    if (!text?.trim() || langCode === 'en')
        return text;
    // Fetch all approved dictionary entries once
    const entries = await LanguageDictionary_1.LanguageDictionary.find({ approved: true })
        .select('normalizedKey english hindi marwari mewari dhundhari hadoti shekhawati bagri wagdi mewati godwari ahirwati malvi aliases')
        .lean();
    let result = text;
    const dialectField = DIALECT_FIELD[langCode];
    for (const entry of entries) {
        if (!entry.english)
            continue;
        const replacement = dialectField
            ? entry[dialectField] || entry.hindi
            : entry.hindi;
        if (!replacement || replacement === entry.english)
            continue;
        // Replace English term with pronunciation-corrected version
        // Use word boundary matching to avoid partial replacements
        const escapedEnglish = entry.english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedEnglish}\\b`, 'gi');
        result = result.replace(regex, replacement);
        // Also replace aliases
        for (const alias of entry.aliases || []) {
            if (!alias || normalizeStr(alias) === normalizeStr(replacement))
                continue;
            const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, 'gi');
            result = result.replace(aliasRegex, replacement);
        }
    }
    return result;
}
function normalizeStr(s) {
    return s.toLowerCase().replace(/[\s_\-]+/g, '');
}
/**
 * Get pronunciation hints for a list of terms (batch).
 * Used by the voice engine to pre-process AI responses before TTS.
 */
async function batchGetPronunciations(terms, langCode) {
    const results = await Promise.all(terms.map(t => getPronunciation(t, langCode)));
    return Object.fromEntries(terms.map((t, i) => [t, results[i]]));
}
/**
 * Build SSML (Speech Synthesis Markup Language) hints for better TTS.
 * Used when provider supports SSML (Google, Azure).
 * Falls back to plain text for browser TTS.
 */
function buildSSML(text, langBcp47, rate = 0.9, pitch = 1) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langBcp47}">
  <prosody rate="${rate}" pitch="${pitch >= 1 ? '+' : ''}${((pitch - 1) * 50).toFixed(0)}%">
    ${escaped}
  </prosody>
</speak>`;
}
//# sourceMappingURL=pronunciationEngine.js.map