import mongoose, { Document } from 'mongoose';
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
export declare const CropKnowledgeBase: mongoose.Model<ICropKnowledgeBase, {}, {}, {}, mongoose.Document<unknown, {}, ICropKnowledgeBase, {}, {}> & ICropKnowledgeBase & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CropKnowledgeBase.d.ts.map