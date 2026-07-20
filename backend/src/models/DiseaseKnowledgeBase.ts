import mongoose, { Schema, Document } from 'mongoose';

export interface IDiseaseKnowledgeBase extends Document {
  // Core identity
  cropName: string;
  diseaseName: string;
  scientificName?: string;
  cropCategory: string;
  diseaseType: string;
  slug: string;

  // Content
  description: string;
  symptoms?: string;
  causes?: string;
  organicSolution?: string;
  chemicalSolution?: string;
  prevention?: string;

  // Legacy symptom fields (kept for backward compat with AI knowledge_service)
  leafSymptoms?: string;
  stemSymptoms?: string;
  rootSymptoms?: string;
  fruitSymptoms?: string;
  symptomsDescription?: string;
  organicTreatment?: string;
  chemicalTreatment?: string;
  treatmentDescription?: string;
  preventionMethods?: string;
  preventionDescription?: string;
  recommendedActions?: string;

  // Classification
  severityLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedPlantPart?: string;
  status: 'draft' | 'published' | 'archived';

  // Media
  diseaseImages: string[];
  healthyImages: string[];
  imageGallery: string[];
  videoLinks: string[];

  // Extended knowledge fields
  urgentPrevention?: string;
  recoveryTips?: string;
  dos?: string;
  donts?: string;
  recommendedFertilizer?: string;
  recommendedBioProduct?: string;
  recommendedOrganicProduct?: string;
  extraFarmerAdvice?: string;
  suitableWeather?: string;
  adminNotes?: string;

  // Knowledge enrichment
  recommendedProducts?: string;
  governmentAdvisory?: string;
  referenceLinks: string[];

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

  // Self-learning fields
  source: 'admin' | 'ai_auto' | 'ai_verified';
  confidenceScore: number;
  scanCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DiseaseKnowledgeBaseSchema = new Schema<IDiseaseKnowledgeBase>(
  {
    cropName:        { type: String, required: true, index: true },
    diseaseName:     { type: String, required: true, index: true },
    scientificName:  { type: String },
    cropCategory:    { type: String, default: 'General' },
    diseaseType:     { type: String, required: true },
    slug:            { type: String, index: true },

    description:     { type: String, required: true },
    symptoms:        { type: String },
    causes:          { type: String },
    organicSolution: { type: String },
    chemicalSolution:{ type: String },
    prevention:      { type: String },

    // Legacy fields — kept so existing AI knowledge_service.py continues to work
    leafSymptoms:          { type: String },
    stemSymptoms:          { type: String },
    rootSymptoms:          { type: String },
    fruitSymptoms:         { type: String },
    symptomsDescription:   { type: String },
    organicTreatment:      { type: String },
    chemicalTreatment:     { type: String },
    treatmentDescription:  { type: String },
    preventionMethods:     { type: String },
    preventionDescription: { type: String },
    recommendedActions:    { type: String },

    severityLevel:    { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    affectedPlantPart:{ type: String },
    status:           { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },

    diseaseImages:  [{ type: String }],
    healthyImages:  [{ type: String }],
    imageGallery:   [{ type: String }],
    videoLinks:     [{ type: String }],

    recommendedProducts: { type: String },
    governmentAdvisory:  { type: String },
    referenceLinks:      [{ type: String }],

    // Extended knowledge fields
    urgentPrevention:        { type: String },
    recoveryTips:            { type: String },
    dos:                     { type: String },
    donts:                   { type: String },
    recommendedFertilizer:   { type: String },
    recommendedBioProduct:   { type: String },
    recommendedOrganicProduct: { type: String },
    extraFarmerAdvice:       { type: String },
    suitableWeather:         { type: String },
    adminNotes:              { type: String },

    languages:    [{ type: String }],

    tags:            [{ type: String }],
    seoTitle:        { type: String },
    seoDescription:  { type: String },
    seoKeywords:     [{ type: String }],

    createdBy: { type: String },
    updatedBy: { type: String },

    source:          { type: String, enum: ['admin', 'ai_auto', 'ai_verified'], default: 'admin' },
    confidenceScore: { type: Number, default: 0 },
    scanCount:       { type: Number, default: 0 },
    helpfulCount:    { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    lastSeenAt:      { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DiseaseKnowledgeBaseSchema.index({ cropName: 1, diseaseName: 1 }, { unique: true });

// Auto-generate slug before save
DiseaseKnowledgeBaseSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = `${this.cropName}-${this.diseaseName}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  // Mirror new fields into legacy fields so knowledge_service.py keeps working
  if (this.symptoms && !this.symptomsDescription) this.symptomsDescription = this.symptoms;
  if (this.organicSolution && !this.organicTreatment) this.organicTreatment = this.organicSolution;
  if (this.chemicalSolution && !this.chemicalTreatment) this.chemicalTreatment = this.chemicalSolution;
  if (this.prevention && !this.preventionMethods) this.preventionMethods = this.prevention;
  next();
});

export const DiseaseKnowledgeBase = mongoose.model<IDiseaseKnowledgeBase>(
  'DiseaseKnowledgeBase',
  DiseaseKnowledgeBaseSchema
);
