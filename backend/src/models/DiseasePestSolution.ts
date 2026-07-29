import mongoose, { Schema, Document } from 'mongoose';

// ─── Multilingual field helper ────────────────────────────────────────────────
// Every user-visible text field is stored as { en: string, hi: string }.
// Old records that stored a plain string are handled by pickLang() at read time.
export interface MLString {
  en?: string;
  hi?: string;
}

// Resolve a multilingual field: returns hi if lang !== 'en' AND hi exists,
// otherwise returns en. Falls back gracefully for old plain-string records.
export function pickLang(field: MLString | string | undefined, lang: string): string {
  if (!field) return '';
  // Old record — plain string (always English)
  if (typeof field === 'string') return field;
  // New multilingual object
  if (lang !== 'en' && field.hi) return field.hi;
  return field.en || '';
}

// ─── Schema interface ─────────────────────────────────────────────────────────
export interface IDiseasePestSolution extends Document {
  // ── AI matching fields — NEVER translated, always English ──────────────────
  cropName: string;
  recordType: 'Disease' | 'Pest' | 'Deficiency' | 'Healthy';
  diseasePestName: string;
  /** Raw YOLO class_name label, e.g. "Black_Gram_Cercospora_Leaf_Spot" */
  aiLabel?: string;
  /** Additional name variants / aliases for fuzzy lookup */
  aliases: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';

  // ── User-visible display name (multilingual) ────────────────────────────────
  displayName?: MLString;

  // ── User-visible content fields (multilingual) ─────────────────────────────
  description?: MLString | string;
  symptoms?: MLString | string;
  organicSolution?: MLString | string;
  chemicalSolution?: MLString | string;
  urgentPrevention?: MLString | string;
  recoveryTips?: MLString | string;
  preventiveMeasures?: MLString | string;
  dos?: MLString | string;
  donts?: MLString | string;
  recommendedProducts?: MLString | string;
  farmerAdvice?: MLString | string;

  referenceImages: string[];
  tags: string[];
  keywords: string[];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Reusable sub-schema for { en, hi } ──────────────────────────────────────
const mlStringSchema = {
  en: { type: String, default: '' },
  hi: { type: String, default: '' },
};

// Mixed type allows both old plain strings and new { en, hi } objects
// so existing records are never broken.
const mlField = { type: Schema.Types.Mixed };

const DiseasePestSolutionSchema = new Schema<IDiseasePestSolution>(
  {
    // ── AI matching — always plain English strings ──────────────────────────
    cropName:          { type: String, required: true, index: true },
    recordType:        { type: String, enum: ['Disease','Pest','Deficiency','Healthy'], required: true },
    diseasePestName:   { type: String, required: true, index: true },
    aiLabel:           { type: String, index: true },
    aliases:           [{ type: String }],
    severity:          { type: String, enum: ['low','medium','high','critical'], default: 'medium' },

    // ── Multilingual display name ───────────────────────────────────────────
    displayName:       { type: mlStringSchema, default: undefined },

    // ── Multilingual user-visible content (Mixed = backward compatible) ─────
    description:        mlField,
    symptoms:           mlField,
    organicSolution:    mlField,
    chemicalSolution:   mlField,
    urgentPrevention:   mlField,
    recoveryTips:       mlField,
    preventiveMeasures: mlField,
    dos:                mlField,
    donts:              mlField,
    recommendedProducts:mlField,
    farmerAdvice:       mlField,

    referenceImages:   [{ type: String }],
    tags:              [{ type: String }],
    keywords:          [{ type: String }],
    status:            { type: String, enum: ['draft','published'], default: 'published' },
  },
  { timestamps: true, collection: 'diseasepestsolutions' }
);

DiseasePestSolutionSchema.index({ cropName: 1, diseasePestName: 1 }, { unique: true });

export const DiseasePestSolution = mongoose.model<IDiseasePestSolution>(
  'DiseasePestSolution',
  DiseasePestSolutionSchema
);
