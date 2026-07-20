"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const SoilReport_1 = require("../models/SoilReport");
const fertilizerCalculatorService_1 = require("../services/fertilizerCalculatorService");
const router = express_1.default.Router();
// GET /api/fertilizer-calculator/meta — crops list + area units
router.get('/meta', (_req, res) => {
    res.json({ success: true, crops: fertilizerCalculatorService_1.SUPPORTED_CROPS, areaUnits: fertilizerCalculatorService_1.AREA_UNITS });
});
// POST /api/fertilizer-calculator/calculate
// Body: { crop, areaValue, areaUnit, soilReportId? }
// If soilReportId provided → auto-loads soil nutrients from DB
router.post('/calculate', auth_1.authenticate, async (req, res) => {
    try {
        const { crop, areaValue, areaUnit, soilReportId } = req.body;
        if (!crop || !areaValue || !areaUnit) {
            return res.status(400).json({ error: 'crop, areaValue, and areaUnit are required' });
        }
        const area = parseFloat(areaValue);
        if (isNaN(area) || area <= 0) {
            return res.status(400).json({ error: 'areaValue must be a positive number' });
        }
        let soil;
        if (soilReportId) {
            const report = await SoilReport_1.SoilReport.findById(soilReportId).lean();
            if (report && report.farmerId.toString() === req.user.userId) {
                soil = {
                    nitrogen: report.nitrogen,
                    phosphorus: report.phosphorus,
                    potassium: report.potassium,
                    organicCarbon: report.organicCarbon,
                    pH: report.pH,
                };
            }
        }
        else {
            // Try latest soil report automatically
            const latest = await SoilReport_1.SoilReport.findOne({ farmerId: req.user.userId })
                .sort({ createdAt: -1 })
                .select('nitrogen phosphorus potassium organicCarbon pH')
                .lean();
            if (latest) {
                soil = {
                    nitrogen: latest.nitrogen,
                    phosphorus: latest.phosphorus,
                    potassium: latest.potassium,
                    organicCarbon: latest.organicCarbon,
                    pH: latest.pH,
                };
            }
        }
        const result = (0, fertilizerCalculatorService_1.calculateFertilizer)({ crop, areaValue: area, areaUnit, soil });
        return res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('Fertilizer calculator error:', err);
        res.status(500).json({ error: err.message || 'Calculation failed' });
    }
});
// GET /api/fertilizer-calculator/soil-reports — list farmer's soil reports for selector
router.get('/soil-reports', auth_1.authenticate, async (req, res) => {
    try {
        const reports = await SoilReport_1.SoilReport.find({ farmerId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('soilType soilHealthScore soilHealthStatus createdAt nitrogen phosphorus potassium')
            .lean();
        res.json({ success: true, data: reports });
    }
    catch {
        res.status(500).json({ error: 'Failed to fetch soil reports' });
    }
});
exports.default = router;
//# sourceMappingURL=fertilizerCalculator.js.map