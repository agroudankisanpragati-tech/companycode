import { ISoilStandard } from '../models/SoilStandard';
export interface SoilAnalysisInput {
    soilType?: string;
    pH?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    organicCarbon?: number;
    ec?: number;
    micronutrients?: {
        zinc?: number;
        iron?: number;
        manganese?: number;
        copper?: number;
        boron?: number;
    };
}
export interface SoilAIResult {
    soilType: string;
    pH: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    organicCarbon: number;
    ec: number;
    micronutrients: {
        zinc?: number;
        iron?: number;
        manganese?: number;
        copper?: number;
        boron?: number;
    };
    soilHealthScore: number;
    soilHealthStatus: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
    deficiencies: Array<{
        nutrient: string;
        type: 'Low' | 'Excess' | 'Imbalance';
        severity: 'Low' | 'Medium' | 'High';
        description: string;
    }>;
    benchmarkComparison: Array<{
        parameter: string;
        farmerValue: number | string;
        idealValue: string;
        status: 'Optimal' | 'Low' | 'High' | 'Deficient';
    }>;
    recommendations: {
        organic: string[];
        fertilizer: string[];
        reasoning: string;
    };
    cropRecommendations: Array<{
        cropName: string;
        suitabilityScore: number;
        expectedBenefits: string;
        reason: string;
    }>;
    aiAnalysis: string;
    aiAnalysisHindi: string;
}
export declare function calculateSoilHealthScore(data: SoilAnalysisInput, standard: ISoilStandard): {
    score: number;
    status: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
};
export declare function buildBenchmarkComparison(data: SoilAnalysisInput, standard: ISoilStandard): Array<{
    parameter: string;
    farmerValue: number | string;
    idealValue: string;
    status: 'Optimal' | 'Low' | 'High' | 'Deficient';
}>;
export declare function detectDeficiencies(data: SoilAnalysisInput, standard: ISoilStandard): Array<{
    nutrient: string;
    type: 'Low' | 'Excess' | 'Imbalance';
    severity: 'Low' | 'Medium' | 'High';
    description: string;
}>;
export declare function extractAndAnalyzeSoilWithAI(ocrText: string, standard: ISoilStandard): Promise<SoilAIResult>;
export declare function generateAIAnalysisFromData(data: SoilAnalysisInput, standard: ISoilStandard): Promise<{
    recommendations: {
        organic: string[];
        fertilizer: string[];
        reasoning: string;
    };
    cropRecommendations: Array<{
        cropName: string;
        suitabilityScore: number;
        expectedBenefits: string;
        reason: string;
    }>;
    aiAnalysis: string;
}>;
//# sourceMappingURL=soilAIService.d.ts.map