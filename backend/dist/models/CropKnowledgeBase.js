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
    cropName: { type: String, required: true, unique: true },
    cropCategory: { type: String, enum: ['Traditional', 'Medicinal', 'Fruit', 'Vegetable'], required: true },
    suitableSoilTypes: [{ type: String }],
    minPH: { type: Number, required: true },
    maxPH: { type: Number, required: true },
    minRainfall: { type: Number, required: true },
    maxRainfall: { type: Number, required: true },
    minTemperature: { type: Number, required: true },
    maxTemperature: { type: Number, required: true },
    waterRequirement: { type: String, enum: ['low', 'medium', 'high'], required: true },
    suitableSeasons: [{ type: String }],
    suitableIrrigationTypes: [{ type: String }],
    growingDuration: { type: Number, required: true },
    averageYield: { type: Number, required: true },
    averageMarketPrice: { type: Number, required: true },
    estimatedProfit: { type: Number, required: true },
    cultivationCost: { type: Number, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
    description: { type: String, required: true },
    cultivationProcess: { type: String, required: true },
    marketDemand: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    farmingTypes: [{ type: String }],
    fertilizerRequirement: { type: String },
    fertilizerCost: { type: Number },
    seedRequirement: { type: String },
    recommendedSeedVariety: { type: String },
}, { timestamps: true });
exports.CropKnowledgeBase = mongoose_1.default.model('CropKnowledgeBase', CropKnowledgeBaseSchema);
//# sourceMappingURL=CropKnowledgeBase.js.map