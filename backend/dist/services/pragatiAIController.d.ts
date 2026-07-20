/**
 * Pragati AI Controller — ROOT AGENT
 *
 * Pipeline:
 *
 *   User Message
 *     ↓
 *   Language Engine (normalize + translate input)
 *     ↓
 *   Intent Engine (classify intent)
 *     ↓
 *   Root Router — routeIntent()
 *     ├─ greeting/navigation/voice → static response (NEVER KB, NEVER LLM)
 *     ├─ disease/crop/soil/weather/market/government/kvk → dedicated agent → local composer
 *     └─ general → GeneralAgent → dispatchAgents → composeLocalResponse → [optional LLM]
 *     ↓
 *   Memory Engine (persist turn, update preferences)
 *     ↓
 *   Response
 *
 * LLM Rules:
 * - NEVER called for: greeting, navigation, voice, disease, crop, soil, weather, market, government, kvk
 * - ONLY optional fallback for: general (and only when local KB returns nothing)
 * - NEVER called if OPENAI_API_KEY is absent
 */
import { IntentType } from './intentEngine';
import { type PageData } from './contextEngine';
export interface ControllerRequest {
    userId: string;
    messages: {
        role: string;
        content: string;
    }[];
    langCode: string;
    pageData?: PageData;
    dashboardContext?: Record<string, any>;
    farmerProfile?: {
        name?: string;
        district?: string;
        state?: string;
        farmSize?: string;
        soilType?: string;
    };
}
export interface ControllerResponse {
    success: boolean;
    reply: string;
    bilingual: {
        english: string;
        hindi: string;
        native: string;
        timestamp: string;
        source: 'local' | 'llm' | 'fallback';
    };
    intent: IntentType;
    agentsUsed: string[];
    localAnswered: boolean;
}
export declare function runPragatiAIController(req: ControllerRequest): Promise<ControllerResponse>;
//# sourceMappingURL=pragatiAIController.d.ts.map