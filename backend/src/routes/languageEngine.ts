/**
 * Language Engine Routes
 * Handles term lookup, batch lookup, and admin dictionary management.
 * All existing routes are untouched — this is a new /api/language-engine mount.
 */

import express, { Response } from 'express';
import { LanguageDictionary } from '../models/LanguageDictionary';
import { DictionaryReviewQueue } from '../models/DictionaryReviewQueue';
import { lookupTerm, lookupTerms, normalizeKey } from '../services/languageDictionaryService';
import {
  runSpeechTranslationPipeline,
  runBatchPipeline,
  translateOutputForDisplay,
  detectLanguageFromText,
  getCacheSize,
  clearTranslationCache,
} from '../services/speechTranslationPipeline';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// ─── Public: detect language from text ──────────────────────────────────────

router.post('/detect-language', async (req, res: Response) => {
  try {
    const { text } = req.body as { text: string };
    if (!text) return res.status(400).json({ error: 'text is required' });
    const detected = detectLanguageFromText(text);
    res.json({ success: true, data: { detectedLang: detected } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Detection failed' });
  }
});

// ─── Public: full speech translation pipeline (single input) ─────────────────

router.post('/pipeline', async (req, res: Response) => {
  try {
    const { rawText, appLangCode = 'en', pageContext } = req.body as {
      rawText: string;
      appLangCode?: string;
      pageContext?: string;
    };
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });
    const result = await runSpeechTranslationPipeline({ rawText, appLangCode, pageContext });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pipeline failed' });
  }
});

// ─── Public: batch pipeline ───────────────────────────────────────────────────

router.post('/pipeline-batch', async (req, res: Response) => {
  try {
    const { inputs } = req.body as {
      inputs: Array<{ rawText: string; appLangCode?: string; pageContext?: string }>;
    };
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ error: 'inputs array is required' });
    }
    const results = await runBatchPipeline(
      inputs.map(i => ({ rawText: i.rawText, appLangCode: i.appLangCode || 'en', pageContext: i.pageContext }))
    );
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Batch pipeline failed' });
  }
});

// ─── Public: translate English output → display language ─────────────────────

router.post('/translate-output', async (req, res: Response) => {
  try {
    const { englishText, appLangCode = 'en' } = req.body as {
      englishText: string;
      appLangCode?: string;
    };
    if (!englishText) return res.status(400).json({ error: 'englishText is required' });
    const result = await translateOutputForDisplay(englishText, appLangCode);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

// ─── Admin: cache stats + clear ──────────────────────────────────────────────

router.get('/cache-stats', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: { cacheSize: getCacheSize() } });
});

router.delete('/cache', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  clearTranslationCache();
  res.json({ success: true, message: 'Translation cache cleared' });
});

// ─── Public: single term lookup ───────────────────────────────────────────────

router.get('/lookup', async (req, res: Response) => {
  try {
    const { term, lang = 'en', ctx } = req.query as Record<string, string>;
    if (!term) return res.status(400).json({ error: 'term is required' });
    const result = await lookupTerm(term, lang, ctx);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lookup failed' });
  }
});

// ─── Public: batch lookup ─────────────────────────────────────────────────────

router.post('/lookup-batch', async (req, res: Response) => {
  try {
    const { terms, lang = 'en', ctx } = req.body as { terms: string[]; lang?: string; ctx?: string };
    if (!Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ error: 'terms array is required' });
    }
    const results = await lookupTerms(terms, lang, ctx);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Batch lookup failed' });
  }
});

// ─── Admin: list dictionary entries ──────────────────────────────────────────

router.get('/dictionary', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;
    const { search, category, approved } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search)   filter.$or = [{ normalizedKey: new RegExp(normalizeKey(search), 'i') }, { english: new RegExp(search, 'i') }];
    if (category) filter.category = category;
    if (approved !== undefined) filter.approved = approved === 'true';

    const [data, total] = await Promise.all([
      LanguageDictionary.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LanguageDictionary.countDocuments(filter),
    ]);

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch dictionary' });
  }
});

// ─── Admin: create dictionary entry ──────────────────────────────────────────

router.post('/dictionary', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body;
    body.normalizedKey = normalizeKey(body.english || body.normalizedKey || '');
    const entry = new LanguageDictionary(body);
    await entry.save();
    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'Entry with this key already exists' });
    res.status(500).json({ error: err.message || 'Failed to create entry' });
  }
});

// ─── Admin: update dictionary entry (translations + aliases) ─────────────────

router.put('/dictionary/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await LanguageDictionary.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update entry' });
  }
});

// ─── Admin: delete dictionary entry ──────────────────────────────────────────

router.delete('/dictionary/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await LanguageDictionary.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete entry' });
  }
});

// ─── Admin: list review queue ─────────────────────────────────────────────────

router.get('/review-queue', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;
    const status = (req.query.status as string) || 'pending';

    const [data, total] = await Promise.all([
      DictionaryReviewQueue.find({ status }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DictionaryReviewQueue.countDocuments({ status }),
    ]);

    const pendingCount = await DictionaryReviewQueue.countDocuments({ status: 'pending' });

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) }, pendingCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch review queue' });
  }
});

// ─── Admin: approve queue item → create dictionary entry ─────────────────────

router.post('/review-queue/:id/approve', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await DictionaryReviewQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Queue item not found' });

    const { english, hindi, category, ...translations } = req.body;

    const entry = await LanguageDictionary.findOneAndUpdate(
      { normalizedKey: item.normalizedKey },
      {
        $setOnInsert: { normalizedKey: item.normalizedKey },
        $set: { english: english || item.rawInput, hindi: hindi || item.rawInput, category: category || item.pageContext || 'agriculture', approved: true, ...translations },
        $addToSet: { aliases: item.rawInput },
      },
      { upsert: true, new: true }
    );

    item.status = 'approved';
    item.reviewedBy = (req as any).user?.id;
    item.reviewNote = req.body.reviewNote;
    await item.save();

    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to approve item' });
  }
});

// ─── Admin: reject queue item ─────────────────────────────────────────────────

router.post('/review-queue/:id/reject', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await DictionaryReviewQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Queue item not found' });

    item.status = 'rejected';
    item.reviewedBy = (req as any).user?.id;
    item.reviewNote = req.body.reviewNote;
    await item.save();

    res.json({ success: true, message: 'Item rejected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject item' });
  }
});

// ─── Admin: merge queue item as alias into existing entry ─────────────────────

router.post('/review-queue/:id/merge', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await DictionaryReviewQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Queue item not found' });

    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'targetId is required' });

    const target = await LanguageDictionary.findByIdAndUpdate(
      targetId,
      { $addToSet: { aliases: { $each: [item.rawInput, item.normalizedKey] } } },
      { new: true }
    );
    if (!target) return res.status(404).json({ error: 'Target dictionary entry not found' });

    item.status = 'merged';
    item.mergeTargetId = target._id as any;
    item.reviewedBy = (req as any).user?.id;
    item.reviewNote = req.body.reviewNote;
    await item.save();

    res.json({ success: true, data: target });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to merge item' });
  }
});

export default router;
