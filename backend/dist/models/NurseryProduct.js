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
exports.NurseryProduct = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const nurseryProductSchema = new mongoose_1.Schema({
    shopkeeperId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ShopkeeperProfile', required: true, index: true },
    plantName: { type: String, required: true, trim: true },
    variety: { type: String, default: '' },
    productImages: [String],
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    availableQuantity: { type: Number, default: 0, min: 0 },
    plantAge: { type: String, default: '' },
    plantHeight: { type: String, default: '' },
    sunlightRequirement: { type: String, default: '' },
    waterRequirement: { type: String, default: '' },
    suitableSeason: [String],
    growthDuration: { type: String, default: '' },
    maintenanceLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    organicCertified: { type: Boolean, default: false },
    stockStatus: { type: String, enum: ['in_stock', 'out_of_stock'], default: 'in_stock', index: true },
}, { timestamps: true });
nurseryProductSchema.index({ shopkeeperId: 1, stockStatus: 1 });
nurseryProductSchema.index({ plantName: 'text', variety: 'text', description: 'text' });
exports.NurseryProduct = mongoose_1.default.model('NurseryProduct', nurseryProductSchema);
//# sourceMappingURL=NurseryProduct.js.map