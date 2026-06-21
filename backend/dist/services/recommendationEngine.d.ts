import { IFarmerCropRequest } from '../models/FarmerCropRequest';
import { IRecommendationItem } from '../models/AIRecommendation';
export declare function runRecommendationEngine(req: IFarmerCropRequest): Promise<{
    recommendations: IRecommendationItem[];
    hasHighScore: boolean;
}>;
//# sourceMappingURL=recommendationEngine.d.ts.map