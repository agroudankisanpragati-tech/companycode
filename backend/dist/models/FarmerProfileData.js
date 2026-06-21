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
exports.FarmerProfileData = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LandParcelSchema = new mongoose_1.Schema({
    name: { type: String, default: '' },
    area: { type: Number, default: 0 },
    unit: { type: String, enum: ['acres', 'hectares', 'bigha'], default: 'acres' },
    soilType: { type: String, default: '' },
    waterSource: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    ownershipType: { type: String, enum: ['owned', 'leased', 'shared'], default: 'owned' },
});
const CropRecordSchema = new mongoose_1.Schema({
    cropName: { type: String, required: true },
    season: { type: String, default: '' },
    sowingDate: { type: String, default: '' },
    harvestDate: { type: String, default: '' },
    yieldKg: { type: Number, default: 0 },
    marketPrice: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    notes: { type: String, default: '' },
});
const schema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    village: { type: String, default: '' },
    pincode: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    experience: { type: Number, default: 0 },
    farmName: { type: String, default: '' },
    totalArea: { type: Number, default: 0 },
    farmingType: { type: String, default: 'Crop Farming' },
    farmingMethod: { type: String, default: 'Traditional' },
    irrigationType: { type: String, default: '' },
    waterAvailability: { type: String, default: 'Medium' },
    soilType: { type: String, default: '' },
    landParcels: { type: [LandParcelSchema], default: [] },
    cropHistory: { type: [CropRecordSchema], default: [] },
}, { timestamps: true });
exports.FarmerProfileData = mongoose_1.default.model('FarmerProfileData', schema);
//# sourceMappingURL=FarmerProfileData.js.map