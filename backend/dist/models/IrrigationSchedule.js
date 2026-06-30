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
exports.IrrigationSchedule = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const irrigationLogSchema = new mongoose_1.Schema({
    date: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    method: { type: String, required: true },
    aiDecision: { type: String },
    soilMoistureAtTime: { type: Number },
    weatherCondition: { type: String },
});
const irrigationScheduleSchema = new mongoose_1.Schema({
    farmerId: { type: String, required: true },
    cropName: { type: String, default: 'General' },
    fieldName: { type: String, default: 'My Field' },
    irrigationMethod: { type: String, enum: ['drip', 'sprinkler', 'flood', 'furrow'], default: 'drip' },
    fieldAreaAcres: { type: Number, default: 1 },
    soilType: { type: String, default: 'Loamy' },
    currentMoisture: { type: Number, default: 50 },
    moistureStatus: { type: String, default: 'Moderate' },
    aiDecision: { type: String, default: 'monitor' },
    aiReason: { type: String, default: '' },
    aiReasonHindi: { type: String, default: '' },
    recommendedDurationMinutes: { type: Number, default: 0 },
    nextIrrigationDate: { type: Date, default: null },
    rainForecastMm: { type: Number, default: 0 },
    rainForecastDays: { type: Number, default: 0 },
    weatherCondition: { type: String, default: 'Clear' },
    temperature: { type: Number, default: 28 },
    humidity: { type: Number, default: 60 },
    alertSent: { type: Boolean, default: false },
    logs: { type: [irrigationLogSchema], default: [] },
    lastAnalyzed: { type: Date, default: Date.now },
}, { timestamps: true });
irrigationScheduleSchema.index({ farmerId: 1 }, { unique: true });
exports.IrrigationSchedule = mongoose_1.default.model('IrrigationSchedule', irrigationScheduleSchema);
//# sourceMappingURL=IrrigationSchedule.js.map