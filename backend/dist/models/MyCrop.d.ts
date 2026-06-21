import mongoose, { Document } from 'mongoose';
export interface IMyCrop extends Document {
    userId: string;
    cropName: string;
    image?: string;
    category: string;
    description?: string;
    cultivationGuide?: string;
    suitabilityScore: number;
    estimatedYield?: string;
    estimatedCultivationCost?: number;
    expectedRevenue?: number;
    expectedProfit?: number;
    waterRequirement?: string;
    fertilizerRequirement?: string;
    fertilizerCost?: number;
    seedRequirement?: string;
    recommendedSeedVariety?: string;
    currentMarketPrice?: number;
    marketDemand?: string;
    riskLevel?: string;
    recommendationSource?: string;
    status: string;
    createdAt: Date;
}
export declare const MyCrop: mongoose.Model<IMyCrop, {}, {}, {}, mongoose.Document<unknown, {}, IMyCrop, {}, {}> & IMyCrop & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=MyCrop.d.ts.map