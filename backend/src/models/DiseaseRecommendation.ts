import mongoose, { Schema, Document } from 'mongoose';

export interface IYoloTop5 {
  rank: number;
  class_name: string;
  confidence: number;
  category: string;
}

export interface IDiseaseRecommendation extends Document {
  userId?: string;
  cropName: string;
  diseaseName: string;
  diseaseType: string;
  severityLevel: string;
  // Advisory text fields — stored as { en, hi } objects (Mixed) for offline multilingual
  symptoms: any;
  organicTreatment: any;
  chemicalTreatment: any;
  treatment: any;
  prevention: any;
  description: any;
  recommendedActions?: any;
  urgentPrevention?: any;
  recoveryTips?: any;
  dos?: any;
  donts?: any;
  recommendedProducts?: any;
  recommendedFertilizer?: any;
  recommendedBioProduct?: any;
  recommendedOrganicProduct?: any;
  extraFarmerAdvice?: any;
  suitableWeather?: any;
  diseaseImages?: string[];
  tags?: string[];
  confidenceScore?: number;
  imageUrl?: string;
  source: 'cache' | 'knowledge_base' | 'ai' | 'yolo';
  predictionSource: string;
  yoloTop5?: IYoloTop5[];
  similarityScore?: number;
  knowledgeBaseId?: string;
  feedback?: 'helpful' | 'not_helpful' | null;
  comment?: string;
  correctDisease?: string;
  translations?: Record<string, Record<string, any>>;
  createdAt: Date;
  updatedAt: Date;
}

const mlField = { type: Schema.Types.Mixed };

const DiseaseRecommendationSchema = new Schema<IDiseaseRecommendation>(
  {
    userId: { type: String, index: true },
    cropName: { type: String, required: true, index: true },
    diseaseName: { type: String, required: true },
    diseaseType: { type: String },
    severityLevel: { type: String },
    // Advisory text — Mixed so { en, hi } objects are stored as-is
    symptoms:           mlField,
    organicTreatment:   mlField,
    chemicalTreatment:  mlField,
    treatment:          mlField,
    prevention:         mlField,
    description:        mlField,
    recommendedActions: mlField,
    urgentPrevention:          mlField,
    recoveryTips:              mlField,
    dos:                       mlField,
    donts:                     mlField,
    recommendedProducts:       mlField,
    recommendedFertilizer:     mlField,
    recommendedBioProduct:     mlField,
    recommendedOrganicProduct: mlField,
    extraFarmerAdvice:         mlField,
    suitableWeather:           mlField,
    diseaseImages:             [{ type: String }],
    tags:                      [{ type: String }],
    confidenceScore: { type: Number },
    imageUrl: { type: String },
    source: { type: String, enum: ['cache', 'knowledge_base', 'ai', 'yolo'], default: 'ai' },
    predictionSource: { type: String, default: 'YOLOv8 Classification Model' },
    yoloTop5: [
      {
        rank:       { type: Number },
        class_name: { type: String },
        confidence: { type: Number },
        category:   { type: String },
      },
    ],
    similarityScore: { type: Number },
    knowledgeBaseId: { type: String },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
    comment: { type: String },
    correctDisease: { type: String },
    translations: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DiseaseRecommendationSchema.index({ cropName: 1, diseaseName: 1 });

export const DiseaseRecommendation = mongoose.model<IDiseaseRecommendation>(
  'DiseaseRecommendation',
  DiseaseRecommendationSchema
);
