/**
 * TrainingDataset Model — Phase 6
 *
 * Versioned registry for speech training datasets.
 * Business logic is NEVER coupled to this model.
 * Datasets are imported, versioned, and validated here.
 * Training is triggered manually by admin — never automatically.
 *
 * Pluggable design: future STT/TTS providers read approved datasets
 * from this registry without any application code changes.
 */
import mongoose, { Document } from 'mongoose';
export type DatasetStatus = 'imported' | 'validating' | 'validated' | 'approved' | 'rejected' | 'training' | 'trained';
export interface ITranscriptEntry {
    audioFileRef: string;
    transcript: string;
    langCode: string;
    dialectCode?: string;
    duration?: number;
    validated: boolean;
    validationNote?: string;
}
export interface ITrainingDataset extends Document {
    name: string;
    version: string;
    langCode: string;
    dialectCode?: string;
    description?: string;
    status: DatasetStatus;
    totalRecordings: number;
    validatedCount: number;
    rejectedCount: number;
    transcripts: ITranscriptEntry[];
    /** External storage reference — audio files are NOT stored in MongoDB */
    storageRef?: string;
    /** Which STT/TTS provider this dataset targets */
    targetProvider?: string;
    importedBy?: string;
    approvedBy?: string;
    approvedAt?: Date;
    validationErrors: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const TrainingDataset: mongoose.Model<ITrainingDataset, {}, {}, {}, mongoose.Document<unknown, {}, ITrainingDataset, {}, {}> & ITrainingDataset & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=TrainingDataset.d.ts.map