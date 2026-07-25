/**
 * Soil Agent
 * Domain: Soil health analysis, deficiencies, fertilizer recommendations
 * Data sources: ctx.shared.soilReport (pre-loaded) → SoilReport MongoDB fallback
 *
 * Fix 8: reads SoilReport from ctx.shared — no duplicate DB query.
 *        FertilizerAgent also reads from ctx.shared, so for soil/crop intents
 *        that run both agents in parallel, only ONE DB query is made total.
 */

import { SoilReport } from '../models/SoilReport';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('soilAgent');

export async function runSoilAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, pageData, shared } = ctx;

    // If soil data is already on the page, use it directly
    if (pageData?.soilData) {
      const s = pageData.soilData;
      return {
        agent:   'SoilAgent',
        success: true,
        data:    s,
        summary: `Soil Health Score: ${s.healthScore}/100 (${s.healthStatus}). pH: ${s.ph}. N: ${s.nitrogen}, P: ${s.phosphorus}, K: ${s.potassium}. Recommendations: ${s.recommendations || 'See soil report.'}`,
      };
    }

    // Fix 8: use pre-loaded shared context first
    let report: any = shared?.soilReport || null;

    // Only query DB if shared context was not loaded (degraded path)
    if (!report) {
      log.debug('SoilAgent: shared context missing, querying DB directly', { userId });
      report = await SoilReport.findOne({ farmerId: userId })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!report) {
      return buildFallbackResult('SoilAgent', 'soil');
    }

    const r = report as any;
    return {
      agent:   'SoilAgent',
      success: true,
      data: {
        soilType:                  r.soilType,
        healthScore:               r.soilHealthScore,
        healthStatus:              r.soilHealthStatus,
        ph:                        r.pH,
        nitrogen:                  r.nitrogen,
        phosphorus:                r.phosphorus,
        potassium:                 r.potassium,
        organicCarbon:             r.organicCarbon,
        deficiencies:              r.deficiencies,
        organicRecommendations:    r.recommendations?.organic,
        fertilizerRecommendations: r.recommendations?.fertilizer,
        reasoning:                 r.recommendations?.reasoning,
        cropRecommendations:       r.cropRecommendations,
      },
      summary: `Soil: ${r.soilType || 'Unknown'}, Score: ${r.soilHealthScore}/100 (${r.soilHealthStatus}). pH: ${r.pH}. Deficiencies: ${(r.deficiencies || []).map((d: any) => d.nutrient).join(', ') || 'None detected'}.`,
    };
  } catch (err: any) {
    log.error('SoilAgent error', { error: err?.message });
    return buildErrorResult('SoilAgent', 'soil', err);
  }
}
