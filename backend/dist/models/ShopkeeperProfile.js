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
exports.ShopkeeperProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shopkeeperProfileSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    shopType: { type: String, enum: ['fertilizer', 'nursery'], required: true },
    shopName: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    mobileNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    village: { type: String, default: '' },
    tehsil: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    profileImage: String,
    coverImage: String,
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    registrationDate: Date,
    gstNumber: String,
    gstCertificate: String,
    shopLicenseNumber: String,
    shopRegistrationImage: String,
    nurseryName: String,
    nurseryPhoto: String,
    nurseryDescription: String,
    nurseryRegistrationCertificate: String,
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    verifiedAt: Date,
    verifiedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    rejectedAt: Date,
    reApplicationAllowed: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false, index: true },
    verificationSubmitted: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
}, { timestamps: true });
shopkeeperProfileSchema.index({ district: 1, state: 1 });
shopkeeperProfileSchema.index({ latitude: 1, longitude: 1 });
shopkeeperProfileSchema.index({ shopType: 1, verificationStatus: 1 });
exports.ShopkeeperProfile = mongoose_1.default.model('ShopkeeperProfile', shopkeeperProfileSchema);
//# sourceMappingURL=ShopkeeperProfile.js.map