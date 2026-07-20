import express, { Response } from 'express';
import { LanguageDictionary, DictionaryCategory } from '../models/LanguageDictionary';
import { DictionaryReviewQueue } from '../models/DictionaryReviewQueue';
import { normalizeKey, lookupTerm, lookupTerms } from '../services/languageDictionaryService';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// ─── Public: lookup ───────────────────────────────────────────────────────────

// GET /api/language-dictionary/lookup?term=BlackGram&lang=hi&ctx=disease
router.get('/lookup', async (req, res: Response) => {
  const { term, lang = 'en', ctx } = req.query as Record<string, string>;
  if (!term) return res.status(400).json({ error: 'term is required' });
  try {
    const result = await lookupTerm(term, lang, ctx);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/language-dictionary/lookup-batch
router.post('/lookup-batch', async (req, res: Response) => {
  const { terms, lang = 'en', ctx } = req.body as { terms: string[]; lang?: string; ctx?: string };
  if (!Array.isArray(terms) || terms.length === 0) return res.status(400).json({ error: 'terms array required' });
  try {
    const results = await lookupTerms(terms, lang, ctx);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: dictionary CRUD ───────────────────────────────────────────────────

router.use(authenticate, requireAdmin);

// GET /api/language-dictionary?category=crops&approved=true&page=1&limit=20
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const filter: Record<string, any> = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.approved !== undefined) filter.approved = req.query.approved === 'true';
  if (req.query.search) filter.normalizedKey = new RegExp(normalizeKey(req.query.search as string), 'i');

  const [data, total] = await Promise.all([
    LanguageDictionary.find(filter).sort({ normalizedKey: 1 }).skip((page - 1) * limit).limit(limit),
    LanguageDictionary.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// POST /api/language-dictionary
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body;
    body.normalizedKey = normalizeKey(body.english || body.normalizedKey || '');
    if (body.aliases) body.aliases = (body.aliases as string[]).map(normalizeKey);
    const entry = await LanguageDictionary.create(body);
    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'Entry with this key already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/language-dictionary/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body;
    if (body.english) body.normalizedKey = normalizeKey(body.english);
    if (body.aliases) body.aliases = (body.aliases as string[]).map(normalizeKey);
    const entry = await LanguageDictionary.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/language-dictionary/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const entry = await LanguageDictionary.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true, message: 'Deleted' });
});

// ─── Admin: review queue ──────────────────────────────────────────────────────

// GET /api/language-dictionary/review-queue?status=pending
router.get('/review-queue', async (req: AuthenticatedRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
  const status = req.query.status || 'pending';
  const [data, total] = await Promise.all([
    DictionaryReviewQueue.find({ status }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    DictionaryReviewQueue.countDocuments({ status }),
  ]);
  res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// POST /api/language-dictionary/review-queue/:id/approve
// Body: full dictionary entry fields (english, hindi, category, …)
router.post('/review-queue/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queueItem = await DictionaryReviewQueue.findById(req.params.id);
    if (!queueItem) return res.status(404).json({ error: 'Queue item not found' });

    const body = req.body;
    body.normalizedKey = queueItem.normalizedKey;
    if (body.aliases) body.aliases = (body.aliases as string[]).map(normalizeKey);
    else body.aliases = [normalizeKey(queueItem.rawInput)];

    const entry = await LanguageDictionary.findOneAndUpdate(
      { normalizedKey: queueItem.normalizedKey },
      { ...body, approved: true },
      { upsert: true, new: true, runValidators: true }
    );

    await DictionaryReviewQueue.findByIdAndUpdate(req.params.id, {
      status: 'approved',
      reviewedBy: req.user?.userId,
      reviewNote: req.body.reviewNote,
    });

    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/language-dictionary/review-queue/:id/reject
router.post('/review-queue/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  const queueItem = await DictionaryReviewQueue.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', reviewedBy: req.user?.userId, reviewNote: req.body.reviewNote },
    { new: true }
  );
  if (!queueItem) return res.status(404).json({ error: 'Queue item not found' });
  res.json({ success: true, data: queueItem });
});

// POST /api/language-dictionary/review-queue/:id/merge
// Body: { targetId: "<existing dictionary entry id>", aliases?: string[] }
router.post('/review-queue/:id/merge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queueItem = await DictionaryReviewQueue.findById(req.params.id);
    if (!queueItem) return res.status(404).json({ error: 'Queue item not found' });

    const { targetId, aliases = [] } = req.body as { targetId: string; aliases?: string[] };
    const target = await LanguageDictionary.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Target dictionary entry not found' });

    // Merge raw input + any provided aliases into target
    const newAliases = [normalizeKey(queueItem.rawInput), ...aliases.map(normalizeKey)];
    const merged = Array.from(new Set([...target.aliases, ...newAliases]));
    await LanguageDictionary.findByIdAndUpdate(targetId, { aliases: merged });

    await DictionaryReviewQueue.findByIdAndUpdate(req.params.id, {
      status: 'merged',
      mergeTargetId: targetId,
      reviewedBy: req.user?.userId,
      reviewNote: req.body.reviewNote,
    });

    res.json({ success: true, message: 'Merged into existing entry', mergedAliases: merged });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
