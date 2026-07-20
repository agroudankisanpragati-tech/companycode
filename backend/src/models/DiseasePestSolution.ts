import mongoose, { Schema, Document } from 'mongoose';

export interface IDiseasePestSolution extends Document {
  cropName: string;
  recordType: 'Disease' | 'Pest' | 'Deficiency' | 'Healthy';
  diseasePestName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  symptoms?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  urgentPrevention?: string;
  recoveryTips?: string;
  preventiveMeasures?: string;
  dos?: string;
  donts?: string;
  recommendedProducts?: string;
  farmerAdvice?: string;
  referenceImages: string[];
  tags: string[];
  keywords: string[];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const DiseasePestSolutionSchema = new Schema<IDiseasePestSolution>(
  {
    cropName:          { type: String, required: true, index: true },
    recordType:        { type: String, enum: ['Disease','Pest','Deficiency','Healthy'], required: true },
    diseasePestName:   { type: String, required: true, index: true },
    severity:          { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
    description:       { type: String },
    symptoms:          { type: String },
    organicSolution:   { type: String },
    chemicalSolution:  { type: String },
    urgentPrevention:  { type: String },
    recoveryTips:      { type: String },
    preventiveMeasures:{ type: String },
    dos:               { type: String },
    donts:             { type: String },
    recommendedProducts:{ type: String },
    farmerAdvice:      { type: String },
    referenceImages:   [{ type: String }],
    tags:              [{ type: String }],
    keywords:          [{ type: String }],
    status:            { type: String, enum: ['draft','published'], default: 'published' },
  },
  { timestamps: true, collection: 'diseasepestsolutions' }
);

DiseasePestSolutionSchema.index({ cropName: 1, diseasePestName: 1 }, { unique: true });

export const DiseasePestSolution = mongoose.model<IDiseasePestSolution>(
  'DiseasePestSolution',
  DiseasePestSolutionSchema
);
