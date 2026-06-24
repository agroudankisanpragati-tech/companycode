import { IFarmerConditions } from './openaiService';
import { IRecommendationItem } from './recommendationEngine';
export declare function findSimilarRecommendation(conditions: IFarmerConditions): Promise<{
    found: boolean;
    recommendations: IRecommendationItem[];
    similarityScore: number;
}>;
//# sourceMappingURL=similaritySearch.d.ts.map