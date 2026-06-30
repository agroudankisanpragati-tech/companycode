import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { FarmerCropRequest } from '../models/FarmerCropRequest';
import { CropKnowledgeBase } from '../models/CropKnowledgeBase';
import { runRecommendationEngine, IRecommendationItem } from '../services/recommendationEngine';
import { findSimilarRecommendation } from '../services/similaritySearch';
import { callOpenAIForCrops, IFarmerConditions } from '../services/openaiService';
import { translateNestedObject, SUPPORTED_LANGUAGES } from '../services/translationService';

const router = express.Router();

/**
 * Upsert a recommendation item into CropKnowledgeBase.
 * Matches on cropName + soilType + district + season to prevent duplicates.
 */
async function upsertToCropKnowledgeBase(
  item: IRecommendationItem,
  conditions: IFarmerConditions,
  source: 'database' | 'openai',
  farmerId: string
): Promise<void> {
  const filter = {
    cropName: item.cropName,
    soilType: conditions.soilType,
    district: conditions.district,
    season: conditions.season,
  };

  const update = {
    $set: {
      cropName: item.cropName,
      cropCategory: item.cropCategory as any,
      soilType: conditions.soilType,
      soilPH: conditions.soilPH,
      waterAvailability: conditions.waterAvailability,
      district: conditions.district,
      state: conditions.state,
      season: conditions.season,
      suitabilityScore: item.suitabilityScore,
      aiRecommendation: item.whySuitable,
      waterRequirement: item.waterRequirement as any,
      cultivationCost: item.estimatedCultivationCost,
      averageYield: parseFloat(item.estimatedYield) || 0,
      expectedYield: item.estimatedYield,
      estimatedProfit: item.expectedProfit,
      averageMarketPrice: item.currentMarketPrice || 0,
      marketPrice: item.currentMarketPrice,
      marketDemand: item.marketDemand as any,
      riskLevel: (item.riskLevel || 'medium') as any,
      diseaseRisks: item.risks,
      cultivationProcess: item.cultivationGuide,
      description: item.whySuitable,
      growingDuration: item.growingDuration || 0,
      fertilizerRequirement: item.fertilizerRequirement,
      fertilizerCost: item.fertilizerCost,
      fertilizerPlan: item.fertilizerRequirement,
      seedRequirement: item.seedRequirement,
      recommendedSeedVariety: item.recommendedSeedVariety,
      sourceType: 'AI',
      source,
      createdBy: farmerId,
      status: 'active',
      lastUpdated: new Date(),
    },
  };

  await CropKnowledgeBase.findOneAndUpdate(filter, update, { upsert: true, new: true });
}

