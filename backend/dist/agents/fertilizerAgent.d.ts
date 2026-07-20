/**
 * Fertilizer Agent
 * Domain: Fertilizer products, NPK recommendations, organic alternatives
 * Data sources: FertilizerProduct, SoilReport MongoDB collections
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runFertilizerAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=fertilizerAgent.d.ts.map