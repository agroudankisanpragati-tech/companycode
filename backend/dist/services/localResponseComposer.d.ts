/**
 * Local Response Composer
 *
 * Composes structured, farmer-friendly responses entirely from local agent data.
 * Zero external API calls. Zero LLM dependency.
 *
 * Called by PragatiAIController BEFORE any fallback LLM is considered.
 * If this returns a non-null response, the LLM is never called.
 *
 * Rules:
 * - Only uses data already fetched by the local agents.
 * - Never fabricates data not present in agent results.
 * - Returns null when local data is insufficient to answer confidently.
 * - Multilingual output: native + hindi + english fields always populated.
 */
import { AgentResult } from '../agents/types';
import { IntentType } from './intentEngine';
export interface LocalResponse {
    english: string;
    hindi: string;
    native: string;
    source: 'local';
    intent: IntentType;
    agentsUsed: string[];
    confidence: 'high' | 'medium' | 'low';
}
/**
 * Attempt to compose a complete response from local agent data.
 * Returns null if local data is insufficient — caller should use LLM fallback.
 */
export declare function composeLocalResponse(intent: IntentType, results: AgentResult[], langCode: string, userMessage: string): LocalResponse | null;
/**
 * Build a "not found in local KB" response — used when fallback LLM is disabled.
 */
export declare function buildNotFoundResponse(langCode: string): LocalResponse;
//# sourceMappingURL=localResponseComposer.d.ts.map