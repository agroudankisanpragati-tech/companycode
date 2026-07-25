/**
 * Crop Agent
 * Domain: Crop advisory, recommendations, cultivation guidance
 * Data sources: CropKnowledgeBase (via knowledgeBaseSearch), FarmerCropRequest history
 *
 * Fix 2: reads crop name from ctx.entities (pre-extracted) — no local parsing
 * Fix 8: reads soilType from ctx.shared.soilReport — no duplicate DB query
 */

import { FarmerCropRequest } from '../models/FarmerCropRequest';
import { AgentContext, AgentResult } from './types';
import { searchCropKB } from '../services/knowledgeBaseSearch';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('cropAgent');

export async function runCropAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, pageData, farmerProfile, entities, shared } = ctx;

    // Fix 2: use pre-extracted entity, fall back to pageData
    const cropName =
      pageData?.cropData?.cropName ||
      entities?.crop ||
      '';

    // Fix 8: read soilType from shared context — no extra DB query
    const soilType =
      shared?.soilReport?.soilType ||
      farmerProfile?.soilType ||
      '';

    const season = entities?.season || '';

    log.debug('CropAgent running', { cropName, soilType, season });

    if (cropName) {
      const kbResult = await searchCropKB(cropName, soilType, season);
      if (kbResult.found) {
        return {
          agent:   'CropAgent',
          success: true,
          data:    kbResult.data,
          summary: kbResult.summary,
        };
      }
    }

    // Fallback: farmer's most recent crop request for context
    const lastRequest = await FarmerCropRequest.findOne({ farmerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (lastRequest) {
      return {
        agent:   'CropAgent',
        success: true,
        data: {
          lastRequestSoilType: lastRequest.soilType,
          lastRequestSeason:   lastRequest.season,
          lastRequestDistrict: lastRequest.district,
          lastRequestState:    lastRequest.state,
        },
        summary: `Farmer's last crop request: ${lastRequest.soilType} soil, ${lastRequest.season} season in ${lastRequest.district}, ${lastRequest.state}.`,
      };
    }

    return buildFallbackResult('CropAgent', 'crop');
  } catch (err: any) {
    log.error('CropAgent error', { error: err?.message });
    return buildErrorResult('CropAgent', 'crop', err);
  }
}
