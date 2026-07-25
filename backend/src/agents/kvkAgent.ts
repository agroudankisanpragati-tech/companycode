/**
 * KVK Agent
 * Fix 2: reads state/district from ctx.entities
 */

import { KVK } from '../models/KVK';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const log = createLogger('kvkAgent');

export async function runKVKAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { pageData, farmerProfile, entities } = ctx;

    if (pageData?.kvkData) {
      const k = pageData.kvkData;
      return {
        agent: 'KVKAgent', success: true, data: k,
        summary: `KVK: ${k.name}, ${k.district}, ${k.state}. Services: ${(k.services || k.servicesOffered || []).join(', ')}. Distance: ${k.distance ? k.distance + ' km' : 'N/A'}.`,
      };
    }

    const state    = entities?.state    || farmerProfile?.state    || '';
    const district = entities?.district || farmerProfile?.district || '';

    log.debug('KVKAgent running', { state, district });

    const filter: any = { isActive: true };
    if (district) filter.district = createSafeRegex(district);
    else if (state) filter.state  = createSafeRegex(state);

    const kvks = await KVK.find(filter).limit(3).lean();

    if (kvks.length === 0) return buildFallbackResult('KVKAgent', 'kvk');

    const kvkList = kvks.map(k => ({
      name: k.name, district: k.district, state: k.state,
      address: k.address, phone: k.phone, email: k.email,
      services: k.servicesOffered, website: k.website,
    }));

    return {
      agent: 'KVKAgent', success: true,
      data: { kvks: kvkList },
      summary: `Found ${kvks.length} KVK center(s) near ${district || state}: ${kvks.map(k => k.name).join(', ')}.`,
    };
  } catch (err: any) {
    log.error('KVKAgent error', { error: err?.message });
    return buildErrorResult('KVKAgent', 'kvk', err);
  }
}
