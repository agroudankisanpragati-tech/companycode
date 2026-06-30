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
const router = express_1.default.Router();
const chatLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment.' },
    skip: () => process.env.NODE_ENV === 'development',
});
const SYSTEM_PROMPT = `You are Pragati AI, an intelligent agriculture assistant helping Indian farmers. You are part of the Agroudan Kisan Pragati platform.

You are both a PLATFORM GUIDE and an AGRICULTURE EXPERT. Help farmers with:

AGRICULTURE EXPERTISE:
- Crop recommendations based on soil, season, region
- Pest management and plant disease diagnosis
- Fertilizer recommendations (NPK ratios, organic alternatives)
- Irrigation guidance and water management
- Soil health improvement
- Weather-based farming decisions
- Organic farming practices
- Government agriculture schemes (PM-KISAN, KCC, PMFBY, eNAM, Soil Health Card, etc.)
- Market prices and crop selling strategies
- Livestock basics
- Farm management and planning

PLATFORM FEATURES:
1. AI Crop Advisor (/crop-recommendation) — soil type, pH, water, season, budget → 7 crop recommendations
2. Soil Health (/dashboard/farmer/soil-health) — upload soil report → Health Score, deficiencies, fertilizer plan
3. Disease Detection (/disease-detection) — upload leaf image → disease name, causes, treatment
4. Weather (/weather) — live forecast by location
5. Market Prices (/dashboard/farmer/market) — live mandi prices via data.gov.in
6. Government Schemes (/schemes) — central and state schemes with eligibility
7. My Crops (/dashboard/farmer/my-crops) — track growing crops
8. Dashboard (/dashboard/farmer) — Weather, Soil Moisture, Crop Advisor, Market, Disease Scan cards

RESPONSE FORMAT:
- ALWAYS return valid JSON with exactly this structure:
{
  "native": "<response in the target language>",
  "hindi": "<same response translated to Hindi>",
  "english": "<same response translated to English>"
}
- The "native" field is the PRIMARY response. Write it in the language specified by USER LANGUAGE PREFERENCE, or auto-detect from user message if no preference is given.
- Always fill all three fields.
- Use simple, farmer-friendly language with bullet points and emojis.
- Keep responses concise and actionable.
- Ensure correct Unicode for all Indian scripts.`;
// GET /api/ai-assistant/dashboard-context — fetch live dashboard data for AI context
router.get('/dashboard-context', auth_1.authenticate, async (req, res) => {
    try {
        const farmerId = req.user.userId;
        const farmer = await User_1.User.findById(farmerId).select('name location farmSize soilType');
        const moisture = await SoilMoisture_1.SoilMoisture.findOne({ farmerId }).select('moisturePercentage moistureStatus lastUpdated');
        // Fetch live weather
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
                farmer: farmer ? { name: farmer.name, location: farmer.location, farmSize: farmer.farmSize, soilType: farmer.soilType } : null,
                soilMoisture: moisture ? { percentage: moisture.moisturePercentage, status: moisture.moistureStatus } : null,
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
router.post('/chat', auth_1.authenticate, chatLimiter, async (req, res) => {
    try {
        const { messages, dashboardContext, selectedLang } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }
        // Validate message roles
        const validRoles = ['user', 'assistant'];
        if (messages.some((m) => !validRoles.includes(m.role) || typeof m.content !== 'string')) {
            return res.status(400).json({ error: 'Invalid message format' });
        }
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL || 'openai/gpt-4o-mini';
        const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        if (!apiKey) {
            return res.status(500).json({ error: 'AI service not configured' });
        }
        // Build dynamic context block
        let contextBlock = '';
        try {
            const farmer = await User_1.User.findById(req.user.userId).select('name location farmSize soilType');
            if (farmer) {
                const f = farmer;
                contextBlock += `\n\nFARMER CONTEXT:\nName: ${f.name}\nLocation: ${f.location?.district || 'Unknown'}, ${f.location?.state || 'Unknown'}\nFarm Size: ${f.farmSize || 'Unknown'} acres\nSoil Type: ${f.soilType || 'Unknown'}`;
            }
        }
        catch { /* non-critical */ }
        // Inject dashboard data if provided
        if (dashboardContext) {
            const { weather, soilMoisture } = dashboardContext;
            if (weather) {
                contextBlock += `\n\nLIVE DASHBOARD DATA:\nWeather: ${weather.condition || 'N/A'}, Temp: ${weather.temp !== undefined ? weather.temp + '°C' : 'N/A'}, Humidity: ${weather.humidity !== undefined ? weather.humidity + '%' : 'N/A'}, Wind: ${weather.wind !== undefined ? weather.wind + ' km/h' : 'N/A'}, Rainfall: ${weather.precip !== undefined ? weather.precip + ' mm' : 'N/A'}`;
            }
            if (soilMoisture) {
                contextBlock += `\nSoil Moisture: ${soilMoisture.percentage}% (${soilMoisture.status})`;
            }
        }
        const langNames = {
            en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi',
            bn: 'Bengali', as: 'Assamese', or: 'Odia', te: 'Telugu', ta: 'Tamil',
            kn: 'Kannada', ml: 'Malayalam', ur: 'Urdu', sa: 'Sanskrit', kok: 'Konkani',
            ks: 'Kashmiri', mni: 'Manipuri', brx: 'Bodo', doi: 'Dogri', sat: 'Santali',
            mai: 'Maithili', ne: 'Nepali', sd: 'Sindhi', raj: 'Rajasthani',
        };
        if (selectedLang && langNames[selectedLang]) {
            contextBlock += `\n\nLANGUAGE INSTRUCTION (MANDATORY): The user has selected "${langNames[selectedLang]}" as their preferred language. You MUST write the "native" JSON field entirely and only in ${langNames[selectedLang]} script. Do not mix any other language into the "native" field. The "hindi" field must be in Hindi. The "english" field must be in English.`;
        }
        else {
            contextBlock += `\n\nLANGUAGE INSTRUCTION (MANDATORY): Detect the language/script of the user's last message. Write the "native" JSON field in exactly that same language. For example, if the user wrote in Tamil script, write "native" in Tamil. If in Punjabi, write in Punjabi. If in English, write in English. The "hindi" field must always be in Hindi. The "english" field must always be in English.`;
        }
        const payload = {
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + contextBlock },
                ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.4,
            max_tokens: 1000,
        };
        const aiRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                'X-Title': 'Pragati AI',
            },
            body: JSON.stringify(payload),
        });
        if (!aiRes.ok) {
            const errText = await aiRes.text().catch(() => aiRes.statusText);
            console.error('[AI Assistant] API error:', errText);
            return res.status(502).json({
                error: 'AI service temporarily unavailable. Please try again.',
                hindi: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।',
            });
        }
        const data = await aiRes.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
        // Parse bilingual JSON or fallback to plain text
        let bilingual;
        // Strip markdown code fences if AI wrapped JSON in ```
        const cleaned = rawContent.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            bilingual = {
                english: parsed.english || parsed.native || cleaned,
                hindi: parsed.hindi || parsed.native || cleaned,
                native: parsed.native || parsed.english || cleaned,
                timestamp: new Date().toISOString(),
                source: 'AI',
            };
        }
        catch {
            bilingual = {
                english: cleaned || 'Sorry, I could not generate a response. Please try again.',
                hindi: cleaned || 'माफ करें, उत्तर नहीं मिला। कृपया पुनः प्रयास करें।',
                native: cleaned,
                timestamp: new Date().toISOString(),
                source: 'AI',
            };
        }
        res.json({ success: true, reply: bilingual.native || bilingual.english, bilingual });
    }
    catch (err) {
        console.error('[AI Assistant] error:', err.message);
        res.status(500).json({
            error: 'Failed to process your message. Please try again.',
            hindi: 'आपका संदेश प्रوसेस नहीं हो सका। कृपया पुनः प्रयास करें।',
        });
    }
});
exports.default = router;
//# sourceMappingURL=aiAssistant.js.map