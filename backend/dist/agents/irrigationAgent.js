"use strict";
/**
 * Irrigation Agent
 * Domain: Irrigation schedules, water management, drip/sprinkler guidance
 * Data sources: IrrigationSchedule, SoilMoisture MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIrrigationAgent = runIrrigationAgent;
const IrrigationSchedule_1 = require("../models/IrrigationSchedule");
const SoilMoisture_1 = require("../models/SoilMoisture");
async function runIrrigationAgent(ctx) {
    try {
        const { userId, message, pageData, farmerProfile } = ctx;
        if (pageData?.irrigationData) {
            const d = pageData.irrigationData;
            return {
                agent: 'IrrigationAgent',
                success: true,
                data: d,
                summary: `Irrigation for ${d.cropName || 'crop'}: ${d.irrigationMethod || 'N/A'}, every ${d.intervalDays || 'N/A'} days.`,
            };
        }
        const cropName = extractCropFromMessage(message);
        const irrigationType = extractIrrigationTypeFromMessage(message);
        const filter = {};
        if (cropName)
            filter.cropName = new RegExp(cropName, 'i');
        if (irrigationType)
            filter.irrigationMethod = new RegExp(irrigationType, 'i');
        const schedule = await IrrigationSchedule_1.IrrigationSchedule.findOne(filter).lean();
        if (schedule) {
            const s = schedule;
            return {
                agent: 'IrrigationAgent',
                success: true,
                data: {
                    cropName: s.cropName,
                    irrigationMethod: s.irrigationMethod,
                    intervalDays: s.intervalDays,
                    waterAmount: s.waterAmount,
                    growthStage: s.growthStage,
                    notes: s.notes,
                },
                summary: `Irrigation for ${s.cropName}: ${s.irrigationMethod}, every ${s.intervalDays} days, ${s.waterAmount} water.`,
            };
        }
        // Fallback: soil moisture reading
        const moisture = await SoilMoisture_1.SoilMoisture.findOne({ farmerId: userId })
            .sort({ createdAt: -1 })
            .lean();
        if (moisture) {
            const m = moisture;
            return {
                agent: 'IrrigationAgent',
                success: true,
                data: {
                    soilMoisturePercent: m.moisturePercent,
                    soilMoistureStatus: m.status,
                    recommendation: m.moisturePercent < 30
                        ? 'Soil moisture is low — irrigate immediately.'
                        : m.moisturePercent > 70
                            ? 'Soil moisture is adequate — delay irrigation.'
                            : 'Soil moisture is moderate — monitor and irrigate as needed.',
                },
                summary: `Soil moisture: ${m.moisturePercent}% (${m.status}). ${m.moisturePercent < 30 ? 'Irrigate immediately.' : 'Monitor moisture levels.'}`,
            };
        }
        return {
            agent: 'IrrigationAgent',
            success: true,
            data: {},
            summary: 'No irrigation data found. Guide the farmer to the Irrigation page for schedules and soil moisture readings.',
        };
    }
    catch (err) {
        return {
            agent: 'IrrigationAgent',
            success: false,
            error: 'Irrigation information is temporarily unavailable.',
        };
    }
}
function extractCropFromMessage(msg) {
    const crops = [
        'wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane',
        'potato', 'onion', 'mustard', 'gram', 'soybean', 'bajra', 'jowar',
        'groundnut', 'sunflower', 'chilli', 'brinjal',
    ];
    const lower = msg.toLowerCase();
    return crops.find(c => lower.includes(c)) || '';
}
function extractIrrigationTypeFromMessage(msg) {
    const types = ['drip', 'sprinkler', 'flood', 'furrow', 'surface', 'subsurface'];
    const lower = msg.toLowerCase();
    return types.find(t => lower.includes(t)) || '';
}
//# sourceMappingURL=irrigationAgent.js.map