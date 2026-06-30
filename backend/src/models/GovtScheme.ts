import mongoose, { Document, Schema } from 'mongoose';

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

const govtSchemeSchema = new Schema<IGovtScheme>(
    {
        title: { type: String, required: true, trim: true, maxlength: 300 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        summary: { type: String, required: true, trim: true, maxlength: 500 },
        description: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        audience: { type: String, required: true, trim: true },
        benefits: [{ type: String, trim: true }],
        eligibility: { type: String, trim: true },
        requiredDocuments: [{ type: String, trim: true }],
        applicationProcess: { type: String, trim: true },
        applicationLink: { type: String, trim: true },
        officialLink: { type: String, trim: true },
        coverImage: { type: String, trim: true },
        images: [{ type: String, trim: true }],
        videos: [{ type: String, trim: true }],
        tags: [{ type: String, trim: true, lowercase: true }],
        keywords: [{ type: String, trim: true, lowercase: true }],
        schemeType: { type: String, enum: ['central', 'state'], default: 'central' },
        state: { type: String, trim: true },
        status: { type: String, enum: ['draft', 'published'], default: 'draft' },
        source: { type: String, enum: ['admin', 'api'], default: 'admin' },
        createdBy: { type: String, trim: true },
        publishedAt: { type: Date },
    },
    { timestamps: true }
);

govtSchemeSchema.index({ createdAt: -1 });
govtSchemeSchema.index({ schemeType: 1, state: 1 });
govtSchemeSchema.index({ tags: 1 });
govtSchemeSchema.index({ keywords: 1 });
govtSchemeSchema.index({ title: 'text', summary: 'text', description: 'text', keywords: 'text', tags: 'text', state: 'text' });

export const GovtScheme = mongoose.model<IGovtScheme>('GovtScheme', govtSchemeSchema);