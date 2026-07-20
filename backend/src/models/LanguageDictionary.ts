import mongoose, { Document, Schema } from 'mongoose';

export type DictionaryCategory =
  | 'crops' | 'diseases' | 'pests' | 'fertilizers'
  | 'soil' | 'weather' | 'government' | 'agriculture' | 'ui';

export interface ILanguageDictionary extends Document {
  normalizedKey: string;       // lowercase, no spaces/underscores/hyphens
  english: string;
  hindi: string;
  marwari?: string;
  mewari?: string;
  dhundhari?: string;
  hadoti?: string;
  shekhawati?: string;
  bagri?: string;
  wagdi?: string;
  mewati?: string;
  godwari?: string;
  ahirwati?: string;
  malvi?: string;
  category: DictionaryCategory;
  aliases: string[];           // alternate spellings / raw inputs
  confidence: number;          // 0–1
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LanguageDictionarySchema = new Schema<ILanguageDictionary>(
  {
    normalizedKey: { type: String, required: true, unique: true, index: true },
    english:       { type: String, required: true },
    hindi:         { type: String, required: true },
    marwari:       String,
    mewari:        String,
    dhundhari:     String,
    hadoti:        String,
    shekhawati:    String,
    bagri:         String,
    wagdi:         String,
    mewati:        String,
    godwari:       String,
    ahirwati:      String,
    malvi:         String,
    category: {
      type: String,
      enum: ['crops','diseases','pests','fertilizers','soil','weather','government','agriculture','ui'],
      required: true,
      index: true,
    },
    aliases:    { type: [String], default: [] },
    confidence: { type: Number, default: 1, min: 0, max: 1 },
    approved:   { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Index for alias lookups
LanguageDictionarySchema.index({ aliases: 1 });

export const LanguageDictionary = mongoose.model<ILanguageDictionary>(
  'LanguageDictionary',
  LanguageDictionarySchema
);
