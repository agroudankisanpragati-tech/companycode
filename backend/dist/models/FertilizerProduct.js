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
exports.FertilizerProduct = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const fertilizerProductSchema = new mongoose_1.Schema({
    shopkeeperId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ShopkeeperProfile', required: true, index: true },
    productName: { type: String, required: true, trim: true },
    brandName: { type: String, default: '' },
    category: { type: String, default: 'Fertilizer' },
    productSubCategory: {
        type: String,
        enum: ['seed', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'micronutrient', 'bio_fertilizer', 'growth_regulator', 'other'],
        default: 'fertilizer',
        index: true,
    },
    cropType: { type: String, default: '', trim: true, index: true },
    variety: { type: String, default: '' },
    productImages: [String],
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'kg' },
    mrp: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    usageInstructions: { type: String, default: '' },
    dosage: { type: String, default: '' },
    cropSuitability: [String],
    nutrientComposition: { type: String, default: '' },
    manufacturingCompany: { type: String, default: '' },
    manufacturingDate: Date,
    expiryDate: Date,
    stockStatus: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock', index: true },
    aiScanned: { type: Boolean, default: false },
}, { timestamps: true });
fertilizerProductSchema.index({ shopkeeperId: 1, stockStatus: 1 });
fertilizerProductSchema.index({ cropType: 1, productSubCategory: 1, stockStatus: 1 });
fertilizerProductSchema.index({ productName: 'text', brandName: 'text', cropType: 'text', variety: 'text', description: 'text' });
exports.FertilizerProduct = mongoose_1.default.model('FertilizerProduct', fertilizerProductSchema);
//# sourceMappingURL=FertilizerProduct.js.map