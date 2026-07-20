"use strict";
/**
 * TranslationCache Model — Phase 5
 *
 * Persistent translation cache stored in MongoDB.
 * Extends the in-process Map cache in speechTranslationPipeline.ts
 * so translations survive server restarts.
 *
 * Key: normalizedSourceText + targetLang (compound unique index)
 * TTL: 30 days (auto-expire via MongoDB TTL index)
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
exports.TranslationCache = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TranslationCacheSchema = new mongoose_1.Schema({
    sourceKey: { type: String, required: true },
    targetLang: { type: String, required: true },
    translatedText: { type: String, required: true },
    sourceLang: { type: String },
    hitCount: { type: Number, default: 1 },
    lastAccessedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Compound unique index — one translation per source+lang pair
TranslationCacheSchema.index({ sourceKey: 1, targetLang: 1 }, { unique: true });
// TTL index — auto-expire after 30 days of no access
TranslationCacheSchema.index({ lastAccessedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
exports.TranslationCache = mongoose_1.default.model('TranslationCache', TranslationCacheSchema);
//# sourceMappingURL=TranslationCache.js.map