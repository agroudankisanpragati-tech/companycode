import mongoose, { Document } from 'mongoose';
export interface IYoloTop5 {
    rank: number;
    class_name: string;
    confidence: number;
    category: string;
}
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
    source: 'cache' | 'knowledge_base' | 'ai' | 'yolo';
    predictionSource: string;
    yoloTop5?: IYoloTop5[];
    similarityScore?: number;
    knowledgeBaseId?: string;
    feedback?: 'helpful' | 'not_helpful' | null;
    comment?: string;
    correctDisease?: string;
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