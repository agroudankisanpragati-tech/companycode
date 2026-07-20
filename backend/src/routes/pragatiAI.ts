/**
 * Pragati AI Routes
 *
 * Unified AI endpoint that accepts text, voice, and image requests
 * from the website. Automatically detects request type, enriches
 * context with farmer/farm/crop profiles, routes through the
 * Pragati AI Controller, persists results to MongoDB, and returns
 * structured responses.
 *
 * Routes:
 *   POST /api/pragati-ai/text          — text query
 *   POST /api/pragati-ai/voice         — voice upload
 *   POST /api/pragati-ai/image         — image upload (disease detection)
 *   GET  /api/pragati-ai/history       — conversation history
 *   GET  /api/pragati-ai/health        — AI module health
 *   GET  /api/pragati-ai/status        — AI module status (admin)
 *   DELETE /api/pragati-ai/session/:id — end session
 */

import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { FarmerProfileData } from '../models/FarmerProfileData';
import { MyCrop } from '../models/MyCrop';
import { FarmerMemory } from '../models/FarmerMemory';
import { AIConversation } from '../models/AIConversation';
import { DiseaseRecommendation } from '../models/DiseaseRecommendation';
import {
  processText,
  processVoice,
  processImage,
  getAIHealth,
  getAIStatus,
  endAISession,
  AIResponse,
} from '../services/pragatiAIService';
import { createLogger } from '../utils/logger';

const router = express.Router();
const log    = createLogger('pragatiAI');

// ---------------------------------------------------------------------------
// Normalize Python bridge snake_case → camelCase
// ---------------------------------------------------------------------------

function normalizeAIResponse(raw: AIResponse): AIResponse {
  return {
    ...raw,
    sessionId:      raw.sessionId      || (raw as any).session_id      || '',
    farmerId:       raw.farmerId       || (raw as any).farmer_id       || '',
    moduleId:       raw.moduleId       || (raw as any).module_id       || '',
    responseText:   raw.responseText   || (raw as any).response_text   || '',
    responseAudio:  raw.responseAudio  || (raw as any).response_audio  || undefined,
    fallbackReason: raw.fallbackReason || (raw as any).fallback_reason || '',
    metrics: raw.metrics ? {
      totalMs:     (raw.metrics as any).total_ms     ?? raw.metrics.totalMs,
      sttMs:       (raw.metrics as any).stt_ms       ?? raw.metrics.sttMs,
      intentMs:    (raw.metrics as any).intent_ms    ?? raw.metrics.intentMs,
      routerMs:    (raw.metrics as any).router_ms    ?? raw.metrics.routerMs,
      ttsMs:       (raw.metrics as any).tts_ms       ?? raw.metrics.ttsMs,
      inferenceMs: (raw.metrics as any).inference_ms ?? raw.metrics.inferenceMs,
      knowledgeMs: (raw.metrics as any).knowledge_ms ?? raw.metrics.knowledgeMs,
    } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const aiLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many AI requests. Please wait a moment.' },
  skip:           () => process.env.NODE_ENV === 'development',
});

// ---------------------------------------------------------------------------
// Multer — temp storage for voice and image uploads
// ---------------------------------------------------------------------------

const uploadsDir = path.join(process.cwd(), 'uploads', 'ai_temp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const ts  = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${ts}${ext}`);
  },
});

const audioFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = new Set(['.wav', '.flac', '.ogg', '.mp3', '.m4a', '.aac', '.opus']);
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.has(ext) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${ext}`));
  }
};

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif']);
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.has(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image format: ${ext}`));
  }
};

const uploadAudio = multer({ storage, fileFilter: audioFilter, limits: { fileSize: 25 * 1024 * 1024 } });
const uploadImage = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildFarmerContext(userId: string) {
  try {
    const [user, profile, crops] = await Promise.all([
      User.findById(userId).select('name location farmSize soilType crops').lean(),
      FarmerProfileData.findOne({ userId }).select(
        'district state soilType totalArea farmingType waterAvailability cropHistory'
      ).lean(),
      MyCrop.find({ userId, status: 'active' }).select('cropName category').limit(10).lean(),
    ]);

    const u = user as any;
    const p = profile as any;

    return {
      name:      u?.name,
      district:  p?.district || u?.location?.district,
      state:     p?.state    || u?.location?.state,
      soilType:  p?.soilType || u?.soilType,
      farmSize:  p?.totalArea || u?.farmSize,
      cropNames: (crops as any[]).map((c: any) => c.cropName),
    };
  } catch {
    return {};
  }
}

