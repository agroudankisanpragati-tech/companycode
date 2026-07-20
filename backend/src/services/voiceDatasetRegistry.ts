/**
 * Voice Dataset Registry — Phase 5
 *
 * Pluggable registry for speech training datasets.
 * Business logic (disease detection, crop advisory, etc.) is NEVER
 * coupled to this module. Datasets are registered here and referenced
 * in FarmerMemory.voiceDatasetRefs.
 *
 * Rules:
 * - No automatic retraining ever triggered from here.
 * - Datasets are registered with status 'registered'.
 * - Admin must manually approve before any downstream use.
 * - This module is a pure data registry — no ML code.
 *
 * Future voice training pipelines plug in by reading approved entries
 * from this registry without changing any business logic.
 */

import { FarmerMemory, IVoiceDatasetRef } from '../models/FarmerMemory';

export interface DatasetRegistration {
  userId: string;
  datasetId: string;
  langCode: string;
  dialectCode?: string;
  recordingCount: number;
}

/**
 * Register a new voice dataset reference for a farmer.
 * Status is always 'registered' — never auto-approved.
 */
export async function registerVoiceDataset(
  reg: DatasetRegistration
): Promise<IVoiceDatasetRef> {
  const ref: IVoiceDatasetRef = {
    datasetId: reg.datasetId,
    langCode: reg.langCode,
    dialectCode: reg.dialectCode,
    recordingCount: reg.recordingCount,
    registeredAt: new Date(),
    status: 'registered',
  };

  await FarmerMemory.updateOne(
    { userId: reg.userId },
    { $addToSet: { voiceDatasetRefs: ref } },
    { upsert: true }
  );

  return ref;
}

/**
 * Get all registered voice datasets for a farmer.
 */
export async function getVoiceDatasets(userId: string): Promise<IVoiceDatasetRef[]> {
  const memory = await FarmerMemory.findOne({ userId }).select('voiceDatasetRefs').lean();
  return (memory?.voiceDatasetRefs as IVoiceDatasetRef[]) || [];
}

/**
 * Get all approved voice datasets across all farmers for a given language.
 * Used by future training pipelines — read-only, no side effects.
 */
export async function getApprovedDatasetsByLang(
  langCode: string
): Promise<Array<{ userId: string; ref: IVoiceDatasetRef }>> {
  const memories = await FarmerMemory.find({
    'voiceDatasetRefs.langCode': langCode,
    'voiceDatasetRefs.status': 'approved',
  }).select('userId voiceDatasetRefs').lean();

  const results: Array<{ userId: string; ref: IVoiceDatasetRef }> = [];
  for (const m of memories) {
    for (const ref of (m.voiceDatasetRefs as IVoiceDatasetRef[]) || []) {
      if (ref.langCode === langCode && ref.status === 'approved') {
        results.push({ userId: m.userId, ref });
      }
    }
  }
  return results;
}

/**
 * Update dataset status (admin action only — called from admin route).
 * Only transitions: registered → pending_review → approved
 * Never triggers retraining.
 */
export async function updateDatasetStatus(
  userId: string,
  datasetId: string,
  status: IVoiceDatasetRef['status']
): Promise<boolean> {
  const result = await FarmerMemory.updateOne(
    { userId, 'voiceDatasetRefs.datasetId': datasetId },
    { $set: { 'voiceDatasetRefs.$.status': status } }
  );
  return result.modifiedCount > 0;
}