// POST /api/crop-recommendation
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      farmArea, areaUnit, state, district, village,
      soilType, soilPH, organicCarbon, nitrogen, phosphorus, potassium, ecValue,
      waterAvailability, irrigationType, rainfall, averageTemperature,
      season, farmingType, budget, previousCrop, preferredCrop,
    } = req.body;

    if (!farmArea || !state || !district || !soilType || !soilPH || !waterAvailability || !irrigationType || !season || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const farmerId = req.user!.userId;

    const farmerRequest = await FarmerCropRequest.create({
      farmerId, farmArea, areaUnit, state, district, village,
      soilType, soilPH, organicCarbon, nitrogen, phosphorus, potassium, ecValue,
      waterAvailability, irrigationType, rainfall, averageTemperature,
      season, farmingType, budget, previousCrop, preferredCrop,
    });

    const conditions: IFarmerConditions = {
      soilType, soilPH: Number(soilPH), waterAvailability, season,
      district, state, farmArea: Number(farmArea),
      budget: Number(budget), farmingType: farmingType || 'conventional',
      rainfall: rainfall ? Number(rainfall) : undefined,
      averageTemperature: averageTemperature ? Number(averageTemperature) : undefined,
    };

    // Step 1: Similarity search in CropKnowledgeBase (AI entries)
    const similar = await findSimilarRecommendation(conditions);
    if (similar.found) {
      return res.json({
        success: true,
        source: 'database',
        similarityScore: similar.similarityScore,
        requestId: farmerRequest._id,
        recommendations: similar.recommendations,
        message: 'Recommendations retrieved from cached data',
      });
    }

    // Step 2: Run local recommendation engine against CropKnowledgeBase
    const { recommendations, hasHighScore } = await runRecommendationEngine(farmerRequest);

    if (hasHighScore && recommendations.length >= 3) {
      // Persist to CropKnowledgeBase
      try {
        await Promise.all(recommendations.map((item) => upsertToCropKnowledgeBase(item, conditions, 'database', farmerId)));
        console.log(`AI Recommendation Saved Successfully — ${recommendations.length} crops upserted to CropKnowledgeBase`);
      } catch (saveErr) {
        console.error('Crop Knowledge Base Save Failed:', saveErr);
      }

      return res.json({
        success: true,
        source: 'database',
        requestId: farmerRequest._id,
        recommendations,
        message: 'Recommendations generated from crop knowledge base',
      });
    }

    // Step 3: Fallback to OpenAI GPT
    const aiRecommendations = await callOpenAIForCrops(conditions);

    // Persist AI results to CropKnowledgeBase
    try {
      await Promise.all(aiRecommendations.map((item) => upsertToCropKnowledgeBase(item, conditions, 'openai', farmerId)));
      console.log(`AI Recommendation Saved Successfully — ${aiRecommendations.length} crops upserted to CropKnowledgeBase (source: openai)`);
    } catch (saveErr) {
      console.error('Crop Knowledge Base Save Failed:', saveErr);
    }

    return res.json({
      success: true,
      source: 'openai',
      requestId: farmerRequest._id,
      recommendations: aiRecommendations,
      message: 'Recommendations generated by AI',
    });

  } catch (error: any) {
    console.error('Crop recommendation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
});

// GET /api/crop-recommendation/history
router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const requests = await FarmerCropRequest.find({ farmerId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await FarmerCropRequest.countDocuments({ farmerId });

    // Attach saved CropKnowledgeBase entries for each request
    const history = await Promise.all(
      requests.map(async (request) => {
        const savedCrops = await CropKnowledgeBase.find({
          createdBy: farmerId,
          soilType: request.soilType,
          district: request.district,
          season: request.season,
          sourceType: 'AI',
          status: 'active',
        }).sort({ suitabilityScore: -1 });

        const recommendations = savedCrops.map((c) => ({
          cropName: c.cropName,
          cropCategory: c.cropCategory,
          suitabilityScore: c.suitabilityScore || 0,
        }));

        return {
          request,
          recommendations,
          source: savedCrops[0]?.source || null,
          recommendationId: savedCrops[0]?._id?.toString() || null,
        };
      })
    );

    res.json({ success: true, data: history, total, page, limit });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/crop-recommendation/:id — fetch a single CropKnowledgeBase entry
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const entry = await CropKnowledgeBase.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    res.json({ success: true, data: { recommendation: entry } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommendation' });
  }
});

// POST /api/crop-recommendation/feedback — kept for UI compatibility, now a no-op store
router.post('/feedback', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  // Feedback can be extended later; for now acknowledge silently
  res.json({ success: true, message: 'Feedback recorded' });
});

// POST /api/crop-recommendation/translate — translate recommendations into selected language
router.post('/translate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId, language, recommendations } = req.body;
    if (!requestId || !language) return res.status(400).json({ error: 'requestId and language are required' });
    if (language === 'en') return res.status(400).json({ error: 'Source language is already English' });
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const farmerReq = await FarmerCropRequest.findById(requestId);
    if (!farmerReq) return res.status(404).json({ error: 'Request not found' });
    if (farmerReq.farmerId.toString() !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    // Check if translation already exists
    const existing = (farmerReq.translations as any)?.get?.(language) ?? (farmerReq.translations as any)?.[language];
    if (existing) {
      return res.json({ success: true, cached: true, language, data: existing });
    }

    // Translate the recommendations array
    const dataToTranslate = recommendations || [];
    const translated = await translateNestedObject({ recommendations: dataToTranslate }, language);

    // Permanently save to DB
    await FarmerCropRequest.findByIdAndUpdate(requestId, {
      $set: { [`translations.${language}`]: translated },
    });

    return res.json({ success: true, cached: false, language, data: translated });
  } catch (error: any) {
    console.error('Crop translate error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

export default router;
