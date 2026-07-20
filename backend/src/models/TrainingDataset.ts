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

import mongoose, { Schema, Document } from 'mongoose';

export type DatasetStatus =
  | 'imported'       // just uploaded
  | 'validating'     // transcript validation in progress
  | 'validated'      // transcripts verified
  | 'approved'       // admin approved for training
  | 'rejected'       // admin rejected
  | 'training'       // currently being used for training (external)
  | 'trained';       // training complete (external confirmation)

export interface ITranscriptEntry {
  audioFileRef: string;   // external file reference (path/URL) — not stored here
  transcript: string;
  langCode: string;
  dialectCode?: string;
  duration?: number;      // seconds
  validated: boolean;
  validationNote?: string;
}

export interface ITrainingDataset extends Document {
  name: string;
  version: string;          // semver: "1.0.0"
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

const TranscriptEntrySchema = new Schema<ITranscriptEntry>(
  {
    audioFileRef:   { type: String, required: true },
    transcript:     { type: String, required: true },
    langCode:       { type: String, required: true },
    dialectCode:    { type: String },
    duration:       { type: Number },
    validated:      { type: Boolean, default: false },
    validationNote: { type: String },
  },
  { _id: false }
);

const TrainingDatasetSchema = new Schema<ITrainingDataset>(
  {
    name:             { type: String, required: true },
    version:          { type: String, required: true, default: '1.0.0' },
    langCode:         { type: String, required: true, index: true },
    dialectCode:      { type: String },
    description:      { type: String },
    status:           {
      type: String,
      enum: ['imported','validating','validated','approved','rejected','training','trained'],
      default: 'imported',
      index: true,
    },
    totalRecordings:  { type: Number, default: 0 },
    validatedCount:   { type: Number, default: 0 },
    rejectedCount:    { type: Number, default: 0 },
    transcripts:      { type: [TranscriptEntrySchema], default: [] },
    storageRef:       { type: String },
    targetProvider:   { type: String },
    importedBy:       { type: String },
    approvedBy:       { type: String },
    approvedAt:       { type: Date },
    validationErrors: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Unique name+version per language
TrainingDatasetSchema.index({ name: 1, version: 1, langCode: 1 }, { unique: true });

export const TrainingDataset = mongoose.model<ITrainingDataset>(
  'TrainingDataset',
  TrainingDatasetSchema
);
