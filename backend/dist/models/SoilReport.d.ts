import mongoose, { Document } from 'mongoose';
export interface ISoilReport extends Document {
    farmerId: string;
    reportUrl?: string;
    uploadDate: Date;
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
    soilHealthScore?: number;
    soilHealthStatus?: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
    deficiencies?: Array<{
        nutrient: string;
        type: 'Low' | 'Excess' | 'Imbalance';
        severity: 'Low' | 'Medium' | 'High';
        description: string;
    }>;
    benchmarkComparison?: Array<{
        parameter: string;
        farmerValue: number | string;
        idealValue: string;
        status: 'Optimal' | 'Low' | 'High' | 'Deficient';
    }>;
    recommendations?: {
        organic: string[];
        fertilizer: string[];
        reasoning: string;
    };
    cropRecommendations?: Array<{
        cropName: string;
        suitabilityScore: number;
        expectedBenefits: string;
        reason: string;
    }>;
    aiAnalysis?: string;
    translations?: Record<string, Record<string, any>>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SoilReport: mongoose.Model<ISoilReport, {}, {}, {}, mongoose.Document<unknown, {}, ISoilReport, {}, {}> & ISoilReport & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SoilReport.d.ts.map