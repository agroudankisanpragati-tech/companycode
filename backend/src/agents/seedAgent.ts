/**
 * Seed Agent
 * Domain: Seed varieties, availability, nearby seed shops
 * Data sources: NurseryProduct, ShopProduct, Shop MongoDB collections
 * Never communicates directly with the user.
 */

import { NurseryProduct } from '../models/NurseryProduct';
import { ShopProduct } from '../models/ShopProduct';
import { AgentContext, AgentResult } from './types';

export async function runSeedAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { message, farmerProfile } = ctx;

    const cropName = extractCropFromMessage(message);
    const state = farmerProfile?.state || '';
    const district = farmerProfile?.district || '';

    // Search nursery products for seeds
    const nurseryFilter: any = { productType: /seed/i };
    if (cropName) nurseryFilter.cropName = new RegExp(cropName, 'i');

    const nurseryProducts = await NurseryProduct.find(nurseryFilter)
      .limit(5)
      .lean();

    // Search shop products for seeds
    const shopFilter: any = { category: /seed/i, isAvailable: true };
    if (cropName) shopFilter.name = new RegExp(cropName, 'i');

    const shopProducts = await ShopProduct.find(shopFilter)
      .limit(5)
      .lean();

    if (nurseryProducts.length === 0 && shopProducts.length === 0) {
      return {
        agent: 'SeedAgent',
        success: true,
        data: {},
        summary: `No seed products found${cropName ? ` for ${cropName}` : ''}. Guide the farmer to the Marketplace to find nearby seed shops.`,
      };
    }

    const seeds = [
      ...nurseryProducts.map((p: any) => ({
        name: p.name || p.cropName,
        variety: p.variety,
        price: p.price,
        unit: p.unit,
        source: 'nursery',
      })),
      ...shopProducts.map((p: any) => ({
        name: p.name,
        variety: p.description,
        price: p.price,
        unit: p.unit,
        source: 'shop',
      })),
    ];

    return {
      agent: 'SeedAgent',
      success: true,
      data: { seeds, cropName, district, state },
      summary: `Found ${seeds.length} seed product(s)${cropName ? ` for ${cropName}` : ''}. Varieties: ${seeds.slice(0, 3).map(s => s.name).join(', ')}.`,
    };
  } catch (err: any) {
    return {
      agent: 'SeedAgent',
      success: false,
      error: 'Seed information is temporarily unavailable.',
    };
  }
}

function extractCropFromMessage(msg: string): string {
  const crops = [
    'wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane',
    'potato', 'onion', 'mustard', 'gram', 'soybean', 'bajra', 'jowar',
    'groundnut', 'sunflower', 'chilli', 'brinjal', 'cucumber', 'pumpkin',
  ];
  const lower = msg.toLowerCase();
  return crops.find(c => lower.includes(c)) || '';
}