function cleanupFile(filePath?: string): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* non-critical */ }
}

async function persistConversation(
  userId:        string,
  sessionId:     string,
  inputType:     'text' | 'voice' | 'image',
  aiResponse:    AIResponse,
  farmerContext: Record<string, unknown>,
  extras: {
    inputText?:      string;
    inputAudioUrl?:  string;
    inputImageUrl?:  string;
  } = {}
): Promise<void> {
  try {
    const metrics = aiResponse.metrics || {};
    await AIConversation.create({
      userId,
      sessionId,
      inputType,
      inputText:        extras.inputText,
      inputAudioUrl:    extras.inputAudioUrl,
      inputImageUrl:    extras.inputImageUrl,
      status:           aiResponse.success ? (aiResponse.status as any || 'success') : 'error',
      intent:           aiResponse.intent,
      confidence:       aiResponse.confidence,
      moduleId:         aiResponse.moduleId,
      language:         aiResponse.language,
      responseText:     aiResponse.responseText,
      responseAudioUrl: aiResponse.responseAudio,
      imageAnalysis:    inputType === 'image' ? buildImageAnalysis(aiResponse) : undefined,
      knowledgeData:    aiResponse.knowledge || undefined,
      suggestions:      aiResponse.suggestions || [],
      metrics: {
        totalMs:     metrics.totalMs,
        sttMs:       metrics.sttMs,
        intentMs:    metrics.intentMs,
        routerMs:    metrics.routerMs,
        ttsMs:       metrics.ttsMs,
        inferenceMs: metrics.inferenceMs,
        knowledgeMs: metrics.knowledgeMs,
      },
      error:          aiResponse.error,
      fallbackReason: aiResponse.fallbackReason,
      farmerContext,
    });
  } catch (err: any) {
    log.warn('persistConversation failed (non-fatal)', { error: err?.message });
  }
}

function buildImageAnalysis(aiResponse: AIResponse) {
  const data = aiResponse.data as any;
  if (!data) return undefined;
  return {
    crop:       data.crop,
    className:  data.class_name,
    category:   data.category,
    confidence: data.confidence,
    top5:       (data.top5 || []).map((t: any) => ({
      rank:       t.rank,
      className:  t.class_name,
      confidence: t.confidence,
    })),
  };
}

async function persistDiseaseRecommendation(
  userId:      string,
  aiResponse:  AIResponse,
  imageUrl?:   string
): Promise<void> {
  try {
    const data      = aiResponse.data as any;
    const knowledge = aiResponse.knowledge as any;
    if (!data?.class_name) return;

    await DiseaseRecommendation.create({
      userId,
      cropName:          data.crop || 'Unknown',
      diseaseName:       data.class_name,
      diseaseType:       data.category || '',
      severityLevel:     knowledge?.severity || '',
      symptoms:          knowledge?.symptoms || '',
      organicTreatment:  knowledge?.organic_treatment || '',
      chemicalTreatment: knowledge?.chemical_treatment || '',
      treatment:         knowledge?.treatment || aiResponse.responseText || '',
      prevention:        knowledge?.prevention || '',
      description:       knowledge?.description || aiResponse.responseText || '',
      confidenceScore:   data.confidence,
      imageUrl:          imageUrl,
      source:            'yolo',
    });
  } catch (err: any) {
    log.warn('persistDiseaseRecommendation failed (non-fatal)', { error: err?.message });
  }
}

