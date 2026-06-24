import { IRecommendationItem } from './recommendationEngine';
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
export declare function callOpenAIForCrops(conditions: IFarmerConditions): Promise<IRecommendationItem[]>;
//# sourceMappingURL=openaiService.d.ts.map