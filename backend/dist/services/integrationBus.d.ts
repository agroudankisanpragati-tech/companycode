/**
 * Integration Bus — Final Enterprise Integration Layer
 *
 * Single shared service that wires together:
 *   Language Engine → Pragati AI → Specialized Modules → Shared Memory
 *
 * Pragati AI is the one and only AI. Internally it uses specialized modules
 * (crop, disease, soil, weather, market, etc.) to enrich its context before
 * calling the LLM. These modules are NOT separate AIs and are never exposed
 * to the user. The user always sees only "Pragati AI".
 *
 * Every AI request flows through here. No page or route needs to know
 * about the internal wiring. Business logic (YOLO, MongoDB, Disease,
 * Pest Solutions, existing APIs) is NEVER modified.
 *
 * Rules:
 * - All failures are non-fatal and logged.
 * - YOLO / MongoDB / existing routes are untouched.
 * - Future speech datasets plug in via voiceDatasetRegistry — zero logic change.
 * - Only Pragati AI is visible to the user.
 */
import { type PageData } from './contextEngine';
export interface BusRequest {
    userId: string;
    rawMessage: string;
    langCode: string;
    pageContext?: string;
    pageData?: PageData;
    farmerProfile?: {
        name?: string;
        district?: string;
        state?: string;
        farmSize?: string;
        soilType?: string;
    };
}
export interface BusResult {
    /** Normalized English text sent to AI/DB/YOLO */
    englishForBackend: string;
    /** Full memory + agent context block for AI system prompt injection */
    contextBlock: string;
    /** Detected intent */
    intent: string;
    /** Whether the input term was found in the dictionary */
    foundInDictionary: boolean;
}
/**
 * Process an incoming message through the full integration pipeline:
 *   1. Language Engine — normalize + translate input
 *   2. Shared Memory — load farmer context
 *   3. Intent detection + page context
 *   4. Specialized agent dispatch
 *   5. Build combined context block for Pragati AI's system prompt
 *
 * Called BEFORE the LLM call. Returns a context block to inject into the prompt.
 */
export declare function processRequest(req: BusRequest): Promise<BusResult>;
/**
 * Called AFTER Pragati AI sends its response to the user.
 * Writes memory turn and updates language preference.
 * Fire-and-forget — never blocks the response.
 */
export declare function postProcess(params: {
    userId: string;
    userMessage: string;
    assistantReply: string;
    langCode: string;
    pageContext?: string;
    agentUsed?: string;
}): void;
/**
 * Translate Pragati AI's English output to the user's display language.
 * English selected → return as-is.
 * Other language → return Hindi display + dialect voice text.
 */
export declare function translateAIOutput(englishText: string, langCode: string): Promise<{
    displayText: string;
    voiceText: string;
}>;
//# sourceMappingURL=integrationBus.d.ts.map