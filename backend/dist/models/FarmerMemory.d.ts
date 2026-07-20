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
import mongoose, { Document } from 'mongoose';
export interface IConversationTurn {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pageContext?: string;
    agentUsed?: string;
    langCode?: string;
}
export interface IFarmerPreference {
    selectedLang: string;
    selectedDialect?: string;
    voiceEnabled: boolean;
    preferredTopics: string[];
    lastActivePageContext?: string;
}
export interface IFAQEntry {
    question: string;
    normalizedKey: string;
    askedCount: number;
    lastAskedAt: Date;
    agentDomain?: string;
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
export interface IFarmerMemory extends Document {
    userId: string;
    conversationHistory: IConversationTurn[];
    preferences: IFarmerPreference;
    cropHistoryRefs: string[];
    diseaseHistoryRefs: string[];
    soilReportRefs: string[];
    cropAdvisoryRefs: string[];
    faqEntries: IFAQEntry[];
    voiceDatasetRefs: IVoiceDatasetRef[];
    totalInteractions: number;
    lastInteractionAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const FarmerMemory: mongoose.Model<IFarmerMemory, {}, {}, {}, mongoose.Document<unknown, {}, IFarmerMemory, {}, {}> & IFarmerMemory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=FarmerMemory.d.ts.map