async function updateFarmerMemory(
  userId:    string,
  inputText: string,
  aiReply:   string,
  langCode:  string,
  intent?:   string
): Promise<void> {
  try {
    const turn = {
      role:      'user' as const,
      content:   inputText,
      timestamp: new Date(),
      langCode,
      agentUsed: intent,
    };
    const replyTurn = {
      role:      'assistant' as const,
      content:   aiReply,
      timestamp: new Date(),
      langCode,
      agentUsed: intent,
    };

    await FarmerMemory.findOneAndUpdate(
      { userId },
      {
        $push: {
          conversationHistory: {
            $each:  [turn, replyTurn],
            $slice: -100,
          },
        },
        $inc:  { totalInteractions: 1 },
        $set:  { lastInteractionAt: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    log.warn('updateFarmerMemory failed (non-fatal)', { error: err?.message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/pragati-ai/text
// ---------------------------------------------------------------------------

router.post('/text', authenticate, aiLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const {
    text,
    sessionId,
    language,
    synthesizeAudio = false,
    extra,
  } = req.body as {
    text:             string;
    sessionId?:       string;
    language?:        string;
    synthesizeAudio?: boolean;
    extra?:           Record<string, unknown>;
  };

  if (!text?.trim()) {
    return res.status(400).json({ success: false, error: 'text field is required' });
  }

  const farmerContext = await buildFarmerContext(userId);

  const aiResponse = normalizeAIResponse(await processText({
    text,
    sessionId,
    farmerId:        userId,
    farmerName:      farmerContext.name,
    language:        language || 'hi',
    synthesizeAudio: synthesizeAudio,
    extra,
  }));

  const sid = aiResponse.sessionId || sessionId || '';

  setImmediate(async () => {
    await persistConversation(userId, sid, 'text', aiResponse, farmerContext, { inputText: text });
    await updateFarmerMemory(
      userId,
      text,
      aiResponse.responseText || '',
      aiResponse.language || language || 'hi',
      aiResponse.intent
    );
  });

  log.info('text request processed', {
    userId,
    intent:  aiResponse.intent,
    success: aiResponse.success,
    ms:      aiResponse.metrics?.totalMs,
  });

  return res.json({
    success:       aiResponse.success,
    sessionId:     sid,
    pipeline:      'text',
    intent:        aiResponse.intent,
    confidence:    aiResponse.confidence,
    language:      aiResponse.language,
    responseText:  aiResponse.responseText,
    suggestions:   aiResponse.suggestions || [],
    moduleId:      aiResponse.moduleId,
    metrics:       aiResponse.metrics,
    error:         aiResponse.error,
    timestamp:     aiResponse.timestamp || new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/pragati-ai/voice
// ---------------------------------------------------------------------------

router.post(
  '/voice',
  authenticate,
  aiLimiter,
  uploadAudio.single('audio'),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const file   = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'audio file is required' });
    }

    const {
      sessionId,
      language,
      synthesizeAudio = 'true',
    } = req.body as {
      sessionId?:       string;
      language?:        string;
      synthesizeAudio?: string;
    };

    const farmerContext = await buildFarmerContext(userId);

    let aiResponse: AIResponse;
    try {
      aiResponse = normalizeAIResponse(await processVoice({
        audioPath:       file.path,
        sessionId,
        farmerId:        userId,
        farmerName:      farmerContext.name,
        language,
        synthesizeAudio: synthesizeAudio !== 'false',
      }));
    } finally {
      cleanupFile(file.path);
    }

    const sid = aiResponse.sessionId || sessionId || '';

    setImmediate(async () => {
      await persistConversation(userId, sid, 'voice', aiResponse, farmerContext, {
        inputText:     aiResponse.responseText ? `[voice transcript]` : undefined,
        inputAudioUrl: file.filename,
      });
      if (aiResponse.responseText) {
        await updateFarmerMemory(
          userId,
          '[voice input]',
          aiResponse.responseText,
          aiResponse.language || language || 'hi',
          aiResponse.intent
        );
      }
    });

    log.info('voice request processed', {
      userId,
      intent:  aiResponse.intent,
      success: aiResponse.success,
      ms:      aiResponse.metrics?.totalMs,
    });

    return res.json({
      success:       aiResponse.success,
      sessionId:     sid,
      pipeline:      'voice',
      intent:        aiResponse.intent,
      confidence:    aiResponse.confidence,
      language:      aiResponse.language,
      responseText:  aiResponse.responseText,
      responseAudio: aiResponse.responseAudio,
      suggestions:   aiResponse.suggestions || [],
      moduleId:      aiResponse.moduleId,
      metrics:       aiResponse.metrics,
      error:         aiResponse.error,
      timestamp:     aiResponse.timestamp || new Date().toISOString(),
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/pragati-ai/image
// ---------------------------------------------------------------------------

router.post(
  '/image',
  authenticate,
  aiLimiter,
  uploadImage.single('image'),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const file   = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'image file is required' });
    }

    const {
      sessionId,
      language,
    } = req.body as {
      sessionId?: string;
      language?:  string;
    };

    const farmerContext = await buildFarmerContext(userId);

    let aiResponse: AIResponse;
    try {
      aiResponse = normalizeAIResponse(await processImage({
        imagePath:  file.path,
        sessionId,
        farmerId:   userId,
        language,
      }));
    } finally {
      cleanupFile(file.path);
    }

    const sid = aiResponse.sessionId || sessionId || '';

    setImmediate(async () => {
      await persistConversation(userId, sid, 'image', aiResponse, farmerContext, {
        inputImageUrl: file.filename,
      });
      await persistDiseaseRecommendation(userId, aiResponse, file.filename);
      if (aiResponse.responseText) {
        await updateFarmerMemory(
          userId,
          '[image analysis]',
          aiResponse.responseText,
          aiResponse.language || language || 'hi',
          'disease'
        );
      }
    });

    log.info('image request processed', {
      userId,
      intent:  aiResponse.intent,
      success: aiResponse.success,
      ms:      aiResponse.metrics?.totalMs,
    });

    return res.json({
      success:       aiResponse.success,
      sessionId:     sid,
      pipeline:      'image',
      intent:        aiResponse.intent,
      confidence:    aiResponse.confidence,
      language:      aiResponse.language,
      responseText:  aiResponse.responseText,
      imageAnalysis: buildImageAnalysis(aiResponse),
      knowledge:     aiResponse.knowledge,
      suggestions:   aiResponse.suggestions || [],
      moduleId:      aiResponse.moduleId,
      metrics:       aiResponse.metrics,
      error:         aiResponse.error,
      timestamp:     aiResponse.timestamp || new Date().toISOString(),
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/pragati-ai/history
// ---------------------------------------------------------------------------

router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const limit  = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const type   = req.query.type as string | undefined;
  const skip   = parseInt((req.query.skip as string) || '0', 10);

  try {
    const filter: Record<string, unknown> = { userId };
    if (type && ['text', 'voice', 'image'].includes(type)) {
      filter.inputType = type;
    }

    const [conversations, total] = await Promise.all([
      AIConversation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      AIConversation.countDocuments(filter),
    ]);

    return res.json({
      success:       true,
      conversations,
      total,
      limit,
      skip,
    });
  } catch (err: any) {
    log.error('history fetch failed', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pragati-ai/health
// ---------------------------------------------------------------------------

router.get('/health', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  const health = await getAIHealth();

  if (!health) {
    return res.status(503).json({
      success: false,
      status:  'unavailable',
      error:   'Pragati AI Bridge is not reachable. Ensure fastapi_bridge.py is running on port 8001.',
    });
  }

  return res.json({ success: true, ...health });
});

// ---------------------------------------------------------------------------
// GET /api/pragati-ai/status  (admin only)
// ---------------------------------------------------------------------------

router.get('/status', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const status = await getAIStatus();

  if (!status) {
    return res.status(503).json({
      success: false,
      error:   'Pragati AI Bridge is not reachable',
    });
  }

  return res.json({ success: true, ...status });
});

// ---------------------------------------------------------------------------
// DELETE /api/pragati-ai/session/:sessionId
// ---------------------------------------------------------------------------

router.delete('/session/:sessionId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId?.trim()) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  await endAISession(sessionId);
  return res.json({ success: true, sessionId });
});

// ---------------------------------------------------------------------------
// GET /api/pragati-ai/stats  — per-user AI usage stats
// ---------------------------------------------------------------------------

router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const [total, byType, recentIntents] = await Promise.all([
      AIConversation.countDocuments({ userId }),
      AIConversation.aggregate([
        { $match: { userId } },
        { $group: { _id: '$inputType', count: { $sum: 1 } } },
      ]),
      AIConversation.find({ userId, intent: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('intent createdAt')
        .lean(),
    ]);

    const typeMap: Record<string, number> = {};
    for (const b of byType) typeMap[b._id] = b.count;

    return res.json({
      success: true,
      stats: {
        total,
        byType: {
          text:  typeMap['text']  || 0,
          voice: typeMap['voice'] || 0,
          image: typeMap['image'] || 0,
        },
        recentIntents: recentIntents.map((r: any) => ({
          intent:    r.intent,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (err: any) {
    log.error('stats fetch failed', { error: err?.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;
