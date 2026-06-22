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
  diseaseImages: string[];
  healthyImages: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DiseaseKnowledgeBaseSchema = new Schema<IDiseaseKnowledgeBase>(
  {
    cropName: { type: String, required: true, index: true },
    scientificName: { type: String },
    cropCategory: { type: String, required: true },
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
    diseaseImages: [{ type: String }],
    healthyImages: [{ type: String }],
  },
  { timestamps: true }
);

export const DiseaseKnowledgeBase = mongoose.model<IDiseaseKnowledgeBase>(
  'DiseaseKnowledgeBase',
  DiseaseKnowledgeBaseSchema
);
