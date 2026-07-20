/**
 * Government Agent
 * Domain: Government agriculture schemes, subsidies, eligibility
 * Data sources: GovtScheme MongoDB collection (via knowledgeBaseSearch)
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runGovernmentAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=governmentAgent.d.ts.map