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
exports.SOIL_STANDARDS_DATA = exports.SoilStandard = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const soilStandardSchema = new mongoose_1.Schema({
    soilType: { type: String, required: true, unique: true },
    pH: { min: Number, max: Number, ideal: String },
    nitrogen: { min: Number, max: Number, ideal: String, unit: String },
    phosphorus: { min: Number, max: Number, ideal: String, unit: String },
    potassium: { min: Number, max: Number, ideal: String, unit: String },
    organicCarbon: { min: Number, max: Number, ideal: String, unit: String },
    ec: { min: Number, max: Number, ideal: String, unit: String },
    micronutrients: {
        zinc: { min: Number, max: Number, ideal: String },
        iron: { min: Number, max: Number, ideal: String },
        manganese: { min: Number, max: Number, ideal: String },
        copper: { min: Number, max: Number, ideal: String },
        boron: { min: Number, max: Number, ideal: String },
    },
    description: String,
    commonCrops: [String],
});
exports.SoilStandard = mongoose_1.default.model('SoilStandard', soilStandardSchema);
// Indian soil benchmark data to seed
exports.SOIL_STANDARDS_DATA = [
    {
        soilType: 'Alluvial',
        pH: { min: 6.5, max: 7.5, ideal: '6.5–7.5' },
        nitrogen: { min: 280, max: 560, ideal: '280–560 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 11, max: 22, ideal: '11–22 kg/ha', unit: 'kg/ha' },
        potassium: { min: 110, max: 280, ideal: '110–280 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.5, max: 0.75, ideal: '0.5–0.75%', unit: '%' },
        ec: { min: 0.1, max: 0.8, ideal: '0.1–0.8 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.6, max: 1.2, ideal: '0.6–1.2 mg/kg' },
            iron: { min: 4.5, max: 9.0, ideal: '4.5–9.0 mg/kg' },
            manganese: { min: 2.0, max: 5.0, ideal: '2.0–5.0 mg/kg' },
            copper: { min: 0.2, max: 0.6, ideal: '0.2–0.6 mg/kg' },
            boron: { min: 0.5, max: 1.0, ideal: '0.5–1.0 mg/kg' },
        },
        description: 'Fertile river-deposited soil, best for paddy, wheat, sugarcane.',
        commonCrops: ['Wheat', 'Paddy', 'Sugarcane', 'Mustard', 'Pulses'],
    },
    {
        soilType: 'Black',
        pH: { min: 7.0, max: 8.5, ideal: '7.0–8.5' },
        nitrogen: { min: 280, max: 560, ideal: '280–560 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 7, max: 15, ideal: '7–15 kg/ha', unit: 'kg/ha' },
        potassium: { min: 330, max: 560, ideal: '330–560 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.4, max: 0.7, ideal: '0.4–0.7%', unit: '%' },
        ec: { min: 0.2, max: 1.0, ideal: '0.2–1.0 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.4, max: 1.0, ideal: '0.4–1.0 mg/kg' },
            iron: { min: 3.0, max: 7.0, ideal: '3.0–7.0 mg/kg' },
            manganese: { min: 1.5, max: 4.5, ideal: '1.5–4.5 mg/kg' },
            copper: { min: 0.2, max: 0.8, ideal: '0.2–0.8 mg/kg' },
            boron: { min: 0.3, max: 0.8, ideal: '0.3–0.8 mg/kg' },
        },
        description: 'Self-ploughing cotton soil (Regur), rich in calcium and magnesium.',
        commonCrops: ['Cotton', 'Sorghum', 'Wheat', 'Gram', 'Sunflower'],
    },
    {
        soilType: 'Red',
        pH: { min: 5.5, max: 7.0, ideal: '5.5–7.0' },
        nitrogen: { min: 140, max: 280, ideal: '140–280 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 5, max: 12, ideal: '5–12 kg/ha', unit: 'kg/ha' },
        potassium: { min: 110, max: 220, ideal: '110–220 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.3, max: 0.5, ideal: '0.3–0.5%', unit: '%' },
        ec: { min: 0.1, max: 0.6, ideal: '0.1–0.6 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.3, max: 0.8, ideal: '0.3–0.8 mg/kg' },
            iron: { min: 5.0, max: 12.0, ideal: '5.0–12.0 mg/kg' },
            manganese: { min: 1.5, max: 4.0, ideal: '1.5–4.0 mg/kg' },
            copper: { min: 0.1, max: 0.5, ideal: '0.1–0.5 mg/kg' },
            boron: { min: 0.2, max: 0.7, ideal: '0.2–0.7 mg/kg' },
        },
        description: 'Iron-rich soil of Deccan plateau, low fertility but responds well to fertilizers.',
        commonCrops: ['Groundnut', 'Millets', 'Pulses', 'Tobacco', 'Vegetables'],
    },
    {
        soilType: 'Loamy',
        pH: { min: 6.0, max: 7.0, ideal: '6.0–7.0' },
        nitrogen: { min: 280, max: 560, ideal: '280–560 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 11, max: 25, ideal: '11–25 kg/ha', unit: 'kg/ha' },
        potassium: { min: 140, max: 310, ideal: '140–310 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.6, max: 1.0, ideal: '0.6–1.0%', unit: '%' },
        ec: { min: 0.1, max: 0.7, ideal: '0.1–0.7 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.6, max: 1.5, ideal: '0.6–1.5 mg/kg' },
            iron: { min: 4.5, max: 9.0, ideal: '4.5–9.0 mg/kg' },
            manganese: { min: 2.0, max: 6.0, ideal: '2.0–6.0 mg/kg' },
            copper: { min: 0.2, max: 0.6, ideal: '0.2–0.6 mg/kg' },
            boron: { min: 0.5, max: 1.2, ideal: '0.5–1.2 mg/kg' },
        },
        description: 'Best balanced soil for most crops, ideal water retention and drainage.',
        commonCrops: ['Wheat', 'Maize', 'Vegetables', 'Fruits', 'Pulses'],
    },
    {
        soilType: 'Sandy',
        pH: { min: 5.5, max: 7.0, ideal: '5.5–7.0' },
        nitrogen: { min: 140, max: 280, ideal: '140–280 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 4, max: 10, ideal: '4–10 kg/ha', unit: 'kg/ha' },
        potassium: { min: 85, max: 170, ideal: '85–170 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.2, max: 0.4, ideal: '0.2–0.4%', unit: '%' },
        ec: { min: 0.1, max: 0.4, ideal: '0.1–0.4 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.2, max: 0.6, ideal: '0.2–0.6 mg/kg' },
            iron: { min: 2.0, max: 5.0, ideal: '2.0–5.0 mg/kg' },
            manganese: { min: 1.0, max: 3.0, ideal: '1.0–3.0 mg/kg' },
            copper: { min: 0.1, max: 0.3, ideal: '0.1–0.3 mg/kg' },
            boron: { min: 0.2, max: 0.5, ideal: '0.2–0.5 mg/kg' },
        },
        description: 'Well-drained, low nutrient retention soil, needs frequent irrigation.',
        commonCrops: ['Groundnut', 'Millets', 'Watermelon', 'Cumin', 'Coriander'],
    },
    {
        soilType: 'Clay',
        pH: { min: 6.0, max: 8.0, ideal: '6.0–8.0' },
        nitrogen: { min: 280, max: 560, ideal: '280–560 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 8, max: 18, ideal: '8–18 kg/ha', unit: 'kg/ha' },
        potassium: { min: 200, max: 400, ideal: '200–400 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.5, max: 0.8, ideal: '0.5–0.8%', unit: '%' },
        ec: { min: 0.2, max: 1.2, ideal: '0.2–1.2 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.5, max: 1.2, ideal: '0.5–1.2 mg/kg' },
            iron: { min: 4.0, max: 8.0, ideal: '4.0–8.0 mg/kg' },
            manganese: { min: 2.0, max: 5.0, ideal: '2.0–5.0 mg/kg' },
            copper: { min: 0.2, max: 0.7, ideal: '0.2–0.7 mg/kg' },
            boron: { min: 0.4, max: 1.0, ideal: '0.4–1.0 mg/kg' },
        },
        description: 'High water retention, can become waterlogged; good for paddy.',
        commonCrops: ['Paddy', 'Sugarcane', 'Cotton', 'Wheat', 'Jute'],
    },
    {
        soilType: 'Laterite',
        pH: { min: 4.5, max: 6.0, ideal: '4.5–6.0' },
        nitrogen: { min: 100, max: 200, ideal: '100–200 kg/ha', unit: 'kg/ha' },
        phosphorus: { min: 3, max: 8, ideal: '3–8 kg/ha', unit: 'kg/ha' },
        potassium: { min: 80, max: 160, ideal: '80–160 kg/ha', unit: 'kg/ha' },
        organicCarbon: { min: 0.2, max: 0.4, ideal: '0.2–0.4%', unit: '%' },
        ec: { min: 0.1, max: 0.5, ideal: '0.1–0.5 dS/m', unit: 'dS/m' },
        micronutrients: {
            zinc: { min: 0.3, max: 0.7, ideal: '0.3–0.7 mg/kg' },
            iron: { min: 6.0, max: 15.0, ideal: '6.0–15.0 mg/kg' },
            manganese: { min: 2.0, max: 6.0, ideal: '2.0–6.0 mg/kg' },
            copper: { min: 0.1, max: 0.4, ideal: '0.1–0.4 mg/kg' },
            boron: { min: 0.1, max: 0.4, ideal: '0.1–0.4 mg/kg' },
        },
        description: 'Acidic soil of Western Ghats, low fertility, suitable for cashew, tea, coffee.',
        commonCrops: ['Cashew', 'Tea', 'Coffee', 'Rubber', 'Tapioca'],
    },
];
//# sourceMappingURL=SoilStandard.js.map