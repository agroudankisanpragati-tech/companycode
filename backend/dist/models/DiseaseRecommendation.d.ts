import mongoose, { Document } from 'mongoose';
export interface IDiseaseRecommendation extends Document {
    userId?: string;
    cropName: string;
    diseaseName: string;
    diseaseType: string;
    severityLevel: string;
    symptoms: string;
    organicTreatment: string;
    chemicalTreatment: string;
    treatment: string;
    prevention: string;
    description: string;
    recommendedActions?: string;
    confidenceScore?: number;
    imageUrl?: string;
    source: 'cache' | 'knowledge_base' | 'ai';
    similarityScore?: number;
    knowledgeBaseId?: string;
    feedback?: 'helpful' | 'not_helpful' | null;
    translations?: Record<string, Record<string, any>>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DiseaseRecommendation: mongoose.Model<IDiseaseRecommendation, {}, {}, {}, mongoose.Document<unknown, {}, IDiseaseRecommendation, {}, {}> & IDiseaseRecommendation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DiseaseRecommendation.d.ts.map