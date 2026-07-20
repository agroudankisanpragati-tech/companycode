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
exports.PestKnowledgeBase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PestKnowledgeBaseSchema = new mongoose_1.Schema({
    cropName: { type: String, required: true, index: true },
    pestName: { type: String, required: true, index: true },
    scientificName: { type: String },
    slug: { type: String, index: true },
    description: { type: String, required: true },
    symptoms: { type: String },
    damageSymptoms: { type: String },
    organicControl: { type: String },
    chemicalControl: { type: String },
    biologicalControl: { type: String },
    preventiveMeasures: { type: String },
    lifeCycle: { type: String },
    affectedPlantPart: { type: String },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
    images: [{ type: String }],
    videos: [{ type: String }],
    recommendedProducts: { type: String },
    governmentAdvisory: { type: String },
    references: [{ type: String }],
    languages: [{ type: String }],
    tags: [{ type: String }],
    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: [{ type: String }],
    createdBy: { type: String },
    updatedBy: { type: String },
}, { timestamps: true });
PestKnowledgeBaseSchema.index({ cropName: 1, pestName: 1 }, { unique: true });
PestKnowledgeBaseSchema.pre('save', function (next) {
    if (!this.slug) {
        this.slug = `${this.cropName}-${this.pestName}`
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});
exports.PestKnowledgeBase = mongoose_1.default.model('PestKnowledgeBase', PestKnowledgeBaseSchema);
//# sourceMappingURL=PestKnowledgeBase.js.map