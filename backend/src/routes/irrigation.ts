import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { IrrigationSchedule } from '../models/IrrigationSchedule';
import { SoilMoisture } from '../models/SoilMoisture';
import { User } from '../models/User';
import weatherService from '../services/weatherService';

const router = express.Router();

// ─── AI Decision Engine ────────────────────────────────────────────────────────

interface AIIrrigationResult {
  decision: 'skip' | 'irrigate_now' | 'irrigate_tomorrow' | 'monitor';
  reason: string;
  reasonHindi: string;
  durationMinutes: number;
  nextIrrigationDate: Date | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

function computeIrrigationDecision(params: {
  moisturePercentage: number;
  rainForecastMm: number;
  rainForecastDays: number;
  temperature: number;
  humidity: number;
  irrigationMethod: string;
  fieldAreaAcres: number;
  cropName: string;
}): AIIrrigationResult {
  const { moisturePercentage, rainForecastMm, rainForecastDays, temperature, humidity, irrigationMethod, fieldAreaAcres, cropName } = params;

  const rainExpected = rainForecastMm > 5 && rainForecastDays <= 2;
  const heavyRain = rainForecastMm > 20;

  // Base duration per acre per method (minutes)
  const baseDuration: Record<string, number> = {
    drip: 90,
    sprinkler: 60,
    flood: 120,
    furrow: 100,
  };
  const base = baseDuration[irrigationMethod] || 90;
  const scaledDuration = Math.round(base * fieldAreaAcres);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(6, 0, 0, 0);

  // ── CRITICAL: Moisture very low + no rain ──────────────────────────────────
  if (moisturePercentage <= 15 && !rainExpected) {
    return {
      decision: 'irrigate_now',
      reason: `🚨 Critical! Soil moisture is critically low at ${moisturePercentage}%. Your ${cropName} crop needs water immediately. Irrigate for ${scaledDuration} minutes using ${irrigationMethod} method.`,
      reasonHindi: `🚨 आपातकाल! मिट्टी की नमी बहुत कम (${moisturePercentage}%) है। ${cropName} की फसल को तुरंत पानी की जरूरत है। ${irrigationMethod} विधि से ${scaledDuration} मिनट सिंचाई करें।`,
      durationMinutes: scaledDuration,
      nextIrrigationDate: new Date(),
      urgency: 'critical',
    };
  }

  // ── SKIP: Heavy rain coming soon ──────────────────────────────────────────
  if (heavyRain && rainForecastDays <= 1) {
    return {
      decision: 'skip',
      reason: `🌧️ Heavy rain (${rainForecastMm}mm) is expected tomorrow. Do not irrigate today — save water and energy! Soil moisture is currently ${moisturePercentage}%.`,
      reasonHindi: `🌧️ कल भारी बारिश (${rainForecastMm}mm) आने वाली है। आज सिंचाई न करें — पानी और ऊर्जा बचाएं! अभी मिट्टी की नमी ${moisturePercentage}% है।`,
      durationMinutes: 0,
      nextIrrigationDate: dayAfter,
      urgency: 'low',
    };
  }

  // ── SKIP: Rain expected + moisture is good ────────────────────────────────
  if (rainExpected && moisturePercentage >= 40) {
    return {
      decision: 'skip',
      reason: `🌦️ Rain of ${rainForecastMm}mm is expected in ${rainForecastDays} day(s). Soil moisture is adequate at ${moisturePercentage}%. Skip irrigation and let nature do the work!`,
      reasonHindi: `🌦️ ${rainForecastDays} दिन में ${rainForecastMm}mm बारिश की उम्मीद है। मिट्टी की नमी ${moisturePercentage}% ठीक है। सिंचाई छोड़ें, प्रकृति पर भरोसा करें!`,
      durationMinutes: 0,
      nextIrrigationDate: dayAfter,
      urgency: 'low',
    };
  }

  // ── IRRIGATE_TOMORROW: Moisture low + rain coming ─────────────────────────
  if (rainExpected && moisturePercentage < 40) {
    return {
      decision: 'irrigate_tomorrow',
      reason: `⚠️ Soil moisture is low (${moisturePercentage}%) but rain (${rainForecastMm}mm) is expected in ${rainForecastDays} day(s). Plan a short ${Math.round(scaledDuration * 0.5)} min irrigation tomorrow morning before rain.`,
      reasonHindi: `⚠️ मिट्टी की नमी कम (${moisturePercentage}%) है लेकिन ${rainForecastDays} दिन में बारिश (${rainForecastMm}mm) आएगी। कल सुबह बारिश से पहले ${Math.round(scaledDuration * 0.5)} मिनट की हल्की सिंचाई करें।`,
      durationMinutes: Math.round(scaledDuration * 0.5),
      nextIrrigationDate: tomorrow,
      urgency: 'medium',
    };
  }

  // ── IRRIGATE_NOW: Low moisture + hot weather + no rain ────────────────────
  if (moisturePercentage <= 30 && temperature > 30) {
    return {
      decision: 'irrigate_now',
      reason: `🌡️ Low moisture (${moisturePercentage}%) combined with high temperature (${temperature}°C) — your ${cropName} is under heat stress. Start ${scaledDuration} min ${irrigationMethod} irrigation now.`,
      reasonHindi: `🌡️ कम नमी (${moisturePercentage}%) और उच्च तापमान (${temperature}°C) — ${cropName} की फसल को गर्मी का तनाव है। अभी ${scaledDuration} मिनट ${irrigationMethod} सिंचाई शुरू करें।`,
      durationMinutes: scaledDuration,
      nextIrrigationDate: new Date(),
      urgency: 'high',
    };
  }

  // ── IRRIGATE_NOW: Low moisture ────────────────────────────────────────────
  if (moisturePercentage <= 35) {
    return {
      decision: 'irrigate_now',
      reason: `💧 Soil moisture is low at ${moisturePercentage}%. Your ${cropName} needs irrigation. Run ${irrigationMethod} irrigation for ${scaledDuration} minutes today.`,
      reasonHindi: `💧 मिट्टी की नमी कम है (${moisturePercentage}%)। ${cropName} को सिंचाई की जरूरत है। आज ${scaledDuration} मिनट ${irrigationMethod} सिंचाई करें।`,
      durationMinutes: scaledDuration,
      nextIrrigationDate: new Date(),
      urgency: 'high',
    };
  }

  // ── MONITOR: Moisture is moderate + hot ───────────────────────────────────
  if (moisturePercentage <= 55 && temperature > 32) {
    return {
      decision: 'irrigate_tomorrow',
      reason: `🌤️ Moisture is moderate (${moisturePercentage}%) but it's hot (${temperature}°C). Plan irrigation tomorrow morning for ${Math.round(scaledDuration * 0.7)} min to prevent drying out.`,
      reasonHindi: `🌤️ नमी ठीक है (${moisturePercentage}%) लेकिन गर्मी ज्यादा है (${temperature}°C)। कल सुबह ${Math.round(scaledDuration * 0.7)} मिनट सिंचाई की योजना बनाएं।`,
      durationMinutes: Math.round(scaledDuration * 0.7),
      nextIrrigationDate: tomorrow,
      urgency: 'medium',
    };
  }

  // ── DEFAULT: Soil is good, just monitor ───────────────────────────────────
  return {
    decision: 'monitor',
    reason: `✅ Soil moisture is good at ${moisturePercentage}% and weather is favorable (${temperature}°C, ${humidity}% humidity). No irrigation needed today. Next check recommended in 2 days.`,
    reasonHindi: `✅ मिट्टी की नमी अच्छी है (${moisturePercentage}%) और मौसम अनुकूल है। आज सिंचाई की जरूरत नहीं। 2 दिन बाद दोबारा जांच करें।`,
    durationMinutes: 0,
    nextIrrigationDate: dayAfter,
    urgency: 'low',
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/irrigation — get current schedule + AI decision
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;

    // Check if cached and recent (1 hour)
    const existing = await IrrigationSchedule.findOne({ farmerId });
    if (existing) {
      const age = Date.now() - new Date(existing.lastAnalyzed).getTime();
      if (age < 60 * 60 * 1000) {
        return res.json({ success: true, data: existing, cached: true });
      }
    }

    // Get farmer location and soil moisture
    const [farmer, soilMoisture] = await Promise.all([
      User.findById(farmerId).select('location'),
      SoilMoisture.findOne({ farmerId }),
    ]);

    if (!farmer?.location?.state || farmer.location.state === 'Unknown') {
      return res.status(422).json({ success: false, error: 'location_missing' });
    }

    const { state, district } = farmer.location;

    // Fetch weather forecast
    let weatherData: any = null;
    try {
      const query = `${district}, ${state}, India`;
      const result = await weatherService.fetchWeatherByLocationQuery(query);
      weatherData = result.data;
    } catch {
      weatherData = null;
    }

    const current = weatherData?.current ?? {};
    const daily: any[] = weatherData?.daily ?? [];

    const temperature = typeof current.temp === 'number' ? current.temp : 28;
    const humidity = typeof current.humidity === 'number' ? current.humidity : 60;
    const weatherCondition = current.weather?.text || 'Clear';

    // Calculate rain forecast for next 2 days
    let rainForecastMm = 0;
    let rainForecastDays = 0;
    for (let i = 0; i < Math.min(daily.length, 3); i++) {
      const day = daily[i];
      const pop = day?.pop ?? 0; // probability of precipitation
      const isRainy = typeof day?.weather?.text === 'string' && day.weather.text.toLowerCase().includes('rain');
      if (pop > 0.4 || isRainy) {
        rainForecastMm += pop * 25; // estimate mm from probability
        if (rainForecastDays === 0) rainForecastDays = i + 1;
      }
    }
    rainForecastMm = Math.round(rainForecastMm);

    const moisturePercentage = soilMoisture?.moisturePercentage ?? 50;
    const moistureStatus = soilMoisture?.moistureStatus ?? 'Moderate';

    const currentDoc = existing || new IrrigationSchedule({ farmerId });
    const irrigationMethod = currentDoc.irrigationMethod || 'drip';
    const fieldAreaAcres = currentDoc.fieldAreaAcres || 1;
    const cropName = currentDoc.cropName || 'General';

    const aiResult = computeIrrigationDecision({
      moisturePercentage,
      rainForecastMm,
      rainForecastDays,
      temperature,
      humidity,
      irrigationMethod,
      fieldAreaAcres,
      cropName,
    });

    const updated = await IrrigationSchedule.findOneAndUpdate(
      { farmerId },
      {
        farmerId,
        cropName,
        irrigationMethod,
        fieldAreaAcres,
        currentMoisture: moisturePercentage,
        moistureStatus,
        aiDecision: aiResult.decision,
        aiReason: aiResult.reason,
        aiReasonHindi: aiResult.reasonHindi,
        recommendedDurationMinutes: aiResult.durationMinutes,
        nextIrrigationDate: aiResult.nextIrrigationDate,
        rainForecastMm,
        rainForecastDays,
        weatherCondition,
        temperature,
        humidity,
        alertSent: false,
        lastAnalyzed: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: updated, cached: false, urgency: aiResult.urgency });
  } catch (err: any) {
    console.error('irrigation fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute irrigation schedule' });
  }
});

