/**
 * Irrigation Agent
 * Fix 2: reads crop/irrigation type from ctx.entities
 * Fix M10: IrrigationSchedule query scoped to farmerId (data isolation bug fixed)
 */

import { IrrigationSchedule } from '../models/IrrigationSchedule';
import { SoilMoisture } from '../models/SoilMoisture';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';
import { createSafeRegex } from '../utils/regex';

const log = createLogger('irrigationAgent');

export async function runIrrigationAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, pageData, entities } = ctx;

    if (pageData?.irrigationData) {
      const d = pageData.irrigationData;
      return {
        agent: 'IrrigationAgent', success: true, data: d,
        summary: `Irrigation for ${d.cropName || 'crop'}: ${d.irrigationMethod || 'N/A'}, every ${d.intervalDays || 'N/A'} days.`,
      };
    }

    const cropName       = entities?.crop || '';
    const irrigationType = entities?.irrigation || '';

    log.debug('IrrigationAgent running', { cropName, irrigationType, userId });

    // Fix M10: scope to farmerId — previously returned any farmer's schedule
    const filter: any = { farmerId: userId };
    if (cropName)       filter.cropName        = createSafeRegex(cropName);
    if (irrigationType) filter.irrigationMethod = createSafeRegex(irrigationType);

    const schedule = await IrrigationSchedule.findOne(filter).lean();

    if (schedule) {
      const s = schedule as any;
      return {
        agent: 'IrrigationAgent', success: true,
        data: {
          cropName: s.cropName, irrigationMethod: s.irrigationMethod,
          intervalDays: s.intervalDays, waterAmount: s.waterAmount,
          growthStage: s.growthStage, notes: s.notes,
        },
        summary: `Irrigation for ${s.cropName}: ${s.irrigationMethod}, every ${s.intervalDays} days, ${s.waterAmount} water.`,
      };
    }

    const moisture = await SoilMoisture.findOne({ farmerId: userId }).sort({ createdAt: -1 }).lean();

    if (moisture) {
      const m   = moisture as any;
      const pct = m.moisturePercent;
      const recommendation =
        pct < 30 ? 'Soil moisture is low — irrigate immediately.' :
        pct > 70 ? 'Soil moisture is adequate — delay irrigation.' :
                   'Soil moisture is moderate — monitor and irrigate as needed.';
      return {
        agent: 'IrrigationAgent', success: true,
        data: { soilMoisturePercent: pct, soilMoistureStatus: m.status, recommendation },
        summary: `Soil moisture: ${pct}% (${m.status}). ${pct < 30 ? 'Irrigate immediately.' : 'Monitor moisture levels.'}`,
      };
    }

    return buildFallbackResult('IrrigationAgent', 'irrigation');
  } catch (err: any) {
    log.error('IrrigationAgent error', { error: err?.message });
    return buildErrorResult('IrrigationAgent', 'irrigation', err);
  }
}
