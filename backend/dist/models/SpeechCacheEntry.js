"use strict";
/**
 * SpeechCacheEntry Model — Phase 6
 *
 * Caches common speech responses (TTS text + metadata) so they can be
 * served offline or without repeated AI/translation calls.
 *
 * Security rules:
 * - Raw audio is NEVER stored here (only text + metadata).
 * - Audio blobs are stored externally only if explicitly enabled.
 * - This model stores only the text payload and pronunciation hints.
 *
 * TTL: 7 days (MongoDB TTL index on lastAccessedAt).
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
exports.SpeechCacheEntry = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SpeechCacheEntrySchema = new mongoose_1.Schema({
    textKey: { type: String, required: true },
    langBcp47: { type: String, required: true },
    langCode: { type: String, required: true },
    ttsText: { type: String, required: true },
    displayText: { type: String, required: true },
    pageContext: { type: String },
    hitCount: { type: Number, default: 1 },
    lastAccessedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Compound unique index — one entry per text+lang pair
SpeechCacheEntrySchema.index({ textKey: 1, langBcp47: 1 }, { unique: true });
// TTL — auto-expire after 7 days of no access
SpeechCacheEntrySchema.index({ lastAccessedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
exports.SpeechCacheEntry = mongoose_1.default.model('SpeechCacheEntry', SpeechCacheEntrySchema);
//# sourceMappingURL=SpeechCacheEntry.js.map