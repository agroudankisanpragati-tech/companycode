/**
 * Government Agent
 * Domain: Government agriculture schemes, subsidies, eligibility
 * Data sources: GovtScheme MongoDB collection (via knowledgeBaseSearch)
 *
 * Fix 2: reads scheme keyword and state from ctx.entities
 */

import { AgentContext, AgentResult } from './types';
import { searchSchemeKB } from '../services/knowledgeBaseSearch';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('governmentAgent');

export async function runGovernmentAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { pageData, farmerProfile, entities } = ctx;

    // If a scheme is already open on the page, use it
    if (pageData?.schemeData) {
      const s = pageData.schemeData;
      return {
        agent:   'GovernmentAgent',
        success: true,
        data:    s,
        summary: `Scheme: ${s.title}. Benefits: ${(s.benefits || []).join(', ')}. Eligibility: ${s.eligibility || 'N/A'}.`,
      };
    }

    // Fix 2: use pre-extracted entities
    const keyword = entities?.scheme || '';
    const state   = entities?.state || farmerProfile?.state || '';

    log.debug('GovernmentAgent running', { keyword, state });

    const kbResult = await searchSchemeKB(keyword, state);

    if (kbResult.found) {
      return {
        agent:   'GovernmentAgent',
        success: true,
        data:    kbResult.data,
        summary: kbResult.summary,
      };
    }

    return buildFallbackResult('GovernmentAgent', 'government');
  } catch (err: any) {
    log.error('GovernmentAgent error', { error: err?.message });
    return buildErrorResult('GovernmentAgent', 'government', err);
  }
}
