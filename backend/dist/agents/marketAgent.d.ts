/**
 * Market Agent
 * Domain: Mandi prices, commodity rates, selling advice
 * Data sources: Marketplace, MarketPriceHistory MongoDB collections
 * Never communicates directly with the user.
 */
import { AgentContext, AgentResult } from './types';
export declare function runMarketAgent(ctx: AgentContext): Promise<AgentResult>;
//# sourceMappingURL=marketAgent.d.ts.map