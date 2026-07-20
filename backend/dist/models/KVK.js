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
exports.KVK = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const KVKSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    village: { type: String, default: '', trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, default: '', trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phone: { type: String, default: '', trim: true },
    altPhone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    website: { type: String, default: '', trim: true },
    officeTimings: { type: String, default: '', trim: true },
    servicesOffered: { type: [String], default: [] },
    notes: { type: String, default: '', trim: true },
    photoUrl: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
}, { timestamps: true });
// Compound index to prevent exact duplicates
KVKSchema.index({ name: 1, district: 1, state: 1 }, { unique: true });
// Geospatial-style index for fast distance queries
KVKSchema.index({ latitude: 1, longitude: 1 });
KVKSchema.index({ state: 1, district: 1 });
exports.KVK = mongoose_1.default.model('KVK', KVKSchema);
//# sourceMappingURL=KVK.js.map