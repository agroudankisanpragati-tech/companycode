import mongoose, { Schema, Document } from 'mongoose';

export interface IMyCrop extends Document {
  userId: string;
  cropName: string;
  image?: string;
  category: string;
  description?: string;
  cultivationGuide?: string;
  suitabilityScore: number;
  estimatedYield?: string;
  estimatedCultivationCost?: number;
  expectedRevenue?: number;
  expectedProfit?: number;
  waterRequirement?: string;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
  currentMarketPrice?: number;
  marketDemand?: string;
  riskLevel?: string;
  recommendationSource?: string;
  status: string;
  createdAt: Date;
}

const myCropSchema = new Schema<IMyCrop>(
  {
    userId: { type: String, required: true, index: true },
    cropName: { type: String, required: true },
    image: { type: String },
    category: { type: String, required: true },
    description: { type: String },
    cultivationGuide: { type: String },
    suitabilityScore: { type: Number, required: true },
    estimatedYield: { type: String },
    estimatedCultivationCost: { type: Number },
    expectedRevenue: { type: Number },
    expectedProfit: { type: Number },
    waterRequirement: { type: String },
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
    currentMarketPrice: { type: Number },
    marketDemand: { type: String },
    riskLevel: { type: String },
    recommendationSource: { type: String },
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

export const MyCrop = mongoose.model<IMyCrop>('MyCrop', myCropSchema);
