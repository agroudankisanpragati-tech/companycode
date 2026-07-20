/**
 * Agent Router — Phase 4
 *
 * Pragati AI uses this router internally to fetch domain-specific data
 * before composing its response. These are data-fetching modules, NOT
 * separate AIs. They are never exposed to the user.
 *
 * Routing is based on the IntentType already detected by intentEngine.ts.
 * No new routes or APIs are created — this is a pure internal service.
 *
 * Failover: if one module fails, only that domain returns an error.
 * All other modules continue working normally.
 */
import { AgentContext, AgentResult } from './types';
/**
 * Main dispatch function called by Pragati Root AI.
 * Returns an array of agent results to be injected into the AI context.
 */
export declare function dispatchAgents(message: string, ctx: Omit<AgentContext, 'message'>): Promise<AgentResult[]>;
/**
 * Build a context block string from module results.
 * This is injected into Pragati AI's system prompt to enrich its response.
 */
export declare function buildAgentContextBlock(results: AgentResult[]): string;
//# sourceMappingURL=agentRouter.d.ts.map