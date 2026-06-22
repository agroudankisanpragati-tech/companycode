"use strict";
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
exports.DiseaseRecommendation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DiseaseRecommendationSchema = new mongoose_1.Schema({
    userId: { type: String, index: true },
    cropName: { type: String, required: true, index: true },
    diseaseName: { type: String, required: true },
    diseaseType: { type: String },
    severityLevel: { type: String },
    symptoms: { type: String },
    treatment: { type: String },
    prevention: { type: String },
    description: { type: String },
    imageUrl: { type: String },
    source: { type: String, enum: ['cache', 'knowledge_base', 'ai'], default: 'ai' },
    similarityScore: { type: Number },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
}, { timestamps: true });
DiseaseRecommendationSchema.index({ cropName: 1, diseaseName: 1 });
exports.DiseaseRecommendation = mongoose_1.default.model('DiseaseRecommendation', DiseaseRecommendationSchema);
//# sourceMappingURL=DiseaseRecommendation.js.map