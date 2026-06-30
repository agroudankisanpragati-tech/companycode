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
exports.GovtScheme = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const govtSchemeSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    audience: { type: String, required: true, trim: true },
    benefits: [{ type: String, trim: true }],
    eligibility: { type: String, trim: true },
    requiredDocuments: [{ type: String, trim: true }],
    applicationProcess: { type: String, trim: true },
    applicationLink: { type: String, trim: true },
    officialLink: { type: String, trim: true },
    coverImage: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    videos: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true, lowercase: true }],
    keywords: [{ type: String, trim: true, lowercase: true }],
    schemeType: { type: String, enum: ['central', 'state'], default: 'central' },
    state: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    source: { type: String, enum: ['admin', 'api'], default: 'admin' },
    createdBy: { type: String, trim: true },
    publishedAt: { type: Date },
}, { timestamps: true });
govtSchemeSchema.index({ createdAt: -1 });
govtSchemeSchema.index({ schemeType: 1, state: 1 });
govtSchemeSchema.index({ tags: 1 });
govtSchemeSchema.index({ keywords: 1 });
govtSchemeSchema.index({ title: 'text', summary: 'text', description: 'text', keywords: 'text', tags: 'text', state: 'text' });
exports.GovtScheme = mongoose_1.default.model('GovtScheme', govtSchemeSchema);
//# sourceMappingURL=GovtScheme.js.map