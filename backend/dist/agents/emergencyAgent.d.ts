/**
 * Emergency Agent
 * Domain: Farming emergencies — crop damage, pest outbreak, flood, poisoning
 * Data sources: Static guidance only (no DB, no LLM)
 * Never communicates directly with the user.
 * LLM is NEVER called for emergency intent.
 */
import { AgentContext, AgentResult } from './types';
export declare function runEmergencyAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=emergencyAgent.d.ts.map