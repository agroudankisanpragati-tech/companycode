import mongoose, { Schema, Document } from 'mongoose';

export interface IDiseaseKnowledgeBase extends Document {
  cropName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  leafSymptoms?: string;
  stemSymptoms?: string;
  rootSymptoms?: string;
  fruitSymptoms?: string;
  symptomsDescription?: string;
  organicTreatment?: string;
  chemicalTreatment?: string;
  recommendedProducts?: string;
  treatmentDescription?: string;
  preventionMethods?: string;
  preventionDescription?: string;
  recommendedActions?: string;
  diseaseImages: string[];
  healthyImages: string[];
  // Self-learning fields
  source: 'admin' | 'ai_auto' | 'ai_verified';
  confidenceScore: number;       // avg confidence from AI (0-100)
  scanCount: number;             // how many times matched/used
  helpfulCount: number;          // positive feedback count
  notHelpfulCount: number;       // negative feedback count
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DiseaseKnowledgeBaseSchema = new Schema<IDiseaseKnowledgeBase>(
  {
    cropName: { type: String, required: true, index: true },
    scientificName: { type: String },
    cropCategory: { type: String, default: 'General' },
    diseaseName: { type: String, required: true, index: true },
    diseaseType: { type: String, required: true },
    severityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    description: { type: String, required: true },
    leafSymptoms: { type: String },
    stemSymptoms: { type: String },
    rootSymptoms: { type: String },
    fruitSymptoms: { type: String },
    symptomsDescription: { type: String },
    organicTreatment: { type: String },
    chemicalTreatment: { type: String },
    recommendedProducts: { type: String },
    treatmentDescription: { type: String },
    preventionMethods: { type: String },
    preventionDescription: { type: String },
    recommendedActions: { type: String },
    diseaseImages: [{ type: String }],
    healthyImages: [{ type: String }],
    source: { type: String, enum: ['admin', 'ai_auto', 'ai_verified'], default: 'admin' },
    confidenceScore: { type: Number, default: 0 },
    scanCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DiseaseKnowledgeBaseSchema.index({ cropName: 1, diseaseName: 1 }, { unique: true });

export const DiseaseKnowledgeBase = mongoose.model<IDiseaseKnowledgeBase>(
  'DiseaseKnowledgeBase',
  DiseaseKnowledgeBaseSchema
);
