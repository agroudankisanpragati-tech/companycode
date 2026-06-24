import mongoose, { Schema, Document } from 'mongoose';

export type CropCategory = 'Traditional' | 'Medicinal' | 'Fruit' | 'Vegetable';

export interface ICropKnowledgeBase extends Document {
  cropName: string;
  cropCategory: CropCategory;
  suitableSoilTypes: string[];
  minPH: number;
  maxPH: number;
  minRainfall: number;
  maxRainfall: number;
  minTemperature: number;
  maxTemperature: number;
  waterRequirement: 'low' | 'medium' | 'high';
  suitableSeasons: string[];
  suitableIrrigationTypes: string[];
  growingDuration: number;
  averageYield: number;
  averageMarketPrice: number;
  estimatedProfit: number;
  cultivationCost: number;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  cultivationProcess: string;
  marketDemand: 'low' | 'medium' | 'high';
  farmingTypes: string[];
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  // AI-generated fields
  soilType?: string;
  soilPH?: number;
  waterAvailability?: string;
  weatherCondition?: string;
  district?: string;
  state?: string;
  season?: string;
  suitabilityScore?: number;
  aiRecommendation?: string;
  expectedYield?: string;
  marketPrice?: number;
  fertilizerPlan?: string;
  organicPractices?: string;
  diseaseRisks?: string;
  irrigationAdvice?: string;
  sourceType?: 'AI' | 'Manual';
  source?: 'database' | 'openai' | 'admin';
  createdBy?: string;
  status?: 'active' | 'disabled' | 'archived';
  lastUpdated?: Date;
}

const CropKnowledgeBaseSchema = new Schema<ICropKnowledgeBase>(
  {
    cropName: { type: String, required: true },
    cropCategory: { type: String, enum: ['Traditional', 'Medicinal', 'Fruit', 'Vegetable'], required: true },
    suitableSoilTypes: [{ type: String }],
    minPH: { type: Number, default: 0 },
    maxPH: { type: Number, default: 0 },
    minRainfall: { type: Number, default: 0 },
    maxRainfall: { type: Number, default: 0 },
    minTemperature: { type: Number, default: 0 },
    maxTemperature: { type: Number, default: 0 },
    waterRequirement: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    suitableSeasons: [{ type: String }],
    suitableIrrigationTypes: [{ type: String }],
    growingDuration: { type: Number, default: 0 },
    averageYield: { type: Number, default: 0 },
    averageMarketPrice: { type: Number, default: 0 },
    estimatedProfit: { type: Number, default: 0 },
    cultivationCost: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, default: '' },
    cultivationProcess: { type: String, default: '' },
    marketDemand: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    farmingTypes: [{ type: String }],
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
    // AI-generated fields
    soilType: { type: String },
    soilPH: { type: Number },
    waterAvailability: { type: String },
    weatherCondition: { type: String },
    district: { type: String },
    state: { type: String },
    season: { type: String },
    suitabilityScore: { type: Number },
    aiRecommendation: { type: String },
    expectedYield: { type: String },
    marketPrice: { type: Number },
    fertilizerPlan: { type: String },
    organicPractices: { type: String },
    diseaseRisks: { type: String },
    irrigationAdvice: { type: String },
    sourceType: { type: String, enum: ['AI', 'Manual'], default: 'Manual' },
    source: { type: String, enum: ['database', 'openai', 'admin'], default: 'admin' },
    createdBy: { type: String },
    status: { type: String, enum: ['active', 'disabled', 'archived'], default: 'active' },
    lastUpdated: { type: Date },
  },
  { timestamps: true }
);

// Composite unique index: same crop + soil + district + season = one record
CropKnowledgeBaseSchema.index(
  { cropName: 1, soilType: 1, district: 1, season: 1 },
  { unique: true, sparse: true }
);
// Fallback unique index for admin-created entries (no context fields)
CropKnowledgeBaseSchema.index(
  { cropName: 1, sourceType: 1 },
  { unique: false }
);

export const CropKnowledgeBase = mongoose.model<ICropKnowledgeBase>('CropKnowledgeBase', CropKnowledgeBaseSchema);
