/**
 * Soil Agent
 * Domain: Soil health analysis, deficiencies, fertilizer recommendations
 * Data sources: SoilReport, SoilStandard MongoDB collections
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runSoilAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=soilAgent.d.ts.map