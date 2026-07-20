"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const SoilMoisture_1 = require("../models/SoilMoisture");
const pragatiAIController_1 = require("../services/pragatiAIController");
const router = express_1.default.Router();
const chatLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment.' },
    skip: () => process.env.NODE_ENV === 'development',
});
// GET /api/ai-assistant/dashboard-context — fetch live dashboard data for AI context
router.get('/dashboard-context', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const farmer = await User_1.User.findById(farmerId).select('name location farmSize soilType');
        const moisture = await SoilMoisture_1.SoilMoisture.findOne({ farmerId }).select('moisturePercentage moistureStatus lastUpdated');
        let weather = null;
        if (farmer?.location?.state && farmer?.location?.district) {
            try {
                const baseUrl = process.env.WEATHER_API_BASE_URL || 'http://localhost:4000';
                const wRes = await fetch(`${baseUrl}/api/weather?location=${encodeURIComponent(`${farmer.location.district}, ${farmer.location.state}, India`)}`, { signal: AbortSignal.timeout(5000) });
                if (wRes.ok) {
                    const wData = await wRes.json();
                    weather = wData?.data?.current ?? wData?.current ?? null;
                }
            }
            catch { /* non-critical */ }
        }
        res.json({
            success: true,
            data: {
                farmer: farmer ? {
                    name: farmer.name,
                    location: farmer.location,
                    farmSize: farmer.farmSize,
                    soilType: farmer.soilType,
                } : null,
                soilMoisture: moisture ? {
                    percentage: moisture.moisturePercentage,
                    status: moisture.moistureStatus,
                } : null,
                weather: weather ? {
                    temp: weather.temp_c,
                    humidity: weather.humidity,
                    condition: weather.condition?.text,
                    wind: weather.wind_kph,
                    precip: weather.precip_mm,
                } : null,
            },
        });
    }
    catch (err) {
        console.error('[AI Assistant] dashboard-context error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch dashboard context' });
    }
});
// POST /api/ai-assistant/chat
// Entry point → Pragati AI Controller (Root Agent)
router.post('/chat', auth_1.authenticate, chatLimiter, async (req, res) => {
    try {
        const { messages, dashboardContext, selectedLang, pageData } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }
        const validRoles = ['user', 'assistant'];
        if (messages.some(m => !validRoles.includes(m.role) || typeof m.content !== 'string')) {
            return res.status(400).json({ error: 'Invalid message format' });
        }
        // Resolve farmer profile
        let farmerProfile;
        try {
            const farmer = await User_1.User.findById(req.user.userId)
                .select('name location farmSize soilType')
                .lean();
            if (farmer) {
                const f = farmer;
                farmerProfile = {
                    name: f.name,
                    district: f.location?.district,
                    state: f.location?.state,
                    farmSize: f.farmSize != null ? String(f.farmSize) : undefined,
                    soilType: f.soilType,
                };
            }
        }
        catch { /* non-critical */ }
        const langCode = selectedLang || req.langCode || 'hi';
        // ── Pragati AI Controller — Root Agent ────────────────────────────────────
        const result = await (0, pragatiAIController_1.runPragatiAIController)({
            userId: req.user.userId,
            messages,
            langCode,
            pageData,
            dashboardContext,
            farmerProfile,
        });
        return res.json({
            success: result.success,
            reply: result.reply,
            bilingual: result.bilingual,
            intent: result.intent,
            agentsUsed: result.agentsUsed,
            localAnswered: result.localAnswered,
        });
    }
    catch (err) {
        console.error('[AI Assistant] error:', err.message);
        res.status(500).json({
            error: 'Failed to process your message. Please try again.',
            hindi: 'आपका संदेश प्रोसेस नहीं हो सका। कृपया पुनः प्रयास करें।',
        });
    }
});
exports.default = router;
//# sourceMappingURL=aiAssistant.js.map