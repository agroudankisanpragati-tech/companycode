import mongoose, { Schema, Document } from 'mongoose';

export interface IActiveCrop extends Document {
  farmerId: string;
  myCropId: string;       // reference to MyCrop
  cropName: string;
  fieldLabel: string;     // "Field 1", "Field 2", etc.
  sowingDate: Date;
  growingDurationDays: number;
  currentStage: string;
  progressPercent: number;
  isHarvested: boolean;
  harvestDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IActiveCrop>(
  {
    farmerId:             { type: String, required: true, index: true },
    myCropId:             { type: String, required: true },
    cropName:             { type: String, required: true },
    fieldLabel:           { type: String, default: 'Field 1' },
    sowingDate:           { type: Date,   required: true },
    growingDurationDays:  { type: Number, required: true },
    currentStage:         { type: String, default: 'Germination' },
    progressPercent:      { type: Number, default: 0 },
    isHarvested:          { type: Boolean, default: false },
    harvestDate:          { type: Date },
    notes:                { type: String },
  },
  { timestamps: true }
);

export const ActiveCrop = mongoose.model<IActiveCrop>('ActiveCrop', schema);
