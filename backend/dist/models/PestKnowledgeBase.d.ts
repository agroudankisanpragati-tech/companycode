import mongoose, { Document } from 'mongoose';
export interface IPestKnowledgeBase extends Document {
    cropName: string;
    pestName: string;
    scientificName?: string;
    slug: string;
    description: string;
    symptoms?: string;
    damageSymptoms?: string;
    organicControl?: string;
    chemicalControl?: string;
    biologicalControl?: string;
    preventiveMeasures?: string;
    lifeCycle?: string;
    affectedPlantPart?: string;
    status: 'draft' | 'published' | 'archived';
    images: string[];
    videos: string[];
    recommendedProducts?: string;
    governmentAdvisory?: string;
    references: string[];
    languages: string[];
    tags: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords: string[];
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PestKnowledgeBase: mongoose.Model<IPestKnowledgeBase, {}, {}, {}, mongoose.Document<unknown, {}, IPestKnowledgeBase, {}, {}> & IPestKnowledgeBase & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=PestKnowledgeBase.d.ts.map