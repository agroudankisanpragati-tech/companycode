import { IFarmerCropRequest } from '../models/FarmerCropRequest';
export interface IRecommendationItem {
    cropName: string;
    cropNameHindi?: string;
    cropCategory: string;
    suitabilityScore: number;
    whySuitable: string;
    whySuitableHindi?: string;
    waterRequirement: string;
    estimatedCultivationCost: number;
    estimatedYield: string;
    estimatedYieldHindi?: string;
    expectedRevenue: number;
    expectedProfit: number;
    marketDemand: string;
    marketDemandHindi?: string;
    risks: string;
    risksHindi?: string;
    cultivationGuide: string;
    cultivationGuideHindi?: string;
    growingDuration?: number;
    bestSowingTime?: string;
    bestSowingTimeHindi?: string;
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