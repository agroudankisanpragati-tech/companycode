import mongoose, { Schema, Document } from 'mongoose';

export interface IDiseaseRecommendation extends Document {
  userId?: string;
  cropName: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: string;
  symptoms: string;
  organicTreatment: string;
  chemicalTreatment: string;
  treatment: string;            // combined fallback
  prevention: string;
  description: string;
  recommendedActions?: string;
  confidenceScore?: number;
  imageUrl?: string;
  source: 'cache' | 'knowledge_base' | 'ai';
  similarityScore?: number;
  knowledgeBaseId?: string;     // linked KB entry if matched
  feedback?: 'helpful' | 'not_helpful' | null;
  translations?: Record<string, Record<string, any>>;
  createdAt: Date;
  updatedAt: Date;
}

const DiseaseRecommendationSchema = new Schema<IDiseaseRecommendation>(
  {
    userId: { type: String, index: true },
    cropName: { type: String, required: true, index: true },
    diseaseName: { type: String, required: true },
    diseaseType: { type: String },
    severityLevel: { type: String },
    symptoms: { type: String },
    organicTreatment: { type: String },
    chemicalTreatment: { type: String },
    treatment: { type: String },
    prevention: { type: String },
    description: { type: String },
    recommendedActions: { type: String },
    confidenceScore: { type: Number },
    imageUrl: { type: String },
    source: { type: String, enum: ['cache', 'knowledge_base', 'ai'], default: 'ai' },
    similarityScore: { type: Number },
    knowledgeBaseId: { type: String },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
    translations: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DiseaseRecommendationSchema.index({ cropName: 1, diseaseName: 1 });

export const DiseaseRecommendation = mongoose.model<IDiseaseRecommendation>(
  'DiseaseRecommendation',
  DiseaseRecommendationSchema
);
