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
    diseaseName: { type: String, required: true, index: true },
    scientificName: { type: String },
    cropCategory: { type: String, default: 'General' },
    diseaseType: { type: String, required: true },
    slug: { type: String, index: true },
    description: { type: String, required: true },
    symptoms: { type: String },
    causes: { type: String },
    organicSolution: { type: String },
    chemicalSolution: { type: String },
    prevention: { type: String },
    // Legacy fields — kept so existing AI knowledge_service.py continues to work
    leafSymptoms: { type: String },
    stemSymptoms: { type: String },
    rootSymptoms: { type: String },
    fruitSymptoms: { type: String },
    symptomsDescription: { type: String },
    organicTreatment: { type: String },
    chemicalTreatment: { type: String },
    treatmentDescription: { type: String },
    preventionMethods: { type: String },
    preventionDescription: { type: String },
    recommendedActions: { type: String },
    severityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    affectedPlantPart: { type: String },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
    diseaseImages: [{ type: String }],
    healthyImages: [{ type: String }],
    imageGallery: [{ type: String }],
    videoLinks: [{ type: String }],
    recommendedProducts: { type: String },
    governmentAdvisory: { type: String },
    referenceLinks: [{ type: String }],
    // Extended knowledge fields
    urgentPrevention: { type: String },
    recoveryTips: { type: String },
    dos: { type: String },
    donts: { type: String },
    recommendedFertilizer: { type: String },
    recommendedBioProduct: { type: String },
    recommendedOrganicProduct: { type: String },
    extraFarmerAdvice: { type: String },
    suitableWeather: { type: String },
    adminNotes: { type: String },
    languages: [{ type: String }],
    tags: [{ type: String }],
    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: [{ type: String }],
    createdBy: { type: String },
    updatedBy: { type: String },
    source: { type: String, enum: ['admin', 'ai_auto', 'ai_verified'], default: 'admin' },
    confidenceScore: { type: Number, default: 0 },
    scanCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
DiseaseKnowledgeBaseSchema.index({ cropName: 1, diseaseName: 1 }, { unique: true });
// Auto-generate slug before save
DiseaseKnowledgeBaseSchema.pre('save', function (next) {
    if (!this.slug) {
        this.slug = `${this.cropName}-${this.diseaseName}`
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    // Mirror new fields into legacy fields so knowledge_service.py keeps working
    if (this.symptoms && !this.symptomsDescription)
        this.symptomsDescription = this.symptoms;
    if (this.organicSolution && !this.organicTreatment)
        this.organicTreatment = this.organicSolution;
    if (this.chemicalSolution && !this.chemicalTreatment)
        this.chemicalTreatment = this.chemicalSolution;
    if (this.prevention && !this.preventionMethods)
        this.preventionMethods = this.prevention;
    next();
});
exports.DiseaseKnowledgeBase = mongoose_1.default.model('DiseaseKnowledgeBase', DiseaseKnowledgeBaseSchema);
//# sourceMappingURL=DiseaseKnowledgeBase.js.map