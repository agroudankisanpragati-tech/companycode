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
exports.FarmerStory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FarmerStorySchema = new mongoose_1.Schema({
    farmerName: { type: String, required: true },
    village: { type: String },
    district: { type: String },
    state: { type: String },
    cropName: { type: String },
    title: { type: String, required: true },
    caption: { type: String },
    successDescription: { type: String },
    category: {
        type: String,
        enum: ['Success Story', 'Organic Farming', 'Medicinal Farming', 'High Profit Farming', 'Innovation', 'Water Saving', 'Technology Adoption'],
        default: 'Success Story',
    },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    featured: { type: Boolean, default: false },
    uploadedBy: { type: String, index: true },
    uploadedByAdmin: { type: Boolean, default: false },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    savedBy: [{ type: String }],
}, { timestamps: true });
FarmerStorySchema.index({ status: 1, createdAt: -1 });
FarmerStorySchema.index({ featured: 1, status: 1 });
exports.FarmerStory = mongoose_1.default.model('FarmerStory', FarmerStorySchema);
//# sourceMappingURL=FarmerStory.js.map