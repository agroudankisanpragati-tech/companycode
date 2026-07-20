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
import { TrainingDataset, DatasetStatus } from '../models/TrainingDataset';
export interface DatasetImportInput {
    name: string;
    langCode: string;
    dialectCode?: string;
    description?: string;
    targetProvider?: string;
    storageRef?: string;
    importedBy: string;
    transcripts: Array<{
        audioFileRef: string;
        transcript: string;
        langCode?: string;
        dialectCode?: string;
        duration?: number;
    }>;
}
/**
 * Import a new dataset version.
 * Auto-increments version if name+lang already exists.
 */
export declare function importDataset(input: DatasetImportInput): Promise<typeof TrainingDataset.prototype>;
export interface ValidationResult {
    datasetId: string;
    totalChecked: number;
    validatedCount: number;
    rejectedCount: number;
    errors: string[];
}
/**
 * Validate transcripts in a dataset.
 * Checks: non-empty, minimum length, no placeholder text.
 * Does NOT train anything — only marks transcripts as validated/rejected.
 */
export declare function validateDataset(datasetId: string): Promise<ValidationResult>;
/**
 * Admin approves a validated dataset for training.
 * Only 'validated' datasets can be approved.
 * Does NOT trigger training — that is an external process.
 */
export declare function approveDataset(datasetId: string, adminUserId: string): Promise<void>;
/**
 * Admin rejects a dataset.
 */
export declare function rejectDataset(datasetId: string, adminUserId: string, reason?: string): Promise<void>;
export declare function listDatasets(filters: {
    langCode?: string;
    status?: DatasetStatus;
    page?: number;
    limit?: number;
}): Promise<{
    data: any[];
    total: number;
}>;
/**
 * Get all approved datasets for a language.
 * Used by external training pipelines — read-only.
 */
export declare function getApprovedDatasets(langCode: string): Promise<any[]>;
/**
 * Sync approved voice dataset refs from FarmerMemory into TrainingDataset.
 * Called periodically or on admin trigger — never automatically.
 */
export declare function syncFarmerVoiceDatasets(): Promise<{
    synced: number;
}>;
//# sourceMappingURL=trainingPipeline.d.ts.map