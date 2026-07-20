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
export interface PronunciationResult {
    original: string;
    ttsText: string;
    langUsed: string;
    foundInDictionary: boolean;
}
/**
 * Get the correct TTS text for a single term.
 * @param term      English term from AI/DB output
 * @param langCode  App language code ('hi', 'mwr', 'en', …)
 */
export declare function getPronunciation(term: string, langCode: string): Promise<PronunciationResult>;
/**
 * Apply pronunciation corrections to a full text string.
 * Replaces known terms with their correct TTS equivalents.
 * Unknown terms are passed through unchanged.
 *
 * @param text      Full text to process (AI response, DB content)
 * @param langCode  App language code
 */
export declare function applyPronunciationCorrections(text: string, langCode: string): Promise<string>;
/**
 * Get pronunciation hints for a list of terms (batch).
 * Used by the voice engine to pre-process AI responses before TTS.
 */
export declare function batchGetPronunciations(terms: string[], langCode: string): Promise<Record<string, PronunciationResult>>;
/**
 * Build SSML (Speech Synthesis Markup Language) hints for better TTS.
 * Used when provider supports SSML (Google, Azure).
 * Falls back to plain text for browser TTS.
 */
export declare function buildSSML(text: string, langBcp47: string, rate?: number, pitch?: number): string;
//# sourceMappingURL=pronunciationEngine.d.ts.map