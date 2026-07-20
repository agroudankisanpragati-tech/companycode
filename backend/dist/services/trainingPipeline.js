"use strict";
/**
 * Training Pipeline Service — Phase 6
 *
 * Handles speech dataset lifecycle:
 *   Import → Version → Validate → Admin Approve → Ready for Training
 *
 * Rules:
 * - NEVER triggers model retraining automatically.
 * - NEVER modifies business logic (disease detection, crop advisory, etc.).
 * - Datasets are versioned using semver (1.0.0, 1.1.0, …).
 * - Validation checks transcript quality — does not train anything.
 * - Admin must explicitly approve before a dataset is marked 'approved'.
 * - Future training pipelines plug in by reading 'approved' datasets.
 *
 * Audio files are stored externally (filesystem/S3/GCS).
 * Only metadata and transcripts are stored in MongoDB.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.importDataset = importDataset;
exports.validateDataset = validateDataset;
exports.approveDataset = approveDataset;
exports.rejectDataset = rejectDataset;
exports.listDatasets = listDatasets;
exports.getApprovedDatasets = getApprovedDatasets;
exports.syncFarmerVoiceDatasets = syncFarmerVoiceDatasets;
const TrainingDataset_1 = require("../models/TrainingDataset");
const FarmerMemory_1 = require("../models/FarmerMemory");
/**
 * Import a new dataset version.
 * Auto-increments version if name+lang already exists.
 */
async function importDataset(input) {
    // Find latest version for this name+lang
    const latest = await TrainingDataset_1.TrainingDataset.findOne({ name: input.name, langCode: input.langCode })
        .sort({ version: -1 })
        .lean();
    const version = latest ? bumpVersion(latest.version) : '1.0.0';
    const transcripts = input.transcripts.map(t => ({
        audioFileRef: t.audioFileRef,
        transcript: t.transcript.trim(),
        langCode: t.langCode || input.langCode,
        dialectCode: t.dialectCode || input.dialectCode,
        duration: t.duration,
        validated: false,
    }));
    const dataset = await TrainingDataset_1.TrainingDataset.create({
        name: input.name,
        version,
        langCode: input.langCode,
        dialectCode: input.dialectCode,
        description: input.description,
        targetProvider: input.targetProvider,
        storageRef: input.storageRef,
        importedBy: input.importedBy,
        totalRecordings: transcripts.length,
        transcripts,
        status: 'imported',
    });
    return dataset;
}
/**
 * Validate transcripts in a dataset.
 * Checks: non-empty, minimum length, no placeholder text.
 * Does NOT train anything — only marks transcripts as validated/rejected.
 */
async function validateDataset(datasetId) {
    const dataset = await TrainingDataset_1.TrainingDataset.findById(datasetId);
    if (!dataset)
        throw new Error('Dataset not found');
    if (!['imported', 'validating'].includes(dataset.status)) {
        throw new Error(`Cannot validate dataset in status: ${dataset.status}`);
    }
    await TrainingDataset_1.TrainingDataset.findByIdAndUpdate(datasetId, { status: 'validating' });
    const errors = [];
    let validatedCount = 0;
    let rejectedCount = 0;
    const updatedTranscripts = dataset.transcripts.map((t, idx) => {
        const issues = [];
        if (!t.transcript?.trim()) {
            issues.push(`Entry ${idx}: empty transcript`);
        }
        else if (t.transcript.trim().length < 3) {
            issues.push(`Entry ${idx}: transcript too short (< 3 chars)`);
        }
        else if (/^(test|todo|placeholder|xxx|tbd)$/i.test(t.transcript.trim())) {
            issues.push(`Entry ${idx}: placeholder transcript detected`);
        }
        else if (!t.audioFileRef?.trim()) {
            issues.push(`Entry ${idx}: missing audio file reference`);
        }
        if (issues.length > 0) {
            errors.push(...issues);
            rejectedCount++;
            return { ...t, validated: false, validationNote: issues.join('; ') };
        }
        validatedCount++;
        return { ...t, validated: true };
    });
    const finalStatus = errors.length === 0 ? 'validated' : 'imported';
    await TrainingDataset_1.TrainingDataset.findByIdAndUpdate(datasetId, {
        transcripts: updatedTranscripts,
        validatedCount,
        rejectedCount,
        validationErrors: errors,
        status: finalStatus,
    });
    return {
        datasetId,
        totalChecked: dataset.transcripts.length,
        validatedCount,
        rejectedCount,
        errors,
    };
}
// ─── Admin approval ───────────────────────────────────────────────────────────
/**
 * Admin approves a validated dataset for training.
 * Only 'validated' datasets can be approved.
 * Does NOT trigger training — that is an external process.
 */
