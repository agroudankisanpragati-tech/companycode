import mongoose, { Document } from 'mongoose';
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
export declare const AIRecommendation: mongoose.Model<IAIRecommendation, {}, {}, {}, mongoose.Document<unknown, {}, IAIRecommendation, {}, {}> & IAIRecommendation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AIRecommendation.d.ts.map