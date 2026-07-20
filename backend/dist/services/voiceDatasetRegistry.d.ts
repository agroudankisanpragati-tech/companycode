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
import { IVoiceDatasetRef } from '../models/FarmerMemory';
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
export declare function registerVoiceDataset(reg: DatasetRegistration): Promise<IVoiceDatasetRef>;
/**
 * Get all registered voice datasets for a farmer.
 */
export declare function getVoiceDatasets(userId: string): Promise<IVoiceDatasetRef[]>;
/**
 * Get all approved voice datasets across all farmers for a given language.
 * Used by future training pipelines — read-only, no side effects.
 */
export declare function getApprovedDatasetsByLang(langCode: string): Promise<Array<{
    userId: string;
    ref: IVoiceDatasetRef;
}>>;
/**
 * Update dataset status (admin action only — called from admin route).
 * Only transitions: registered → pending_review → approved
 * Never triggers retraining.
 */
export declare function updateDatasetStatus(userId: string, datasetId: string, status: IVoiceDatasetRef['status']): Promise<boolean>;
//# sourceMappingURL=voiceDatasetRegistry.d.ts.map