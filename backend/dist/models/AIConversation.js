"use strict";
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
exports.AIConversation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ImageAnalysisSchema = new mongoose_1.Schema({
    crop: { type: String },
    className: { type: String },
    category: { type: String },
    confidence: { type: Number },
    top5: [
        {
            rank: { type: Number },
            className: { type: String },
            confidence: { type: Number },
            _id: false,
        },
    ],
}, { _id: false });
const MetricsSchema = new mongoose_1.Schema({
    totalMs: { type: Number },
    sttMs: { type: Number },
    intentMs: { type: Number },
    routerMs: { type: Number },
    ttsMs: { type: Number },
    inferenceMs: { type: Number },
    knowledgeMs: { type: Number },
}, { _id: false });
const FarmerContextSchema = new mongoose_1.Schema({
    name: { type: String },
    district: { type: String },
    state: { type: String },
    soilType: { type: String },
    farmSize: { type: Number },
    cropNames: { type: [String], default: [] },
}, { _id: false });
const AIConversationSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    farmerId: { type: String, index: true },
    inputType: { type: String, enum: ['text', 'voice', 'image'], required: true },
    inputText: { type: String },
    inputAudioUrl: { type: String },
    inputImageUrl: { type: String },
    status: { type: String, enum: ['success', 'error', 'fallback'], default: 'success' },
    intent: { type: String },
    confidence: { type: Number },
    moduleId: { type: String },
    language: { type: String },
    responseText: { type: String },
    responseAudioUrl: { type: String },
    imageAnalysis: { type: ImageAnalysisSchema },
    knowledgeData: { type: mongoose_1.Schema.Types.Mixed },
    suggestions: { type: [String], default: [] },
    metrics: { type: MetricsSchema },
    error: { type: String },
    fallbackReason: { type: String },
    farmerContext: { type: FarmerContextSchema },
}, { timestamps: true });
// Compound indexes for efficient queries
AIConversationSchema.index({ userId: 1, createdAt: -1 });
AIConversationSchema.index({ sessionId: 1, createdAt: 1 });
AIConversationSchema.index({ userId: 1, inputType: 1, createdAt: -1 });
AIConversationSchema.index({ userId: 1, intent: 1 });
exports.AIConversation = mongoose_1.default.model('AIConversation', AIConversationSchema);
//# sourceMappingURL=AIConversation.js.map