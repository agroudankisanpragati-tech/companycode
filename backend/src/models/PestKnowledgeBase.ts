import mongoose, { Schema, Document } from 'mongoose';

export interface IPestKnowledgeBase extends Document {
  // Core identity
  cropName: string;
  pestName: string;
  scientificName?: string;
  slug: string;

  // Content
  description: string;
  symptoms?: string;
  damageSymptoms?: string;
  organicControl?: string;
  chemicalControl?: string;
  biologicalControl?: string;
  preventiveMeasures?: string;
  lifeCycle?: string;

  // Classification
  affectedPlantPart?: string;
  status: 'draft' | 'published' | 'archived';

  // Media
  images: string[];
  videos: string[];

  // Knowledge enrichment
  recommendedProducts?: string;
  governmentAdvisory?: string;
  references: string[];

  // Multilingual
  languages: string[];

  // SEO
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];

  // Audit
  createdBy?: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PestKnowledgeBaseSchema = new Schema<IPestKnowledgeBase>(
  {
    cropName:  { type: String, required: true, index: true },
    pestName:  { type: String, required: true, index: true },
    scientificName: { type: String },
    slug:      { type: String, index: true },

    description:       { type: String, required: true },
    symptoms:          { type: String },
    damageSymptoms:    { type: String },
    organicControl:    { type: String },
    chemicalControl:   { type: String },
    biologicalControl: { type: String },
    preventiveMeasures:{ type: String },
    lifeCycle:         { type: String },

    affectedPlantPart: { type: String },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },

    images:     [{ type: String }],
    videos:     [{ type: String }],

    recommendedProducts: { type: String },
    governmentAdvisory:  { type: String },
    references:          [{ type: String }],

    languages: [{ type: String }],

    tags:           [{ type: String }],
    seoTitle:       { type: String },
    seoDescription: { type: String },
    seoKeywords:    [{ type: String }],

    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

PestKnowledgeBaseSchema.index({ cropName: 1, pestName: 1 }, { unique: true });

PestKnowledgeBaseSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = `${this.cropName}-${this.pestName}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

export const PestKnowledgeBase = mongoose.model<IPestKnowledgeBase>(
  'PestKnowledgeBase',
  PestKnowledgeBaseSchema
);
