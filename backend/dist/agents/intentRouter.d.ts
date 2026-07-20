/**
 * Intent Router — Root Router
 *
 * Called immediately after detectIntent(). Selects the correct agent for
 * the detected intent and returns a structured AgentRouteResult.
 *
 * Rules:
 * - greeting/navigation/voice_command → static response, NEVER touch KB or LLM
 * - disease/crop/soil/weather/market/government/kvk → dedicated agent only
 * - general → GeneralAgent (dispatchAgents + composeLocalResponse, optional LLM)
 * - LLM is NEVER called for any intent except general (and only as fallback)
 */
import { IntentType } from '../services/intentEngine';
import { AgentContext, AgentResult } from './types';
export type RouteMode = 'static' | 'agent' | 'general';
export interface AgentRouteResult {
    mode: RouteMode;
    intent: IntentType;
    agentName: string;
    agentResults: AgentResult[];
    staticReply?: {
        english: string;
        hindi: string;
        native: string;
    };
    yoloUsed: boolean;
    kbUsed: boolean;
    executionMs: number;
}
export declare function routeIntent(intent: IntentType, ctx: AgentContext): Promise<AgentRouteResult>;
//# sourceMappingURL=intentRouter.d.ts.map