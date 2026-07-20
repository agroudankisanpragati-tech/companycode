"use strict";
/**
 * TrainingDataset Model — Phase 6
 *
 * Versioned registry for speech training datasets.
 * Business logic is NEVER coupled to this model.
 * Datasets are imported, versioned, and validated here.
 * Training is triggered manually by admin — never automatically.
 *
 * Pluggable design: future STT/TTS providers read approved datasets
 * from this registry without any application code changes.
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
exports.TrainingDataset = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TranscriptEntrySchema = new mongoose_1.Schema({
    audioFileRef: { type: String, required: true },
    transcript: { type: String, required: true },
    langCode: { type: String, required: true },
    dialectCode: { type: String },
    duration: { type: Number },
    validated: { type: Boolean, default: false },
    validationNote: { type: String },
}, { _id: false });
const TrainingDatasetSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    version: { type: String, required: true, default: '1.0.0' },
    langCode: { type: String, required: true, index: true },
    dialectCode: { type: String },
    description: { type: String },
    status: {
        type: String,
        enum: ['imported', 'validating', 'validated', 'approved', 'rejected', 'training', 'trained'],
        default: 'imported',
        index: true,
    },
    totalRecordings: { type: Number, default: 0 },
    validatedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    transcripts: { type: [TranscriptEntrySchema], default: [] },
    storageRef: { type: String },
    targetProvider: { type: String },
    importedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    validationErrors: { type: [String], default: [] },
}, { timestamps: true });
// Unique name+version per language
TrainingDatasetSchema.index({ name: 1, version: 1, langCode: 1 }, { unique: true });
exports.TrainingDataset = mongoose_1.default.model('TrainingDataset', TrainingDatasetSchema);
//# sourceMappingURL=TrainingDataset.js.map