import mongoose, { Document } from 'mongoose';
export interface IDiseaseKnowledgeBase extends Document {
    cropName: string;
    scientificName?: string;
    cropCategory: string;
    diseaseName: string;
    diseaseType: string;
    severityLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    leafSymptoms?: string;
    stemSymptoms?: string;
    rootSymptoms?: string;
    fruitSymptoms?: string;
    symptomsDescription?: string;
    organicTreatment?: string;
    chemicalTreatment?: string;
    recommendedProducts?: string;
    treatmentDescription?: string;
    preventionMethods?: string;
    preventionDescription?: string;
    recommendedActions?: string;
    diseaseImages: string[];
    healthyImages: string[];
    source: 'admin' | 'ai_auto' | 'ai_verified';
    confidenceScore: number;
    scanCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DiseaseKnowledgeBase: mongoose.Model<IDiseaseKnowledgeBase, {}, {}, {}, mongoose.Document<unknown, {}, IDiseaseKnowledgeBase, {}, {}> & IDiseaseKnowledgeBase & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DiseaseKnowledgeBase.d.ts.map