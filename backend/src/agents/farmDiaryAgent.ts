/**
 * Farm Diary Agent
 * Fix M7: guard against negative dayAge when sowingDate is in the future
 * Fix 9: structured logger
 */

import { MyCrop } from '../models/MyCrop';
import { CropTask } from '../models/CropTask';
import { AgentContext, AgentResult } from './types';
import { buildFallbackResult, buildErrorResult } from '../services/fallbackManager';
import { createLogger } from '../utils/logger';

const log = createLogger('farmDiaryAgent');

export async function runFarmDiaryAgent(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { userId, pageData } = ctx;

    if (pageData?.farmDiaryData) {
      const f = pageData.farmDiaryData;
      return {
        agent: 'FarmDiaryAgent', success: true, data: f,
        summary: `Active crop: ${f.cropName}, Day ${f.dayAge} (${f.stage} stage). Today's tasks: ${(f.todayTasks || []).join(', ') || 'None scheduled'}.`,
      };
    }

    const activeCrops = await MyCrop.find({ farmerId: userId, status: 'active' })
      .sort({ sowingDate: -1 })
      .limit(3)
      .lean();

    if (activeCrops.length === 0) return buildFallbackResult('FarmDiaryAgent', 'general', 'No active crops found. Guide the farmer to add crops in the My Crops section.');

    const primaryCrop = activeCrops[0] as any;
    const today       = new Date();
    const sowingDate  = new Date(primaryCrop.sowingDate);

    // Fix M7: guard negative dayAge
    const rawDayAge = Math.floor((today.getTime() - sowingDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayAge    = rawDayAge < 0 ? 0 : rawDayAge;

    if (rawDayAge < 0) {
      log.warn('FarmDiaryAgent: sowingDate is in the future', { userId, sowingDate: primaryCrop.sowingDate });
    }

    const todayTasks = await CropTask.find({
      myCropId: primaryCrop._id,
      status:   { $in: ['pending', 'due'] },
    }).sort({ scheduledDate: 1 }).limit(5).lean();

    const cropSummary = {
      cropName:            primaryCrop.cropName,
      variety:             primaryCrop.variety,
      dayAge,
      sowingDate:          primaryCrop.sowingDate,
      expectedHarvestDate: primaryCrop.expectedHarvestDate,
      fieldArea:           primaryCrop.fieldArea,
      status:              primaryCrop.status,
      todayTasks:          todayTasks.map((t: any) => ({
        title: t.title, description: t.description,
        taskType: t.taskType, scheduledDate: t.scheduledDate,
      })),
      allActiveCrops: activeCrops.map((c: any) => c.cropName),
    };

    return {
      agent: 'FarmDiaryAgent', success: true, data: cropSummary,
      summary: `Active crop: ${primaryCrop.cropName}, Day ${dayAge}. Pending tasks: ${todayTasks.length}. Tasks: ${todayTasks.slice(0, 2).map((t: any) => t.title).join(', ') || 'None'}.`,
    };
  } catch (err: any) {
    log.error('FarmDiaryAgent error', { error: err?.message });
    return buildErrorResult('FarmDiaryAgent', 'general', err);
  }
}
