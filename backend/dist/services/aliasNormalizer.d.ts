/**
 * Alias Normalizer
 *
 * Fast in-memory alias dictionary for all farmer vocabulary.
 * Runs BEFORE detectIntent() to normalize raw input.
 *
 * Priority:
 *   1. Exact alias match → canonical English term
 *   2. Partial/substring match → canonical English term
 *   3. No match → return original (pass-through)
 *
 * Performance target: <5ms (pure in-memory, zero DB calls)
 *
 * Covers: greeting, disease, weather, government, market, crop,
 *         soil, fertilizer, seed, machinery, irrigation, emergency
 */
export interface AliasResult {
    matched: boolean;
    alias: string;
    canonical: string;
    normalized: string;
}
/**
 * Normalize a raw user message using the in-memory alias dictionary.
 * Returns the canonical English form if matched, otherwise the original.
 *
 * Performance: <5ms (pure in-memory)
 */
export declare function normalizeAlias(raw: string): AliasResult;
/**
 * Normalize a message for intent detection.
 * If an alias is matched, appends the canonical term to the original message
 * so the intent engine sees both the original and the canonical form.
 * This preserves full context while ensuring intent detection works.
 */
export declare function prepareForIntentDetection(raw: string): string;
/**
 * Get all aliases for a given domain (for logging/debugging).
 */
export declare function getAliasesForDomain(domain: string): string[];
//# sourceMappingURL=aliasNormalizer.d.ts.map