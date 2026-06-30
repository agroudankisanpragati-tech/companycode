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
exports.FarmerCropRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FarmerCropRequestSchema = new mongoose_1.Schema({
    farmerId: { type: String, required: true, index: true },
    farmArea: { type: Number, required: true },
    areaUnit: { type: String, enum: ['acre', 'bigha', 'hectare'], default: 'acre' },
    state: { type: String, required: true },
    district: { type: String, required: true },
    village: { type: String },
    soilType: { type: String, required: true },
    soilPH: { type: Number, required: true },
    organicCarbon: { type: Number },
    nitrogen: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    ecValue: { type: Number },
    waterAvailability: { type: String, enum: ['low', 'medium', 'high'], required: true },
    irrigationType: { type: String, required: true },
    rainfall: { type: Number },
    averageTemperature: { type: Number },
    season: { type: String, enum: ['Kharif', 'Rabi', 'Zaid', 'Year-round'], required: true },
    farmingType: { type: String, enum: ['organic', 'conventional', 'mixed'], default: 'conventional' },
    budget: { type: Number, required: true },
    previousCrop: { type: String },
    preferredCrop: { type: String },
    translations: { type: Map, of: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
exports.FarmerCropRequest = mongoose_1.default.model('FarmerCropRequest', FarmerCropRequestSchema);
//# sourceMappingURL=FarmerCropRequest.js.map