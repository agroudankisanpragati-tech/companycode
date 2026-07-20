"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmerMemory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const ConversationTurnSchema = new mongoose_1.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    pageContext: { type: String },
    agentUsed: { type: String },
    langCode: { type: String },
}, { _id: false });
const FarmerPreferenceSchema = new mongoose_1.Schema({
    selectedLang: { type: String, default: 'hi' },
    selectedDialect: { type: String },
    voiceEnabled: { type: Boolean, default: false },
    preferredTopics: { type: [String], default: [] },
    lastActivePageContext: { type: String },
}, { _id: false });
const FAQEntrySchema = new mongoose_1.Schema({
    question: { type: String, required: true },
    normalizedKey: { type: String, required: true },
    askedCount: { type: Number, default: 1 },
    lastAskedAt: { type: Date, default: Date.now },
    agentDomain: { type: String },
}, { _id: false });
const VoiceDatasetRefSchema = new mongoose_1.Schema({
    datasetId: { type: String, required: true },
    langCode: { type: String, required: true },
    dialectCode: { type: String },
    recordingCount: { type: Number, default: 0 },
    registeredAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['registered', 'pending_review', 'approved'], default: 'registered' },
}, { _id: false });
// ─── Main schema ──────────────────────────────────────────────────────────────
const FarmerMemorySchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    conversationHistory: {
        type: [ConversationTurnSchema],
        default: [],
        validate: {
            validator: (v) => v.length <= 100,
            message: 'conversationHistory capped at 100 turns',
        },
    },
    preferences: { type: FarmerPreferenceSchema, default: () => ({}) },
    cropHistoryRefs: { type: [String], default: [] },
    diseaseHistoryRefs: { type: [String], default: [] },
    soilReportRefs: { type: [String], default: [] },
    cropAdvisoryRefs: { type: [String], default: [] },
    faqEntries: { type: [FAQEntrySchema], default: [] },
    voiceDatasetRefs: { type: [VoiceDatasetRefSchema], default: [] },
    totalInteractions: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
}, { timestamps: true });
FarmerMemorySchema.index({ userId: 1 });
FarmerMemorySchema.index({ 'preferences.selectedLang': 1 });
exports.FarmerMemory = mongoose_1.default.model('FarmerMemory', FarmerMemorySchema);
//# sourceMappingURL=FarmerMemory.js.map