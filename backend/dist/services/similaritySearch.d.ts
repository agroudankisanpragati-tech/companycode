import { IFarmerConditions, IRecommendationItem } from '../models/AIRecommendation';
export declare function findSimilarRecommendation(conditions: IFarmerConditions): Promise<{
    found: boolean;
    recommendations: IRecommendationItem[];
    similarityScore: number;
}>;
//# sourceMappingURL=similaritySearch.d.ts.map