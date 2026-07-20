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
import mongoose, { Document } from 'mongoose';
export type AIInputType = 'text' | 'voice' | 'image';
export type AIStatus = 'success' | 'error' | 'fallback';
export interface IAIConversation extends Document {
    userId: string;
    sessionId: string;
    farmerId?: string;
    inputType: AIInputType;
    inputText?: string;
    inputAudioUrl?: string;
    inputImageUrl?: string;
    status: AIStatus;
    intent?: string;
    confidence?: number;
    moduleId?: string;
    language?: string;
    responseText?: string;
    responseAudioUrl?: string;
    imageAnalysis?: {
        crop?: string;
        className?: string;
        category?: string;
        confidence?: number;
        top5?: Array<{
            rank: number;
            className: string;
            confidence: number;
        }>;
    };
    knowledgeData?: Record<string, unknown>;
    suggestions?: string[];
    metrics?: {
        totalMs?: number;
        sttMs?: number;
        intentMs?: number;
        routerMs?: number;
        ttsMs?: number;
        inferenceMs?: number;
        knowledgeMs?: number;
    };
    error?: string;
    fallbackReason?: string;
    farmerContext?: {
        name?: string;
        district?: string;
        state?: string;
        soilType?: string;
        farmSize?: number;
        cropNames?: string[];
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const AIConversation: mongoose.Model<IAIConversation, {}, {}, {}, mongoose.Document<unknown, {}, IAIConversation, {}, {}> & IAIConversation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AIConversation.d.ts.map