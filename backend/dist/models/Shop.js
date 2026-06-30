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
exports.Shop = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shopSchema = new mongoose_1.Schema({
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true },
    businessType: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    gstNumber: String,
    panNumber: String,
    phone: { type: String, required: true },
    whatsapp: String,
    email: String,
    website: String,
    facebook: String,
    instagram: String,
    youtube: String,
    telegram: String,
    emergencyContact: String,
    logo: String,
    cover: String,
    address: {
        state: { type: String, default: '' },
        district: { type: String, default: '' },
        tehsil: String,
        village: String,
        pincode: String,
        landmark: String,
        fullAddress: { type: String, default: '' },
    },
    location: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        googleDirectionLink: String,
        placeName: String,
    },
    openingTime: String,
    closingTime: String,
    workingDays: [String],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending', index: true },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: String,
    deletedAt: Date,
}, { timestamps: true });
shopSchema.index({ 'address.state': 1, 'address.district': 1 });
shopSchema.index({ category: 1, status: 1 });
shopSchema.index({ name: 'text', description: 'text', 'address.fullAddress': 'text' });
exports.Shop = mongoose_1.default.model('Shop', shopSchema);
//# sourceMappingURL=Shop.js.map