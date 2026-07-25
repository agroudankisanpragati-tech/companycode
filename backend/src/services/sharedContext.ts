/**
 * Shared Request Context
 *
 * Loads all per-farmer data ONCE per request and stores it on AgentContext.
 * Every agent reads from ctx.shared — no agent queries the same document twice.
 *
 * Eliminates duplicate DB queries:
 *   BEFORE: SoilAgent + FertilizerAgent each called SoilReport.findOne()
 *           → 2 identical queries per soil/crop intent
 *   AFTER:  loadSharedContext() runs once, both agents read ctx.shared.soilReport
 *
 * Also eliminates the duplicate FarmerProfileData query that existed in
 * pragatiAI.ts (buildFarmerContext) and aiAssistant.ts separately.
 *
 * Non-fatal: if any query fails, that field is null and agents degrade gracefully.
 */

import { SoilReport, ISoilReport } from '../models/SoilReport';
import { FarmerProfileData, IFarmerProfileData } from '../models/FarmerProfileData';
import { MyCrop } from '../models/MyCrop';
import { createLogger } from '../utils/logger';

const log = createLogger('sharedContext');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SharedFarmerContext {
  /** Latest soil report — null if not found or query failed */
  soilReport: ISoilReport | null;
  /** Extended farmer profile — null if not found */
  farmerProfile: IFarmerProfileData | null;
  /** Active crops (up to 5) — empty array if none */
  activeCrops: Array<{ cropName: string; variety?: string; sowingDate?: Date; status: string }>;
  /** Whether the shared context was successfully loaded */
  loaded: boolean;
  /** Timestamp of load (for cache invalidation if needed) */
  loadedAt: Date;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load all shared farmer data in parallel.
 * Called once per request in pragatiAIController before agents run.
 * Result is stored on AgentContext.shared and reused by every agent.
 */
export async function loadSharedContext(userId: string): Promise<SharedFarmerContext> {
  const defaultCtx: SharedFarmerContext = {
    soilReport:    null,
    farmerProfile: null,
    activeCrops:   [],
    loaded:        false,
    loadedAt:      new Date(),
  };

  if (!userId) return defaultCtx;

  try {
    const [soilReport, farmerProfile, activeCrops] = await Promise.all([
      SoilReport.findOne({ farmerId: userId })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => null),

      FarmerProfileData.findOne({ userId })
        .select('district state soilType totalArea farmingType waterAvailability cropHistory village')
        .lean()
        .catch(() => null),

      MyCrop.find({ farmerId: userId, status: 'active' })
        .select('cropName variety sowingDate status')
        .sort({ sowingDate: -1 })
        .limit(5)
        .lean()
        .catch(() => []),
    ]);

    log.debug('Shared context loaded', {
      userId,
      hasSoilReport:    !!soilReport,
      hasFarmerProfile: !!farmerProfile,
      activeCropCount:  (activeCrops as any[]).length,
    });

    return {
      soilReport:    soilReport as ISoilReport | null,
      farmerProfile: farmerProfile as IFarmerProfileData | null,
      activeCrops:   (activeCrops as any[]).map(c => ({
        cropName:   c.cropName,
        variety:    c.variety,
        sowingDate: c.sowingDate,
        status:     c.status,
      })),
      loaded:    true,
      loadedAt:  new Date(),
    };
  } catch (err: any) {
    log.warn('loadSharedContext failed (non-fatal)', { userId, error: err?.message });
    return defaultCtx;
  }
}
