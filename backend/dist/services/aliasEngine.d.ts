/**
 * Alias Engine — Phase 5
 *
 * Handles smart dictionary growth:
 * 1. Normalize unknown words (case, spaces, underscores, hyphens → single key)
 * 2. Compare with existing dictionary aliases using similarity scoring
 * 3. If similarity >= threshold → suggest merge into existing entry
 * 4. If no match → store as new Suggested Word in DictionaryReviewQueue
 * 5. NEVER auto-approve — all suggestions go to admin review
 *
 * Approved words automatically become available across all agents
 * because every agent uses lookupTerm() from languageDictionaryService.
 *
 * Alias examples handled:
 *   "Black Gram" / "BlackGram" / "Black_Gram" / "black-gram" → "blackgram"
 *   Dialect variations → same normalized key, different display fields
 */
/**
 * Compute similarity between two normalized strings.
 * Uses token overlap + substring containment.
 * Returns 0–1.
 */
export declare function computeSimilarity(a: string, b: string): number;
export interface AliasMatchResult {
    action: 'exact_match' | 'suggest_merge' | 'queue_new' | 'skip_noise';
    normalizedInput: string;
    /** Set when action is suggest_merge */
    matchedEntryId?: string;
    matchedKey?: string;
    similarity?: number;
}
/**
 * Process an unknown word through the alias engine.
 *
 * Steps:
 * 1. Normalize the input
 * 2. Check for exact match in dictionary (already handled by lookupTerm — skip if found)
 * 3. Scan all aliases for similarity
 * 4. Decide: exact_match | suggest_merge | queue_new | skip_noise
 * 5. Upsert into DictionaryReviewQueue (never auto-approve)
 */
export declare function processUnknownWord(rawInput: string, pageContext?: string, detectedLang?: string, suggestedEnglish?: string): Promise<AliasMatchResult>;
/**
 * Process multiple unknown words in parallel.
 * Used by the memory engine after each conversation turn.
 */
export declare function processBatchUnknownWords(words: string[], pageContext?: string, detectedLang?: string): Promise<AliasMatchResult[]>;
/**
 * Extract candidate unknown words from a message.
 * Filters out common stop words and very short tokens.
 */
export declare function extractCandidateWords(message: string): string[];
//# sourceMappingURL=aliasEngine.d.ts.map