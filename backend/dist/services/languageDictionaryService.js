"use strict";
/**
 * Language Dictionary Service
 * Central lookup engine for all term translations.
 * - Normalizes keys (case, spaces, underscores, hyphens)
 * - Prioritizes by page context (disease page → disease terms first)
 * - Queues unknown words for admin review
 * - Resolves display text per display rules:
 *     English selected → English
 *     Any other lang   → Hindi (display) + dialect (voice)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeKey = normalizeKey;
exports.lookupTerm = lookupTerm;
exports.lookupTerms = lookupTerms;
exports.resolveDisplayText = resolveDisplayText;
const LanguageDictionary_1 = require("../models/LanguageDictionary");
const DictionaryReviewQueue_1 = require("../models/DictionaryReviewQueue");
// ─── Dialect code → field name map ───────────────────────────────────────────
const DIALECT_FIELD = {
    mwr: 'marwari',
    mew: 'mewari',
    dhu: 'dhundhari',
    hao: 'hadoti',
    shk: 'shekhawati',
    bag: 'bagri',
    wag: 'wagdi',
    mti: 'mewati',
    gdw: 'godwari',
    ahi: 'ahirwati',
    mlv: 'malvi',
};
// ─── Page context → category priority list ───────────────────────────────────
const CONTEXT_PRIORITY = {
    disease: ['diseases', 'pests', 'crops', 'agriculture'],
    soil: ['soil', 'fertilizers', 'crops', 'agriculture'],
    government: ['government', 'agriculture', 'crops'],
    weather: ['weather', 'agriculture', 'crops'],
    market: ['crops', 'agriculture', 'fertilizers'],
    crop: ['crops', 'agriculture', 'fertilizers', 'soil'],
    shop: ['fertilizers', 'crops', 'agriculture'],
    ui: ['ui', 'agriculture'],
};
// ─── Normalize ────────────────────────────────────────────────────────────────
function normalizeKey(raw) {
    return raw.toLowerCase().replace(/[\s_\-]+/g, '');
}
/**
 * Look up a term and return display + voice text according to display rules.
 * @param raw      Raw user input (any case/spacing)
 * @param langCode App language code ('en', 'hi', 'mwr', …)
 * @param pageCtx  Page context key ('disease', 'soil', 'government', …)
 */
async function lookupTerm(raw, langCode, pageCtx) {
    const key = normalizeKey(raw);
    const baseQuery = { approved: true, $or: [{ normalizedKey: key }, { aliases: key }] };
    let entry = null;
    if (pageCtx && CONTEXT_PRIORITY[pageCtx]) {
        for (const cat of CONTEXT_PRIORITY[pageCtx]) {
            entry = await LanguageDictionary_1.LanguageDictionary.findOne({ ...baseQuery, category: cat }).lean();
            if (entry)
                break;
        }
    }
    if (!entry) {
        entry = await LanguageDictionary_1.LanguageDictionary.findOne(baseQuery).lean();
    }
    if (!entry) {
        // Queue unknown word for admin review (deduplicate)
        await DictionaryReviewQueue_1.DictionaryReviewQueue.updateOne({ normalizedKey: key, status: 'pending' }, { $setOnInsert: { rawInput: raw, normalizedKey: key, pageContext: pageCtx } }, { upsert: true });
        return { found: false, english: raw, hindi: raw, displayText: raw, voiceText: raw, confidence: 0 };
    }
    const isEnglish = langCode === 'en';
    const dialectField = DIALECT_FIELD[langCode];
    const dialectText = dialectField ? entry[dialectField] : undefined;
    const displayText = isEnglish ? entry.english : entry.hindi;
    const voiceText = isEnglish ? entry.english : (dialectText || entry.hindi);
    return {
        found: true,
        english: entry.english,
        hindi: entry.hindi,
        dialectText,
        displayText,
        voiceText,
        confidence: entry.confidence,
        category: entry.category,
    };
}
/**
 * Batch lookup — returns a map of raw → LookupResult.
 */
async function lookupTerms(raws, langCode, pageCtx) {
    const results = await Promise.all(raws.map(r => lookupTerm(r, langCode, pageCtx)));
    return Object.fromEntries(raws.map((r, i) => [r, results[i]]));
}
/**
 * Resolve display text for a known English term (used by AI output post-processing).
 */
async function resolveDisplayText(englishTerm, langCode, pageCtx) {
    const result = await lookupTerm(englishTerm, langCode, pageCtx);
    return result.displayText;
}
//# sourceMappingURL=languageDictionaryService.js.map