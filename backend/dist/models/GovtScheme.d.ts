import mongoose, { Document } from 'mongoose';
export type GovtSchemeStatus = 'draft' | 'published';
export type SchemeType = 'central' | 'state';
export interface IGovtScheme extends Document {
    title: string;
    slug: string;
    summary: string;
    description: string;
    department: string;
    audience: string;
    benefits: string[];
    eligibility?: string;
    requiredDocuments?: string[];
    applicationProcess?: string;
    applicationLink?: string;
    officialLink?: string;
    coverImage?: string;
    images: string[];
    videos: string[];
    tags: string[];
    keywords: string[];
    schemeType: SchemeType;
    state?: string;
    status: GovtSchemeStatus;
    source: 'admin' | 'api';
    createdBy?: string;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const GovtScheme: mongoose.Model<IGovtScheme, {}, {}, {}, mongoose.Document<unknown, {}, IGovtScheme, {}, {}> & IGovtScheme & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=GovtScheme.d.ts.map