async function approveDataset(datasetId, adminUserId) {
    const dataset = await TrainingDataset_1.TrainingDataset.findById(datasetId);
    if (!dataset)
        throw new Error('Dataset not found');
    if (dataset.status !== 'validated') {
        throw new Error(`Dataset must be in 'validated' status to approve. Current: ${dataset.status}`);
    }
    await TrainingDataset_1.TrainingDataset.findByIdAndUpdate(datasetId, {
        status: 'approved',
        approvedBy: adminUserId,
        approvedAt: new Date(),
    });
}
/**
 * Admin rejects a dataset.
 */
async function rejectDataset(datasetId, adminUserId, reason) {
    const dataset = await TrainingDataset_1.TrainingDataset.findById(datasetId);
    if (!dataset)
        throw new Error('Dataset not found');
    await TrainingDataset_1.TrainingDataset.findByIdAndUpdate(datasetId, {
        status: 'rejected',
        approvedBy: adminUserId,
        validationErrors: reason ? [reason] : dataset.validationErrors,
    });
}
// ─── Dataset listing ──────────────────────────────────────────────────────────
async function listDatasets(filters) {
    const { langCode, status, page = 1, limit = 20 } = filters;
    const filter = {};
    if (langCode)
        filter.langCode = langCode;
    if (status)
        filter.status = status;
    const [data, total] = await Promise.all([
        TrainingDataset_1.TrainingDataset.find(filter)
            .select('-transcripts') // exclude large transcript array from list
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        TrainingDataset_1.TrainingDataset.countDocuments(filter),
    ]);
    return { data, total };
}
/**
 * Get all approved datasets for a language.
 * Used by external training pipelines — read-only.
 */
async function getApprovedDatasets(langCode) {
    return TrainingDataset_1.TrainingDataset.find({ langCode, status: 'approved' })
        .select('name version langCode dialectCode storageRef totalRecordings validatedCount targetProvider approvedAt')
        .lean();
}
// ─── Sync voice dataset refs from FarmerMemory ───────────────────────────────
/**
 * Sync approved voice dataset refs from FarmerMemory into TrainingDataset.
 * Called periodically or on admin trigger — never automatically.
 */
async function syncFarmerVoiceDatasets() {
    const memories = await FarmerMemory_1.FarmerMemory.find({
        'voiceDatasetRefs.status': 'approved',
    }).select('userId voiceDatasetRefs').lean();
    let synced = 0;
    for (const memory of memories) {
        for (const ref of (memory.voiceDatasetRefs || [])) {
            if (ref.status !== 'approved')
                continue;
            try {
                await TrainingDataset_1.TrainingDataset.updateOne({ name: `farmer-${memory.userId}`, version: '1.0.0', langCode: ref.langCode }, {
                    $setOnInsert: {
                        name: `farmer-${memory.userId}`,
                        version: '1.0.0',
                        langCode: ref.langCode,
                        dialectCode: ref.dialectCode,
                        description: `Farmer voice dataset from memory registry`,
                        storageRef: ref.datasetId,
                        totalRecordings: ref.recordingCount,
                        status: 'imported',
                        importedBy: 'system-sync',
                    },
                }, { upsert: true });
                synced++;
            }
            catch {
                // Duplicate — already synced
            }
        }
    }
    return { synced };
}
// ─── Semver bump ──────────────────────────────────────────────────────────────
function bumpVersion(version) {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN))
        return '1.0.0';
    parts[2]++; // bump patch
    return parts.join('.');
}
//# sourceMappingURL=trainingPipeline.js.map