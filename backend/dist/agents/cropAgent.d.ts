/**
 * Crop Agent
 * Domain: Crop advisory, recommendations, cultivation guidance
 * Data sources: CropKnowledgeBase (via knowledgeBaseSearch), FarmerCropRequest history
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runCropAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=cropAgent.d.ts.map