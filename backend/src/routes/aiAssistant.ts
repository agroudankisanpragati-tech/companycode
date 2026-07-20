import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User } from '../models/User';
import { SoilMoisture } from '../models/SoilMoisture';
import { type PageData } from '../services/contextEngine';
import { runPragatiAIController } from '../services/pragatiAIController';

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// GET /api/ai-assistant/dashboard-context — fetch live dashboard data for AI context
router.get('/dashboard-context', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const farmer   = await User.findById(farmerId).select('name location farmSize soilType');
    const moisture = await SoilMoisture.findOne({ farmerId }).select('moisturePercentage moistureStatus lastUpdated');

    let weather: any = null;
    if ((farmer as any)?.location?.state && (farmer as any)?.location?.district) {
      try {
        const baseUrl = process.env.WEATHER_API_BASE_URL || 'http://localhost:4000';
        const wRes = await fetch(
          `${baseUrl}/api/weather?location=${encodeURIComponent(`${(farmer as any).location.district}, ${(farmer as any).location.state}, India`)}`,
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
        farmer: farmer ? {
          name:      (farmer as any).name,
          location:  (farmer as any).location,
          farmSize:  (farmer as any).farmSize,
          soilType:  (farmer as any).soilType,
        } : null,
        soilMoisture: moisture ? {
          percentage: (moisture as any).moisturePercentage,
          status:     (moisture as any).moistureStatus,
        } : null,
        weather: weather ? {
          temp:      weather.temp_c,
          humidity:  weather.humidity,
          condition: weather.condition?.text,
          wind:      weather.wind_kph,
          precip:    weather.precip_mm,
        } : null,
      },
    });
  } catch (err: any) {
    console.error('[AI Assistant] dashboard-context error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard context' });
  }
});

// POST /api/ai-assistant/chat
// Entry point → Pragati AI Controller (Root Agent)
router.post('/chat', authenticate, chatLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messages, dashboardContext, selectedLang, pageData } = req.body as {
      messages:          { role: string; content: string }[];
      dashboardContext?: Record<string, any>;
      selectedLang?:     string;
      pageData?:         PageData;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const validRoles = ['user', 'assistant'];
    if (messages.some(m => !validRoles.includes(m.role) || typeof m.content !== 'string')) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Resolve farmer profile
    let farmerProfile: ControllerFarmerProfile | undefined;
    try {
      const farmer = await User.findById(req.user!.userId)
        .select('name location farmSize soilType')
        .lean();
      if (farmer) {
        const f = farmer as any;
        farmerProfile = {
          name:      f.name,
          district:  f.location?.district,
          state:     f.location?.state,
          farmSize:  f.farmSize != null ? String(f.farmSize) : undefined,
          soilType:  f.soilType,
        };
      }
    } catch { /* non-critical */ }

    const langCode = selectedLang || req.langCode || 'hi';

    // ── Pragati AI Controller — Root Agent ────────────────────────────────────
    const result = await runPragatiAIController({
      userId:           req.user!.userId,
      messages,
      langCode,
      pageData,
      dashboardContext,
      farmerProfile,
    });

    return res.json({
      success:       result.success,
      reply:         result.reply,
      bilingual:     result.bilingual,
      intent:        result.intent,
      agentsUsed:    result.agentsUsed,
      localAnswered: result.localAnswered,
    });

  } catch (err: any) {
    console.error('[AI Assistant] error:', err.message);
    res.status(500).json({
      error: 'Failed to process your message. Please try again.',
      hindi: 'आपका संदेश प्रोसेस नहीं हो सका। कृपया पुनः प्रयास करें।',
    });
  }
});

// Local type alias to avoid import cycle
interface ControllerFarmerProfile {
  name?:     string;
  district?: string;
  state?:    string;
  farmSize?: string;
  soilType?: string;
}

export default router;
