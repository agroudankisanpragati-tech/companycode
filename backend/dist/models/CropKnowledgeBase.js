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
exports.CropKnowledgeBase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CropKnowledgeBaseSchema = new mongoose_1.Schema({
    cropName: { type: String, required: true },
    cropCategory: { type: String, enum: ['Traditional', 'Medicinal', 'Fruit', 'Vegetable'], required: true },
    suitableSoilTypes: [{ type: String }],
    minPH: { type: Number, default: 0 },
    maxPH: { type: Number, default: 0 },
    minRainfall: { type: Number, default: 0 },
    maxRainfall: { type: Number, default: 0 },
    minTemperature: { type: Number, default: 0 },
    maxTemperature: { type: Number, default: 0 },
    waterRequirement: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    suitableSeasons: [{ type: String }],
    suitableIrrigationTypes: [{ type: String }],
    growingDuration: { type: Number, default: 0 },
    averageYield: { type: Number, default: 0 },
    averageMarketPrice: { type: Number, default: 0 },
    estimatedProfit: { type: Number, default: 0 },
    cultivationCost: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, default: '' },
    cultivationProcess: { type: String, default: '' },
    marketDemand: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    farmingTypes: [{ type: String }],
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
    // AI-generated fields
    soilType: { type: String },
    soilPH: { type: Number },
    waterAvailability: { type: String },
    weatherCondition: { type: String },
    district: { type: String },
    state: { type: String },
    season: { type: String },
    suitabilityScore: { type: Number },
    aiRecommendation: { type: String },
    expectedYield: { type: String },
    marketPrice: { type: Number },
    fertilizerPlan: { type: String },
    organicPractices: { type: String },
    diseaseRisks: { type: String },
    irrigationAdvice: { type: String },
    sourceType: { type: String, enum: ['AI', 'Manual'], default: 'Manual' },
    source: { type: String, enum: ['database', 'openai', 'admin'], default: 'admin' },
    createdBy: { type: String },
    status: { type: String, enum: ['active', 'disabled', 'archived'], default: 'active' },
    lastUpdated: { type: Date },
}, { timestamps: true });
// Composite unique index: same crop + soil + district + season = one record
CropKnowledgeBaseSchema.index({ cropName: 1, soilType: 1, district: 1, season: 1 }, { unique: true, sparse: true });
// Fallback unique index for admin-created entries (no context fields)
CropKnowledgeBaseSchema.index({ cropName: 1, sourceType: 1 }, { unique: false });
exports.CropKnowledgeBase = mongoose_1.default.model('CropKnowledgeBase', CropKnowledgeBaseSchema);
//# sourceMappingURL=CropKnowledgeBase.js.map