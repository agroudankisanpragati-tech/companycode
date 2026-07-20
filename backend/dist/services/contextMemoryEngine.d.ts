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
import { IConversationTurn } from '../models/FarmerMemory';
export interface ResolvedContext {
    /** Original user message */
    original: string;
    /** Enriched message with resolved references */
    enriched: string;
    /** Whether any reference was resolved */
    resolved: boolean;
    /** What was resolved (for logging) */
    resolvedRefs: {
        cropName?: string;
        diseaseName?: string;
        schemeName?: string;
        commodity?: string;
        location?: string;
    };
}
/**
 * Resolve conversational references in a user message using conversation history.
 * Returns enriched message with resolved context appended.
 *
 * Zero DB calls — operates on the history slice already in memory.
 */
export declare function resolveContextReferences(message: string, history: IConversationTurn[]): ResolvedContext;
/**
 * Build a compact context summary from recent history for logging.
 */
export declare function buildContextSummary(history: IConversationTurn[]): string;
//# sourceMappingURL=contextMemoryEngine.d.ts.map