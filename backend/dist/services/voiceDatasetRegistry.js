"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVoiceDataset = registerVoiceDataset;
exports.getVoiceDatasets = getVoiceDatasets;
exports.getApprovedDatasetsByLang = getApprovedDatasetsByLang;
exports.updateDatasetStatus = updateDatasetStatus;
const FarmerMemory_1 = require("../models/FarmerMemory");
/**
 * Register a new voice dataset reference for a farmer.
 * Status is always 'registered' — never auto-approved.
 */
async function registerVoiceDataset(reg) {
    const ref = {
        datasetId: reg.datasetId,
        langCode: reg.langCode,
        dialectCode: reg.dialectCode,
        recordingCount: reg.recordingCount,
        registeredAt: new Date(),
        status: 'registered',
    };
    await FarmerMemory_1.FarmerMemory.updateOne({ userId: reg.userId }, { $addToSet: { voiceDatasetRefs: ref } }, { upsert: true });
    return ref;
}
/**
 * Get all registered voice datasets for a farmer.
 */
async function getVoiceDatasets(userId) {
    const memory = await FarmerMemory_1.FarmerMemory.findOne({ userId }).select('voiceDatasetRefs').lean();
    return memory?.voiceDatasetRefs || [];
}
/**
 * Get all approved voice datasets across all farmers for a given language.
 * Used by future training pipelines — read-only, no side effects.
 */
async function getApprovedDatasetsByLang(langCode) {
    const memories = await FarmerMemory_1.FarmerMemory.find({
        'voiceDatasetRefs.langCode': langCode,
        'voiceDatasetRefs.status': 'approved',
    }).select('userId voiceDatasetRefs').lean();
    const results = [];
    for (const m of memories) {
        for (const ref of m.voiceDatasetRefs || []) {
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
async function updateDatasetStatus(userId, datasetId, status) {
    const result = await FarmerMemory_1.FarmerMemory.updateOne({ userId, 'voiceDatasetRefs.datasetId': datasetId }, { $set: { 'voiceDatasetRefs.$.status': status } });
    return result.modifiedCount > 0;
}
//# sourceMappingURL=voiceDatasetRegistry.js.map