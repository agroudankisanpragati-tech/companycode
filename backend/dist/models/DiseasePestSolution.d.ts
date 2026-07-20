import mongoose, { Document } from 'mongoose';
export interface IDiseasePestSolution extends Document {
    cropName: string;
    recordType: 'Disease' | 'Pest' | 'Deficiency' | 'Healthy';
    diseasePestName: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    symptoms?: string;
    organicSolution?: string;
    chemicalSolution?: string;
    urgentPrevention?: string;
    recoveryTips?: string;
    preventiveMeasures?: string;
    dos?: string;
    donts?: string;
    recommendedProducts?: string;
    farmerAdvice?: string;
    referenceImages: string[];
    tags: string[];
    keywords: string[];
    status: 'draft' | 'published';
    createdAt: Date;
    updatedAt: Date;
}
export declare const DiseasePestSolution: mongoose.Model<IDiseasePestSolution, {}, {}, {}, mongoose.Document<unknown, {}, IDiseasePestSolution, {}, {}> & IDiseasePestSolution & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DiseasePestSolution.d.ts.map