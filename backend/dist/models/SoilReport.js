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
exports.SoilReport = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const soilReportSchema = new mongoose_1.Schema({
    farmerId: { type: String, required: true, index: true },
    reportUrl: { type: String },
    uploadDate: { type: Date, default: Date.now },
    soilType: { type: String },
    pH: { type: Number },
    nitrogen: { type: Number },
    phosphorus: { type: Number },
    potassium: { type: Number },
    organicCarbon: { type: Number },
    ec: { type: Number },
    micronutrients: {
        zinc: Number,
        iron: Number,
        manganese: Number,
        copper: Number,
        boron: Number,
    },
    soilHealthScore: { type: Number, min: 0, max: 100 },
    soilHealthStatus: {
        type: String,
        enum: ['Excellent', 'Good', 'Moderate', 'Poor', 'Critical'],
    },
    deficiencies: [
        {
            nutrient: String,
            type: { type: String, enum: ['Low', 'Excess', 'Imbalance'] },
            severity: { type: String, enum: ['Low', 'Medium', 'High'] },
            description: String,
        },
    ],
    benchmarkComparison: [
        {
            parameter: String,
            farmerValue: mongoose_1.Schema.Types.Mixed,
            idealValue: String,
            status: { type: String, enum: ['Optimal', 'Low', 'High', 'Deficient'] },
        },
    ],
    recommendations: {
        organic: [String],
        fertilizer: [String],
        reasoning: String,
    },
    cropRecommendations: [
        {
            cropName: String,
            suitabilityScore: Number,
            expectedBenefits: String,
            reason: String,
        },
    ],
    aiAnalysis: { type: String },
}, { timestamps: true });
exports.SoilReport = mongoose_1.default.model('SoilReport', soilReportSchema);
//# sourceMappingURL=SoilReport.js.map