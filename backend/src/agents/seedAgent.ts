/**
 * Seed Agent
 * Domain: Seed varieties, availability, nearby seed shops
 * Data sources: NurseryProduct, ShopProduct MongoDB collections
 *
 * Fix 2: reads crop name from ctx.entities
 */

import { NurseryProduct } from '../models/NurseryProduct';
import { ShopProduct } from '../models/ShopProduct';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const log = createLogger('seedAgent');

export async function runSeedAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { farmerProfile, entities } = ctx;

    // Fix 2: use pre-extracted entity
    const cropName = entities?.crop || '';
    const state    = entities?.state || farmerProfile?.state || '';
    const district = entities?.district || farmerProfile?.district || '';

    log.debug('SeedAgent running', { cropName, state, district });

    const nurseryFilter: any = { productType: /seed/i };
    if (cropName) nurseryFilter.cropName = createSafeRegex(cropName);

    const shopFilter: any = { category: /seed/i, isAvailable: true };
    if (cropName) shopFilter.name = createSafeRegex(cropName);

    const [nurseryProducts, shopProducts] = await Promise.all([
      NurseryProduct.find(nurseryFilter).limit(5).lean(),
      ShopProduct.find(shopFilter).limit(5).lean(),
    ]);

    if (nurseryProducts.length === 0 && shopProducts.length === 0) {
      return buildFallbackResult(
        'SeedAgent', 'seed',
        cropName ? `No seeds found for ${cropName}.` : undefined,
      );
    }

    const seeds = [
      ...nurseryProducts.map((p: any) => ({
        name:    p.name || p.cropName,
        variety: p.variety,
        price:   p.price,
        unit:    p.unit,
        source:  'nursery',
      })),
      ...shopProducts.map((p: any) => ({
        name:    p.name,
        variety: p.description,
        price:   p.price,
        unit:    p.unit,
        source:  'shop',
      })),
    ];

    return {
      agent:   'SeedAgent',
      success: true,
      data:    { seeds, cropName, district, state },
      summary: `Found ${seeds.length} seed product(s)${cropName ? ` for ${cropName}` : ''}. Varieties: ${seeds.slice(0, 3).map(s => s.name).join(', ')}.`,
    };
  } catch (err: any) {
    log.error('SeedAgent error', { error: err?.message });
    return buildErrorResult('SeedAgent', 'seed', err);
  }
}
