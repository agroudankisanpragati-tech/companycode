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
}

const CropKnowledgeBaseSchema = new Schema<ICropKnowledgeBase>(
  {
    cropName: { type: String, required: true, unique: true },
    cropCategory: { type: String, enum: ['Traditional', 'Medicinal', 'Fruit', 'Vegetable'], required: true },
    suitableSoilTypes: [{ type: String }],
    minPH: { type: Number, required: true },
    maxPH: { type: Number, required: true },
    minRainfall: { type: Number, required: true },
    maxRainfall: { type: Number, required: true },
    minTemperature: { type: Number, required: true },
    maxTemperature: { type: Number, required: true },
    waterRequirement: { type: String, enum: ['low', 'medium', 'high'], required: true },
    suitableSeasons: [{ type: String }],
    suitableIrrigationTypes: [{ type: String }],
    growingDuration: { type: Number, required: true },
    averageYield: { type: Number, required: true },
    averageMarketPrice: { type: Number, required: true },
    estimatedProfit: { type: Number, required: true },
    cultivationCost: { type: Number, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
    description: { type: String, required: true },
    cultivationProcess: { type: String, required: true },
    marketDemand: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    farmingTypes: [{ type: String }],
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
  },
  { timestamps: true }
);

export const CropKnowledgeBase = mongoose.model<ICropKnowledgeBase>('CropKnowledgeBase', CropKnowledgeBaseSchema);
