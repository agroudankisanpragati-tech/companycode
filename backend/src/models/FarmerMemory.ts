/**
 * FarmerMemory Model — Phase 5
 *
 * One document per farmer. Stores all persistent memory used by
 * Pragati Root AI and every specialized agent.
 *
 * Design rules:
 * - One upsert per userId (unique index).
 * - Arrays are capped to prevent unbounded growth.
 * - No auto-learning or auto-retraining — only structured data storage.
 * - Voice dataset references are pluggable stubs (no business logic).
 */

import mongoose, { Schema, Document } from 'mongoose';

// ─── Sub-document shapes ──────────────────────────────────────────────────────

export interface IConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pageContext?: string;
  agentUsed?: string;
  langCode?: string;
}

export interface IFarmerPreference {
  selectedLang: string;           // BCP-47 code: 'hi', 'en', 'mwr', …
  selectedDialect?: string;       // Rajasthan dialect code if applicable
  voiceEnabled: boolean;
  preferredTopics: string[];      // e.g. ['disease', 'market', 'weather']
  lastActivePageContext?: string;
}

export interface IFAQEntry {
  question: string;
  normalizedKey: string;          // normalized for dedup
  askedCount: number;
  lastAskedAt: Date;
  agentDomain?: string;           // which agent answered it
}

export interface IVoiceDatasetRef {
  /** Pluggable reference — actual dataset lives outside this model */
  datasetId: string;
  langCode: string;
  dialectCode?: string;
  recordingCount: number;
  registeredAt: Date;
  /** Status stub — never triggers retraining automatically */
  status: 'registered' | 'pending_review' | 'approved';
}

// ─── Main document interface ──────────────────────────────────────────────────

export interface IFarmerMemory extends Document {
  userId: string;

  // Conversation history (capped at 100 turns)
  conversationHistory: IConversationTurn[];

  // Farmer preferences
  preferences: IFarmerPreference;

  // Domain histories (references only — actual data in domain collections)
  cropHistoryRefs: string[];        // MyCrop / FarmerCropRequest _ids
  diseaseHistoryRefs: string[];     // DiseaseRecommendation _ids
  soilReportRefs: string[];         // SoilReport _ids
  cropAdvisoryRefs: string[];       // FarmerCropRequest _ids

  // Frequently asked questions
  faqEntries: IFAQEntry[];

  // Voice dataset pluggable registry
  voiceDatasetRefs: IVoiceDatasetRef[];

  // Metadata
  totalInteractions: number;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ConversationTurnSchema = new Schema<IConversationTurn>(
  {
    role:        { type: String, enum: ['user', 'assistant'], required: true },
    content:     { type: String, required: true },
    timestamp:   { type: Date, default: Date.now },
    pageContext:  { type: String },
    agentUsed:   { type: String },
    langCode:    { type: String },
  },
  { _id: false }
);

const FarmerPreferenceSchema = new Schema<IFarmerPreference>(
  {
    selectedLang:           { type: String, default: 'hi' },
    selectedDialect:        { type: String },
    voiceEnabled:           { type: Boolean, default: false },
    preferredTopics:        { type: [String], default: [] },
    lastActivePageContext:  { type: String },
  },
  { _id: false }
);

const FAQEntrySchema = new Schema<IFAQEntry>(
  {
    question:      { type: String, required: true },
    normalizedKey: { type: String, required: true },
    askedCount:    { type: Number, default: 1 },
    lastAskedAt:   { type: Date, default: Date.now },
    agentDomain:   { type: String },
  },
  { _id: false }
);

const VoiceDatasetRefSchema = new Schema<IVoiceDatasetRef>(
  {
    datasetId:      { type: String, required: true },
    langCode:       { type: String, required: true },
    dialectCode:    { type: String },
    recordingCount: { type: Number, default: 0 },
    registeredAt:   { type: Date, default: Date.now },
    status:         { type: String, enum: ['registered', 'pending_review', 'approved'], default: 'registered' },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const FarmerMemorySchema = new Schema<IFarmerMemory>(
  {
    userId: { type: String, required: true, unique: true, index: true },

    conversationHistory: {
      type: [ConversationTurnSchema],
      default: [],
      validate: {
        validator: (v: IConversationTurn[]) => v.length <= 100,
        message: 'conversationHistory capped at 100 turns',
      },
    },

    preferences: { type: FarmerPreferenceSchema, default: () => ({}) },

    cropHistoryRefs:     { type: [String], default: [] },
    diseaseHistoryRefs:  { type: [String], default: [] },
    soilReportRefs:      { type: [String], default: [] },
    cropAdvisoryRefs:    { type: [String], default: [] },

    faqEntries:          { type: [FAQEntrySchema], default: [] },
    voiceDatasetRefs:    { type: [VoiceDatasetRefSchema], default: [] },

    totalInteractions:   { type: Number, default: 0 },
    lastInteractionAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FarmerMemorySchema.index({ userId: 1 });
FarmerMemorySchema.index({ 'preferences.selectedLang': 1 });

export const FarmerMemory = mongoose.model<IFarmerMemory>('FarmerMemory', FarmerMemorySchema);
