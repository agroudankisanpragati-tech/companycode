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
exports.ShopProduct = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shopProductSchema = new mongoose_1.Schema({
    shopId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    sku: String,
    category: { type: String, required: true },
    subcategory: String,
    brand: String,
    description: { type: String, default: '' },
    specifications: { type: Map, of: String },
    mrp: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    tax: Number,
    stock: { type: Number, default: 0, min: 0 },
    minOrderQty: { type: Number, default: 1, min: 1 },
    unit: { type: String, default: 'piece' },
    images: [String],
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'out_of_stock', 'deleted'], default: 'active', index: true },
    tags: [String],
    weight: Number,
    dimensions: { length: Number, width: Number, height: Number },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: String,
    totalViews: { type: Number, default: 0 },
    deletedAt: Date,
}, { timestamps: true });
shopProductSchema.index({ shopId: 1, slug: 1 }, { unique: true });
shopProductSchema.index({ category: 1, status: 1 });
shopProductSchema.index({ name: 'text', description: 'text', brand: 'text' });
exports.ShopProduct = mongoose_1.default.model('ShopProduct', shopProductSchema);
//# sourceMappingURL=ShopProduct.js.map