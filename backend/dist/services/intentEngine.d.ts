/**
 * Intent Engine
 *
 * Classifies user messages into one of the defined intent types.
 * Pure function — no DB, no AI call, no side effects.
 * Used by the Root AI chat handler to route context correctly.
 *
 * Intent types:
 *   disease | crop | soil | weather | market | government | kvk |
 *   navigation | voice_command | general
 */
export type IntentType = 'greeting' | 'disease' | 'crop' | 'soil' | 'weather' | 'market' | 'government' | 'kvk' | 'irrigation' | 'machinery' | 'emergency' | 'navigation' | 'voice_command' | 'general';
/**
 * Detect the primary intent from a user message.
 * Returns 'general' if no specific intent matches.
 */
export declare function detectIntent(message: string): IntentType;
/**
 * Returns the page context that best matches a given intent.
 * Used to cross-validate: if intent doesn't match page context, AI is warned.
 */
export declare function intentToPageContext(intent: IntentType): string;
/**
 * Returns a human-readable label for an intent type.
 */
export declare function intentLabel(intent: IntentType): string;
//# sourceMappingURL=intentEngine.d.ts.map