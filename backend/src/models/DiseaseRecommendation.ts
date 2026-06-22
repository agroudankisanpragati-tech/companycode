import mongoose, { Schema, Document } from 'mongoose';

export interface IDiseaseRecommendation extends Document {
  userId?: string;
  cropName: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: string;
  symptoms: string;
  treatment: string;
  prevention: string;
  description: string;
  imageUrl?: string;
  source: 'cache' | 'knowledge_base' | 'ai';
  similarityScore?: number;
  feedback?: 'helpful' | 'not_helpful' | null;
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
    treatment: { type: String },
    prevention: { type: String },
    description: { type: String },
    imageUrl: { type: String },
    source: { type: String, enum: ['cache', 'knowledge_base', 'ai'], default: 'ai' },
    similarityScore: { type: Number },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
  },
  { timestamps: true }
);

DiseaseRecommendationSchema.index({ cropName: 1, diseaseName: 1 });

export const DiseaseRecommendation = mongoose.model<IDiseaseRecommendation>(
  'DiseaseRecommendation',
  DiseaseRecommendationSchema
);
