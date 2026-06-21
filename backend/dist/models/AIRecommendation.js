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
exports.AIRecommendation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RecommendationItemSchema = new mongoose_1.Schema({
    cropName: { type: String, required: true },
    cropCategory: { type: String, required: true },
    suitabilityScore: { type: Number, required: true },
    whySuitable: { type: String },
    waterRequirement: { type: String },
    estimatedCultivationCost: { type: Number },
    estimatedYield: { type: String },
    expectedRevenue: { type: Number },
    expectedProfit: { type: Number },
    marketDemand: { type: String },
    risks: { type: String },
    cultivationGuide: { type: String },
    growingDuration: { type: Number },
    riskLevel: { type: String },
    currentMarketPrice: { type: Number },
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
}, { _id: false });
const FarmerConditionsSchema = new mongoose_1.Schema({
    soilType: { type: String, required: true },
    soilPH: { type: Number, required: true },
    waterAvailability: { type: String, required: true },
    season: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    farmArea: { type: Number, required: true },
    budget: { type: Number, required: true },
    farmingType: { type: String, required: true },
    rainfall: { type: Number },
    averageTemperature: { type: Number },
}, { _id: false });
const AIRecommendationSchema = new mongoose_1.Schema({
    farmerConditions: { type: FarmerConditionsSchema, required: true },
    recommendations: [RecommendationItemSchema],
    source: { type: String, enum: ['database', 'openai'], required: true },
    similarityScore: { type: Number },
    requestId: { type: String, index: true },
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },
    feedbackNote: { type: String },
}, { timestamps: true });
// Index for similarity search
AIRecommendationSchema.index({ 'farmerConditions.soilType': 1, 'farmerConditions.season': 1, 'farmerConditions.district': 1 });
exports.AIRecommendation = mongoose_1.default.model('AIRecommendation', AIRecommendationSchema);
//# sourceMappingURL=AIRecommendation.js.map