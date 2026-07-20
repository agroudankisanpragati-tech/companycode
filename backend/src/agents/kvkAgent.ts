/**
 * KVK Agent
 * Domain: Krishi Vigyan Kendra centers, services, training
 * Data sources: KVK MongoDB collection via kvkService
 * Never communicates directly with the user.
 */

import { KVK } from '../models/KVK';
import { AgentContext, AgentResult } from './types';

export async function runKVKAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { pageData, farmerProfile } = ctx;

    // If KVK data is already on the page, use it
    if (pageData?.kvkData) {
      const k = pageData.kvkData;
      return {
        agent: 'KVKAgent',
        success: true,
        data: k,
        summary: `KVK: ${k.name}, ${k.district}, ${k.state}. Services: ${(k.services || k.servicesOffered || []).join(', ')}. Distance: ${k.distance ? k.distance + ' km' : 'N/A'}.`,
      };
    }

    const state = farmerProfile?.state || '';
    const district = farmerProfile?.district || '';

    // Find KVKs in the farmer's district/state
    const filter: any = { isActive: true };
    if (district) filter.district = new RegExp(district, 'i');
    else if (state) filter.state = new RegExp(state, 'i');

    const kvks = await KVK.find(filter).limit(3).lean();

    if (kvks.length === 0) {
      return {
        agent: 'KVKAgent',
        success: true,
        data: {},
        summary: 'No KVK centers found nearby. Guide the farmer to the KVK page to find the nearest center.',
      };
    }

    const kvkList = kvks.map(k => ({
      name: k.name,
      district: k.district,
      state: k.state,
      address: k.address,
      phone: k.phone,
      email: k.email,
      services: k.servicesOffered,
      website: k.website,
    }));

    return {
      agent: 'KVKAgent',
      success: true,
      data: { kvks: kvkList },
      summary: `Found ${kvks.length} KVK center(s) near ${district || state}: ${kvks.map(k => k.name).join(', ')}.`,
    };
  } catch (err: any) {
    return {
      agent: 'KVKAgent',
      success: false,
      error: 'KVK center information is temporarily unavailable.',
    };
  }
}
