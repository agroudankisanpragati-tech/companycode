/**
 * AIConversation Model
 *
 * Stores every AI interaction from the Pragati AI pipeline:
 *   - Text conversations
 *   - Voice interactions (STT → response → TTS)
 *   - Image analysis (disease detection)
 *
 * One document per interaction turn. Linked to userId, sessionId,
 * farmerId, and optionally to crop/farm profiles.
 *
 * Collections reused: FarmerMemory (for preferences), DiseaseRecommendation
 * (for image results). This model is the unified audit log.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type AIInputType = 'text' | 'voice' | 'image';
export type AIStatus    = 'success' | 'error' | 'fallback';

export interface IAIConversation extends Document {
  userId:     string;
  sessionId:  string;
  farmerId?:  string;

  // Input
  inputType:    AIInputType;
  inputText?:   string;       // text or STT transcript
  inputAudioUrl?: string;     // stored audio reference (not raw bytes)
  inputImageUrl?: string;     // stored image reference

  // AI Output
  status:        AIStatus;
  intent?:       string;
  confidence?:   number;
  moduleId?:     string;
  language?:     string;
  responseText?: string;
  responseAudioUrl?: string;  // TTS output reference

  // Image analysis payload
  imageAnalysis?: {
    crop?:       string;
    className?:  string;
    category?:   string;
    confidence?: number;
    top5?:       Array<{ rank: number; className: string; confidence: number }>;
  };

  // Knowledge Base result
  knowledgeData?: Record<string, unknown>;

  // Suggestions from router
  suggestions?: string[];

  // Performance metrics
  metrics?: {
    totalMs?:     number;
    sttMs?:       number;
    intentMs?:    number;
    routerMs?:    number;
    ttsMs?:       number;
    inferenceMs?: number;
    knowledgeMs?: number;
  };

  // Error info
  error?:          string;
  fallbackReason?: string;

  // Farmer context snapshot at time of request
  farmerContext?: {
    name?:      string;
    district?:  string;
    state?:     string;
    soilType?:  string;
    farmSize?:  number;
    cropNames?: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const ImageAnalysisSchema = new Schema(
  {
    crop:       { type: String },
    className:  { type: String },
    category:   { type: String },
    confidence: { type: Number },
    top5: [
      {
        rank:       { type: Number },
        className:  { type: String },
        confidence: { type: Number },
        _id: false,
      },
    ],
  },
  { _id: false }
);

const MetricsSchema = new Schema(
  {
    totalMs:     { type: Number },
    sttMs:       { type: Number },
    intentMs:    { type: Number },
    routerMs:    { type: Number },
    ttsMs:       { type: Number },
    inferenceMs: { type: Number },
    knowledgeMs: { type: Number },
  },
  { _id: false }
);

const FarmerContextSchema = new Schema(
  {
    name:      { type: String },
    district:  { type: String },
    state:     { type: String },
    soilType:  { type: String },
    farmSize:  { type: Number },
    cropNames: { type: [String], default: [] },
  },
  { _id: false }
);

const AIConversationSchema = new Schema<IAIConversation>(
  {
    userId:    { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    farmerId:  { type: String, index: true },

    inputType:      { type: String, enum: ['text', 'voice', 'image'], required: true },
    inputText:      { type: String },
    inputAudioUrl:  { type: String },
    inputImageUrl:  { type: String },

    status:           { type: String, enum: ['success', 'error', 'fallback'], default: 'success' },
    intent:           { type: String },
    confidence:       { type: Number },
    moduleId:         { type: String },
    language:         { type: String },
    responseText:     { type: String },
    responseAudioUrl: { type: String },

    imageAnalysis: { type: ImageAnalysisSchema },
    knowledgeData: { type: Schema.Types.Mixed },
    suggestions:   { type: [String], default: [] },
    metrics:       { type: MetricsSchema },

    error:          { type: String },
    fallbackReason: { type: String },
    farmerContext:  { type: FarmerContextSchema },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
AIConversationSchema.index({ userId: 1, createdAt: -1 });
AIConversationSchema.index({ sessionId: 1, createdAt: 1 });
AIConversationSchema.index({ userId: 1, inputType: 1, createdAt: -1 });
AIConversationSchema.index({ userId: 1, intent: 1 });

export const AIConversation = mongoose.model<IAIConversation>(
  'AIConversation',
  AIConversationSchema
);