// POST /api/irrigation/settings — update field settings (crop, method, area)
router.post('/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const { cropName, fieldName, irrigationMethod, fieldAreaAcres, soilType } = req.body;

    const updated = await IrrigationSchedule.findOneAndUpdate(
      { farmerId },
      {
        ...(cropName && { cropName }),
        ...(fieldName && { fieldName }),
        ...(irrigationMethod && { irrigationMethod }),
        ...(fieldAreaAcres && { fieldAreaAcres: parseFloat(fieldAreaAcres) }),
        ...(soilType && { soilType }),
        lastAnalyzed: new Date(0), // force re-analysis on next GET
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('irrigation settings error:', err);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// POST /api/irrigation/log — log a completed irrigation session
router.post('/log', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const { durationMinutes, method, notes } = req.body;

    if (!durationMinutes) {
      return res.status(400).json({ success: false, error: 'durationMinutes required' });
    }

    const schedule = await IrrigationSchedule.findOne({ farmerId });
    const logEntry = {
      date: new Date(),
      durationMinutes: parseFloat(durationMinutes),
      method: method || schedule?.irrigationMethod || 'drip',
      aiDecision: schedule?.aiDecision || 'manual',
      soilMoistureAtTime: schedule?.currentMoisture ?? 0,
      weatherCondition: schedule?.weatherCondition || 'Unknown',
    };

    await IrrigationSchedule.findOneAndUpdate(
      { farmerId },
      {
        $push: { logs: { $each: [logEntry], $slice: -30 } }, // keep last 30 logs
        lastAnalyzed: new Date(0), // force refresh
      },
      { upsert: true }
    );

    res.json({ success: true, message: 'Irrigation logged successfully' });
  } catch (err: any) {
    console.error('irrigation log error:', err);
    res.status(500).json({ success: false, error: 'Failed to log irrigation' });
  }
});

// DELETE /api/irrigation/cache — force re-analysis
router.delete('/cache', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await IrrigationSchedule.findOneAndUpdate(
      { farmerId: req.user!.userId },
      { lastAnalyzed: new Date(0) }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to invalidate cache' });
  }
});

export default router;
