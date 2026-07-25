/**
 * Fertilizer Agent
 * Domain: Fertilizer products, NPK recommendations, organic alternatives
 * Data sources: FertilizerProduct, ctx.shared.soilReport (pre-loaded)
 *
 * Fix 2: reads fertilizer type and crop from ctx.entities
 * Fix 8: reads SoilReport from ctx.shared — eliminates duplicate query with SoilAgent
 * Fix m9: nutrient thresholds now reference SoilStandard model (future) — kept
 *         as named constants instead of magic numbers for now
 */

import { FertilizerProduct } from '../models/FertilizerProduct';
import { SoilReport } from '../models/SoilReport';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const log = createLogger('fertilizerAgent');

// Named thresholds — replace magic numbers (Fix m9)
const NITROGEN_LOW_THRESHOLD   = 200;
const PHOSPHORUS_LOW_THRESHOLD = 10;
const POTASSIUM_LOW_THRESHOLD  = 150;

export async function runFertilizerAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, entities, shared, farmerProfile } = ctx;

    // Fix 2: use pre-extracted entities
    const fertilizerType = entities?.fertilizer || '';
    const cropName       = entities?.crop || '';

    // Fix 8: use pre-loaded shared soil report — no duplicate DB query
    let soilReport: any = shared?.soilReport || null;

    if (!soilReport) {
      log.debug('FertilizerAgent: shared context missing, querying DB directly', { userId });
      soilReport = await SoilReport.findOne({ farmerId: userId })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Search fertilizer products
    const filter: any = {};
    if (fertilizerType) filter.$or = [
      { name:            createSafeRegex(fertilizerType) },
      { type:            createSafeRegex(fertilizerType) },
      { nutrientContent: createSafeRegex(fertilizerType) },
    ];
    if (cropName) filter.suitableCrops = createSafeRegex(cropName);

    const products = await FertilizerProduct.find(filter).limit(5).lean();

    const soilContext = soilReport ? {
      soilType:                  soilReport.soilType,
      ph:                        soilReport.pH,
      nitrogenStatus:            soilReport.nitrogen < NITROGEN_LOW_THRESHOLD   ? 'Low' : 'Adequate',
      phosphorusStatus:          soilReport.phosphorus < PHOSPHORUS_LOW_THRESHOLD ? 'Low' : 'Adequate',
      potassiumStatus:           soilReport.potassium < POTASSIUM_LOW_THRESHOLD  ? 'Low' : 'Adequate',
      organicRecommendations:    soilReport.recommendations?.organic,
      fertilizerRecommendations: soilReport.recommendations?.fertilizer,
    } : null;

    if (products.length === 0 && !soilContext) {
      return buildFallbackResult('FertilizerAgent', 'fertilizer');
    }

    const productList = products.map((p: any) => ({
      name:            p.name,
      type:            p.type,
      nutrientContent: p.nutrientContent,
      applicationRate: p.applicationRate,
      price:           p.price,
      suitableCrops:   p.suitableCrops,
    }));

    return {
      agent:   'FertilizerAgent',
      success: true,
      data: { products: productList, soilContext, cropName },
      summary: soilContext
        ? `Soil N: ${soilContext.nitrogenStatus}, P: ${soilContext.phosphorusStatus}, K: ${soilContext.potassiumStatus}. Recommended fertilizers: ${soilContext.fertilizerRecommendations?.join(', ') || 'See soil report'}.`
        : `Found ${products.length} fertilizer product(s)${cropName ? ` for ${cropName}` : ''}.`,
    };
  } catch (err: any) {
    log.error('FertilizerAgent error', { error: err?.message });
    return buildErrorResult('FertilizerAgent', 'fertilizer', err);
  }
}
