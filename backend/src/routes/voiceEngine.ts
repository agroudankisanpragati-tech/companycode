/**
 * Voice Engine Routes — Phase 6
 *
 * Unified voice API used by every page in the application.
 * Mounted at /api/voice-engine.
 *
 * Endpoints:
 *   POST /prepare-tts       — pronunciation-correct text before browser TTS
 *   POST /transcribe        — server-side STT (non-browser providers)
 *   GET  /providers         — list available STT/TTS providers
 *   GET  /speech-cache      — list cached speech entries (admin)
 *   DELETE /speech-cache    — clear speech cache (admin)
 *   POST /training/import   — import a new speech dataset
 *   POST /training/validate/:id — validate dataset transcripts
 *   POST /training/approve/:id  — admin approve dataset
 *   POST /training/reject/:id   — admin reject dataset
 *   GET  /training/datasets     — list datasets
 *   GET  /training/approved     — get approved datasets for a language
 *   POST /training/sync-farmer  — sync farmer voice dataset refs
 *
 * All existing routes (language-engine, ai-assistant, etc.) are unchanged.
 */

import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { SpeechCacheEntry } from '../models/SpeechCacheEntry';
import { normalizeKey } from '../services/languageDictionaryService';
import { getVoiceBcp47ForCode } from '../services/voiceEngineHelpers';
import {
  applyPronunciationCorrections,
  buildSSML,
  getPronunciation,
} from '../services/pronunciationEngine';
import {
  getActiveSTTProvider,
  getActiveTTSProvider,
  listProviders,
} from '../services/voiceProviderAdapter';
import {
  importDataset,
  validateDataset,
  approveDataset,
  rejectDataset,
  listDatasets,
  getApprovedDatasets,
  syncFarmerVoiceDatasets,
} from '../services/trainingPipeline';

const router = express.Router();

// ─── All routes require authentication ───────────────────────────────────────
router.use(authenticate);

// ─── POST /api/voice-engine/prepare-tts ──────────────────────────────────────
// Pronunciation-correct text before browser TTS.
// Returns ttsText (corrected), displayText, langBcp47, and optional SSML.
// Used by every page before calling Web Speech API.

router.post('/prepare-tts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      text,
      langCode = 'hi',
      pageContext,
      useSSML = false,
    } = req.body as {
      text: string;
      langCode?: string;
      pageContext?: string;
      useSSML?: boolean;
    };

    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const textKey = normalizeKey(text.slice(0, 200));
    const langBcp47 = getVoiceBcp47ForCode(langCode);

    // Check speech cache first
    const cached = await SpeechCacheEntry.findOneAndUpdate(
      { textKey, langBcp47 },
      { $inc: { hitCount: 1 }, $set: { lastAccessedAt: new Date() } },
      { new: true }
    ).lean();

    if (cached) {
      return res.json({
        success: true,
        source: 'cache',
        data: {
          ttsText: cached.ttsText,
          displayText: cached.displayText,
          langBcp47,
          ssml: useSSML ? buildSSML(cached.ttsText, langBcp47) : undefined,
        },
      });
    }

    // Apply pronunciation corrections
    const ttsText = await applyPronunciationCorrections(text, langCode);
    const displayText = langCode === 'en' ? text : ttsText;

    // Store in speech cache
    try {
      await SpeechCacheEntry.updateOne(
        { textKey, langBcp47 },
        {
          $setOnInsert: {
            textKey, langBcp47, langCode,
            ttsText, displayText, pageContext,
            hitCount: 1, lastAccessedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch { /* duplicate race — ignore */ }

    return res.json({
      success: true,
      source: 'computed',
      data: {
        ttsText,
        displayText,
        langBcp47,
        ssml: useSSML ? buildSSML(ttsText, langBcp47) : undefined,
      },
    });
  } catch (err: any) {
    console.error('[VoiceEngine] prepare-tts error:', err.message);
    // Graceful fallback — return original text
    res.json({
      success: true,
      source: 'fallback',
      data: {
        ttsText: req.body.text || '',
        displayText: req.body.text || '',
        langBcp47: getVoiceBcp47ForCode(req.body.langCode || 'hi'),
      },
    });
  }
});

// ─── POST /api/voice-engine/transcribe ───────────────────────────────────────
// Server-side STT for non-browser providers (Google, Azure, Local).
// Browser STT is handled client-side by useVoiceAI — this is for future use.

router.post('/transcribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { langCode = 'hi', dialectCode } = req.body as {
      langCode?: string;
      dialectCode?: string;
    };

    const provider = getActiveSTTProvider();

    // For browser provider, return instruction to use client-side STT
    if (provider.name === 'browser') {
      return res.json({
        success: true,
        provider: 'browser',
        message: 'Use client-side Web Speech API for browser STT',
        data: { transcript: '', confidence: 0 },
      });
    }

    // For server-side providers, audio buffer must be sent as multipart
    // (implementation added when provider credentials are configured)
    return res.status(501).json({
      success: false,
      error: `Server-side STT via '${provider.name}' requires audio upload. Configure provider credentials first.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/voice-engine/providers ─────────────────────────────────────────

router.get('/providers', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = listProviders();
    const activeSTT = getActiveSTTProvider().name;
    const activeTTS = getActiveTTSProvider().name;
    res.json({ success: true, data: { providers, activeSTT, activeTTS } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/voice-engine/pronunciation ─────────────────────────────────────
// Get pronunciation for a single term (used by frontend for pre-check)

router.get('/pronunciation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { term, langCode = 'hi' } = req.query as { term: string; langCode?: string };
    if (!term) return res.status(400).json({ error: 'term is required' });
    const result = await getPronunciation(term, langCode);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.use(requireAdmin);

// GET /api/voice-engine/speech-cache
router.get('/speech-cache', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const lang  = req.query.lang as string | undefined;

    const filter: any = {};
    if (lang) filter.langCode = lang;

    const [data, total] = await Promise.all([
      SpeechCacheEntry.find(filter).sort({ hitCount: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SpeechCacheEntry.countDocuments(filter),
    ]);

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/voice-engine/speech-cache
router.delete('/speech-cache', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await SpeechCacheEntry.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Training pipeline routes ─────────────────────────────────────────────────

// POST /api/voice-engine/training/import
router.post('/training/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dataset = await importDataset({ ...req.body, importedBy: req.user!.userId });
    res.status(201).json({ success: true, data: dataset });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: 'Dataset version already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice-engine/training/validate/:id
router.post('/training/validate/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await validateDataset(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice-engine/training/approve/:id
router.post('/training/approve/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await approveDataset(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Dataset approved for training' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/voice-engine/training/reject/:id
router.post('/training/reject/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await rejectDataset(req.params.id, req.user!.userId, req.body.reason);
    res.json({ success: true, message: 'Dataset rejected' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/voice-engine/training/datasets
router.get('/training/datasets', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { langCode, status, page, limit } = req.query as Record<string, string>;
    const result = await listDatasets({
      langCode, status: status as any,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/voice-engine/training/approved?langCode=hi
router.get('/training/approved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { langCode } = req.query as { langCode: string };
    if (!langCode) return res.status(400).json({ error: 'langCode is required' });
    const datasets = await getApprovedDatasets(langCode);
    res.json({ success: true, data: datasets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice-engine/training/sync-farmer
router.post('/training/sync-farmer', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncFarmerVoiceDatasets();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
