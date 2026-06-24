import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User } from '../models/User';
import { SoilMoisture } from '../models/SoilMoisture';

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
  skip: () => process.env.NODE_ENV === 'development',
});

const SYSTEM_PROMPT = `You are Agrodan Kisan Pragati AI Copilot, an expert agricultural assistant helping Indian farmers.

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

LANGUAGE RULES:
- CRITICAL: Always detect and respond in the SAME language the farmer uses
- If farmer writes in Hindi → respond fully in Hindi
- If farmer writes in Marathi → respond in Marathi
- If farmer writes in Hinglish → respond in Hinglish
- If farmer writes in English → respond in English
- Use simple, farmer-friendly language with practical advice
- Use bullet points and emojis where helpful
- Keep responses concise and actionable`;

// GET /api/ai-assistant/dashboard-context — fetch live dashboard data for AI context
router.get('/dashboard-context', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const farmer = await User.findById(farmerId).select('name location farmSize soilType');
    const moisture = await SoilMoisture.findOne({ farmerId }).select('moisturePercentage moistureStatus lastUpdated');

    // Fetch live weather
    let weather: any = null;
    if (farmer?.location?.state && farmer?.location?.district) {
      try {
        const baseUrl = process.env.WEATHER_API_BASE_URL || 'http://localhost:4000';
        const wRes = await fetch(
          `${baseUrl}/api/weather?location=${encodeURIComponent(`${farmer.location.district}, ${farmer.location.state}, India`)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (wRes.ok) {
          const wData = await wRes.json() as any;
          weather = wData?.data?.current ?? wData?.current ?? null;
        }
      } catch { /* non-critical */ }
    }

    res.json({
      success: true,
      data: {
        farmer: farmer ? { name: (farmer as any).name, location: (farmer as any).location, farmSize: (farmer as any).farmSize, soilType: (farmer as any).soilType } : null,
        soilMoisture: moisture ? { percentage: (moisture as any).moisturePercentage, status: (moisture as any).moistureStatus } : null,
        weather: weather ? {
          temp: weather.temp_c,
          humidity: weather.humidity,
          condition: weather.condition?.text,
          wind: weather.wind_kph,
          precip: weather.precip_mm,
        } : null,
      },
    });
  } catch (err: any) {
    console.error('[AI Assistant] dashboard-context error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard context' });
  }
});

// POST /api/ai-assistant/chat
router.post('/chat', authenticate, chatLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messages, dashboardContext } = req.body as {
      messages: { role: string; content: string }[];
      dashboardContext?: Record<string, any>;
    };

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
      const farmer = await User.findById(req.user!.userId).select('name location farmSize soilType');
      if (farmer) {
        const f = farmer as any;
        contextBlock += `\n\nFARMER CONTEXT:\nName: ${f.name}\nLocation: ${f.location?.district || 'Unknown'}, ${f.location?.state || 'Unknown'}\nFarm Size: ${f.farmSize || 'Unknown'} acres\nSoil Type: ${f.soilType || 'Unknown'}`;
      }
    } catch { /* non-critical */ }

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
        'X-Title': 'Kisan Pragati AI Assistant',
      },
      body: JSON.stringify(payload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => aiRes.statusText);
      console.error('[AI Assistant] API error:', errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    const data = await aiRes.json() as any;
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response. Please try again.';

    res.json({ success: true, reply });
  } catch (err: any) {
    console.error('[AI Assistant] error:', err.message);
    res.status(500).json({ error: 'Failed to process your message. Please try again.' });
  }
});

export default router;
