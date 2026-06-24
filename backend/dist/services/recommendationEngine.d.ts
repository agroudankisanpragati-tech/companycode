import { IFarmerCropRequest } from '../models/FarmerCropRequest';
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
export declare function runRecommendationEngine(req: IFarmerCropRequest): Promise<{
    recommendations: IRecommendationItem[];
    hasHighScore: boolean;
}>;
//# sourceMappingURL=recommendationEngine.d.ts.map