import express, { Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { ActiveCrop } from '../models/ActiveCrop';
import { CropTask } from '../models/CropTask';
import { MyCrop } from '../models/MyCrop';
import { User } from '../models/User';
import { SoilMoisture } from '../models/SoilMoisture';
import { SoilReport } from '../models/SoilReport';
import { MarketPriceHistory } from '../models/MarketPriceHistory';
import { GovtScheme } from '../models/GovtScheme';
import { getCropLifecycle, resolveStage, generateDailyRecommendation } from '../services/aiFosEngine';
import { translateObject, SUPPORTED_LANGUAGES } from '../services/translationService';

const router = express.Router();

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Recompute progress + stage for an active crop
function refreshCropMeta(crop: any) {
  const today = new Date();
  const age = Math.max(1, daysBetween(new Date(crop.sowingDate), today) + 1);
  const progress = Math.min(100, Math.round((age / crop.growingDurationDays) * 100));
  return { age, progress };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-fos/activate — Activate a MyCrop entry as a growing crop
// ─────────────────────────────────────────────────────────────────────────────
router.post('/activate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const { myCropId, sowingDate, fieldLabel } = req.body;

    if (!myCropId || !sowingDate) {
      return res.status(400).json({ success: false, error: 'myCropId and sowingDate are required' });
    }

    const myCrop = await MyCrop.findOne({ _id: myCropId, userId: farmerId });
    if (!myCrop) return res.status(404).json({ success: false, error: 'Crop not found in My Crops' });

    const farmer = await User.findById(farmerId).select('location');
    const state    = farmer?.location?.state    || 'India';
    const district = farmer?.location?.district || '';

    const duration = 120; // default; lifecycle generator may override
    const lifecycle = await getCropLifecycle(myCrop.cropName, duration, state, district);

    // Create ActiveCrop
    const activeCrop = await ActiveCrop.create({
      farmerId,
      myCropId,
      cropName: myCrop.cropName,
      fieldLabel: fieldLabel || 'Field 1',
      sowingDate: new Date(sowingDate),
      growingDurationDays: lifecycle.duration,
      currentStage: lifecycle.stages[0]?.name || 'Germination',
      progressPercent: 0,
      isHarvested: false,
    });

    // Create all tasks from lifecycle
    const tasks = lifecycle.tasks.map((t) => ({
      farmerId,
      activeCropId: activeCrop._id.toString(),
      cropName: myCrop.cropName,
      dayNumber: t.dayNumber,
      scheduledDate: addDays(new Date(sowingDate), t.dayNumber - 1),
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      status: 'pending',
    }));

    await CropTask.insertMany(tasks);

    console.log(`[AI-FOS] Activated ${myCrop.cropName} for farmer ${farmerId}, ${tasks.length} tasks generated`);
    res.status(201).json({ success: true, data: { activeCrop, taskCount: tasks.length } });
  } catch (err: any) {
    console.error('[AI-FOS] activate error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-fos/dashboard — Full AI-FOS data for Today's Tasks command center
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);

    // Load all active (non-harvested) crops
    const activeCrops = await ActiveCrop.find({ farmerId, isHarvested: false });

    const cropData = await Promise.all(activeCrops.map(async (crop) => {
      const { age, progress } = refreshCropMeta(crop);

      // Update progress + stage in DB (async, don't await in parallel to avoid race)
      const lifecycle = await getCropLifecycle(crop.cropName, crop.growingDurationDays, '', '');
      const stage = resolveStage(lifecycle.stages, age);
      await ActiveCrop.findByIdAndUpdate(crop._id, { progressPercent: progress, currentStage: stage });

      // Today's tasks
      const todayTasks = await CropTask.find({
        activeCropId: crop._id.toString(),
        scheduledDate: { $gte: today, $lt: tomorrow },
      }).sort({ dayNumber: 1 });

      // Upcoming tasks (next 7 days, pending)
      const upcomingTasks = await CropTask.find({
        activeCropId: crop._id.toString(),
        scheduledDate: { $gte: tomorrow, $lt: addDays(tomorrow, 7) },
        status: 'pending',
      }).sort({ scheduledDate: 1 }).limit(5);

      // Overdue pending tasks
      const overdueTasks = await CropTask.find({
        activeCropId: crop._id.toString(),
        scheduledDate: { $lt: today },
        status: 'pending',
      }).sort({ scheduledDate: 1 }).limit(3);

      return {
        activeCrop: { ...crop.toObject(), progressPercent: progress, currentStage: stage },
        dayAge: age,
        todayTasks,
        upcomingTasks,
        overdueTasks,
      };
    }));

    // Contextual data for AI recommendation
    const moisture = await SoilMoisture.findOne({ farmerId });
    const soilReport = await SoilReport.findOne({ farmerId }).sort({ createdAt: -1 });
    const latestPrice = await MarketPriceHistory.findOne({ farmerId }).sort({ date: -1 });
    const farmer = await User.findById(farmerId).select('location');

    // Generate AI recommendation for the first active crop (most important)
    let aiRecommendation = '';
    if (cropData.length > 0) {
      const first = cropData[0];
      aiRecommendation = await generateDailyRecommendation({
        cropName:    first.activeCrop.cropName,
        dayAge:      first.dayAge,
        stage:       first.activeCrop.currentStage,
        moisture:    moisture?.moisturePercentage,
        humidity:    moisture?.humidity,
        modalPrice:  latestPrice?.modalPrice,
        soilHealth:  soilReport?.soilHealthStatus,
        state:       farmer?.location?.state    || '',
        district:    farmer?.location?.district || '',
      });
      // Persist English recommendation so translate endpoint can access it
      await ActiveCrop.findByIdAndUpdate(cropData[0].activeCrop._id, { aiRecommendation });
    }

    res.json({
      success: true,
      data: {
        cropData,
        aiRecommendation,
        activeCropId: cropData.length > 0 ? cropData[0].activeCrop._id : null,
        contextSnapshot: {
          moisture:    moisture ? { pct: moisture.moisturePercentage, status: moisture.moistureStatus } : null,
          soilScore:   soilReport?.soilHealthScore ?? null,
          marketPrice: latestPrice ? { crop: latestPrice.cropName, price: latestPrice.modalPrice } : null,
        },
      },
    });
  } catch (err: any) {
    console.error('[AI-FOS] dashboard error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-fos/active-crops — List all active crops
// ─────────────────────────────────────────────────────────────────────────────
router.get('/active-crops', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const crops = await ActiveCrop.find({ farmerId: req.user!.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: crops });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/ai-fos/tasks/:taskId — Mark task done/skipped
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tasks/:taskId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['done', 'skipped', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const task = await CropTask.findOneAndUpdate(
      { _id: req.params.taskId, farmerId: req.user!.userId },
      { status, completedAt: status === 'done' ? new Date() : undefined },
      { new: true }
    );

    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-fos/tasks/:activeCropId — All tasks for a crop
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tasks/:activeCropId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasks = await CropTask.find({
      activeCropId: req.params.activeCropId,
      farmerId: req.user!.userId,
    }).sort({ dayNumber: 1 });
    res.json({ success: true, data: tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/ai-fos/active-crops/:id — Deactivate / mark harvested
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/active-crops/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ActiveCrop.findOneAndUpdate(
      { _id: req.params.id, farmerId: req.user!.userId },
      { isHarvested: true, harvestDate: new Date() }
    );
    res.json({ success: true, message: 'Crop marked as harvested' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-fos/schemes — Recommend relevant govt schemes based on farmer profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/schemes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const farmer = await User.findById(farmerId).select('location crops');
    const activeCrops = await ActiveCrop.find({ farmerId, isHarvested: false }).select('cropName');

    const allSchemes = await GovtScheme.find({ status: 'published' }).lean();

    const state = farmer?.location?.state?.toLowerCase() || '';
    const cropNames = [
      ...(farmer?.crops || []),
      ...activeCrops.map((c) => c.cropName),
    ].map((c) => c.toLowerCase());

    // Score each scheme by relevance
    const scored = allSchemes.map((s) => {
      let score = 0;
      const text = `${s.title} ${s.summary} ${s.description} ${s.tags.join(' ')} ${s.audience}`.toLowerCase();

      // State match
      if (state && text.includes(state)) score += 3;

      // Crop name match
      cropNames.forEach((c) => { if (text.includes(c)) score += 2; });

      // Universal farmer schemes
      if (text.includes('pm-kisan') || text.includes('kisan credit') || text.includes('pmfby') ||
          text.includes('soil health') || text.includes('all farmer')) score += 1;

      return { ...s, relevanceScore: score };
    });

    // Return top 6 most relevant
    const recommended = scored
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 6);

    res.json({ success: true, data: recommended });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-fos/translate — Translate AI daily recommendation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/translate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activeCropId, language } = req.body;
    if (!activeCropId || !language) return res.status(400).json({ error: 'activeCropId and language are required' });
    if (language === 'en') return res.status(400).json({ error: 'Source language is already English' });
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const crop = await ActiveCrop.findOne({ _id: activeCropId, farmerId: req.user!.userId });
    if (!crop) return res.status(404).json({ error: 'Active crop not found' });

    // Return cached translation if available
    const cached = (crop.aiRecommendationTranslations as any)?.get?.(language)
      ?? (crop.aiRecommendationTranslations as any)?.[language];
    if (cached) return res.json({ success: true, cached: true, language, data: { aiRecommendation: cached } });

    if (!crop.aiRecommendation) return res.status(400).json({ error: 'No English recommendation to translate' });

    const translated = await translateObject({ aiRecommendation: crop.aiRecommendation }, language);

    await ActiveCrop.findByIdAndUpdate(activeCropId, {
      $set: { [`aiRecommendationTranslations.${language}`]: translated.aiRecommendation },
    });

    return res.json({ success: true, cached: false, language, data: translated });
  } catch (err: any) {
    console.error('[AI-FOS] translate error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

export default router;
