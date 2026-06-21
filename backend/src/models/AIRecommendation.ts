import mongoose, { Schema, Document } from 'mongoose';

export interface IRecommendationItem {
  cropName: string;
  cropCategory: string;
  suitabilityScore: number;
  whySuitable: string;
  waterRequirement: string;
  estimatedCultivationCost: number;
  estimatedYield: string;
  expectedRevenue: number;
  expectedProfit: number;
  marketDemand: string;
  risks: string;
  cultivationGuide: string;
  growingDuration?: number;
  riskLevel?: string;
  currentMarketPrice?: number;
  fertilizerRequirement?: string;
  fertilizerCost?: number;
  seedRequirement?: string;
  recommendedSeedVariety?: string;
}

export interface IFarmerConditions {
  soilType: string;
  soilPH: number;
  waterAvailability: string;
  season: string;
  district: string;
  state: string;
  farmArea: number;
  budget: number;
  farmingType: string;
  rainfall?: number;
  averageTemperature?: number;
}

export interface IAIRecommendation extends Document {
  farmerConditions: IFarmerConditions;
  recommendations: IRecommendationItem[];
  source: 'database' | 'openai';
  similarityScore?: number;
  requestId?: string;
  feedback?: 'helpful' | 'not_helpful' | null;
  feedbackNote?: string;
  createdAt: Date;
}

const RecommendationItemSchema = new Schema<IRecommendationItem>({
  cropName: { type: String, required: true },
  cropCategory: { type: String, required: true },
  suitabilityScore: { type: Number, required: true },
  whySuitable: { type: String },
  waterRequirement: { type: String },
  estimatedCultivationCost: { type: Number },
  estimatedYield: { type: String },
  expectedRevenue: { type: Number },
  expectedProfit: { type: Number },
  marketDemand: { type: String },
  risks: { type: String },
  cultivationGuide: { type: String },
  growingDuration: { type: Number },
  riskLevel: { type: String },
  currentMarketPrice: { type: Number },
  fertilizerRequirement: { type: String },
  fertilizerCost: { type: Number },
  seedRequirement: { type: String },
  recommendedSeedVariety: { type: String },
}, { _id: false });

const FarmerConditionsSchema = new Schema<IFarmerConditions>({
  soilType: { type: String, required: true },
  soilPH: { type: Number, required: true },
  waterAvailability: { type: String, required: true },
  season: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  farmArea: { type: Number, required: true },
  budget: { type: Number, required: true },
  farmingType: { type: String, required: true },
  rainfall: { type: Number },
  averageTemperature: { type: Number },
}, { _id: false });

const AIRecommendationSchema = new Schema<IAIRecommendation>(
  {
    farmerConditions: { type: FarmerConditionsSchema, required: true },
    recommendations: [RecommendationItemSchema],
    source: { type: String, enum: ['database', 'openai'], required: true },
    similarityScore: { type: Number },
    requestId: { type: String, index: true },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
    feedbackNote: { type: String },
  },
  { timestamps: true }
);

// Index for similarity search
AIRecommendationSchema.index({ 'farmerConditions.soilType': 1, 'farmerConditions.season': 1, 'farmerConditions.district': 1 });

export const AIRecommendation = mongoose.model<IAIRecommendation>('AIRecommendation', AIRecommendationSchema);
