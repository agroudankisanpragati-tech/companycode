// =============================================================================
// AKP — Agroudan Kisan Pragati
// Model: CropMismatchLog
// Purpose: Persists crop verification mismatches for future model improvement.
//          Requirement 11: Log crop mismatches for future model improvement.
// =============================================================================

import mongoose, { Document, Schema } from 'mongoose';

export interface ICropMismatchLog extends Document {
  farmerCrop:    string;
  predictedCrop: string;
  confidence:    number;
  imageUrl?:     string;
  userId?:       string;
  createdAt:     Date;
}

const CropMismatchLogSchema = new Schema<ICropMismatchLog>(
  {
    farmerCrop:    { type: String, required: true, index: true },
    predictedCrop: { type: String, required: true, index: true },
    confidence:    { type: Number, required: true },
    imageUrl:      { type: String },
    userId:        { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CropMismatchLog = mongoose.model<ICropMismatchLog>(
  'CropMismatchLog',
  CropMismatchLogSchema
);
