/**
 * Irrigation Agent
 * Domain: Irrigation schedules, water management, drip/sprinkler guidance
 * Data sources: IrrigationSchedule, SoilMoisture MongoDB collections
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runIrrigationAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=irrigationAgent.d.ts.map