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
exports.DiseaseKnowledgeBase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DiseaseKnowledgeBaseSchema = new mongoose_1.Schema({
    cropName: { type: String, required: true, index: true },
    scientificName: { type: String },
    cropCategory: { type: String, required: true },
    diseaseName: { type: String, required: true, index: true },
    diseaseType: { type: String, required: true },
    severityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    description: { type: String, required: true },
    leafSymptoms: { type: String },
    stemSymptoms: { type: String },
    rootSymptoms: { type: String },
    fruitSymptoms: { type: String },
    symptomsDescription: { type: String },
    organicTreatment: { type: String },
    chemicalTreatment: { type: String },
    recommendedProducts: { type: String },
    treatmentDescription: { type: String },
    preventionMethods: { type: String },
    preventionDescription: { type: String },
    diseaseImages: [{ type: String }],
    healthyImages: [{ type: String }],
}, { timestamps: true });
exports.DiseaseKnowledgeBase = mongoose_1.default.model('DiseaseKnowledgeBase', DiseaseKnowledgeBaseSchema);
//# sourceMappingURL=DiseaseKnowledgeBase.js.map