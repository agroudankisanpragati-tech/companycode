/**
 * Disease Agent
 * Domain: Plant disease & pest identification
 * Data sources (priority order):
 *   1. Admin KB (DiseasePestSolution)    — confidence 0.95
 *   2. Disease KB (DiseaseKnowledgeBase) — confidence 0.80
 *   3. Pest KB (PestKnowledgeBase)       — confidence 0.75
 *   4. Static KB (hardcoded common)      — confidence 0.60
 * Response: structured via responseGenerator (cause, symptoms, severity,
 *   confidence, organic, chemical, prevention, fertilizer, irrigation,
 *   warnings, next steps)
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runDiseaseAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=diseaseAgent.d.ts.map