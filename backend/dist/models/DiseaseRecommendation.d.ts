import mongoose, { Document } from 'mongoose';
export interface IDiseaseRecommendation extends Document {
    userId?: string;
    cropName: string;
    diseaseName: string;
    diseaseType: string;
    severityLevel: string;
    symptoms: string;
    treatment: string;
    prevention: string;
    description: string;
    imageUrl?: string;
    source: 'cache' | 'knowledge_base' | 'ai';
    similarityScore?: number;
    feedback?: 'helpful' | 'not_helpful' | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DiseaseRecommendation: mongoose.Model<IDiseaseRecommendation, {}, {}, {}, mongoose.Document<unknown, {}, IDiseaseRecommendation, {}, {}> & IDiseaseRecommendation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DiseaseRecommendation.d.ts.map