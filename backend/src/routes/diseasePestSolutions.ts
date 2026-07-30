import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseasePestSolution } from '../models/DiseasePestSolution';
import { normalizeLabel, normalizeAILabel } from '../services/diseaseService';
import { createExactSafeRegex, createSafeRegex } from '../utils/regex';
import { createLogger } from '../utils/logger';

const router = express.Router();
const log = createLogger('diseasePestSolutions');

const uploadsDir = path.join(process.cwd(), 'uploads', 'dps');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

const imgUrl = (f: string) => `/uploads/dps/${f}`;
const parseTags = (v: any): string[] =>
  !v ? [] : Array.isArray(v) ? v : String(v).split(',').map((s: string) => s.trim()).filter(Boolean);

// ─── Multilingual field helpers ──────────────────────────────────────────────

// Build a { en, hi } MLString from FormData fields named `key_en` and `key_hi`.
// Returns null if both values are empty — empty fields are not stored.
function mlFromBody(b: any, key: string): { en: string; hi: string } | null {
  const en = normalizeNewlines((b[`${key}_en`] ?? '').trim());
  const hi = normalizeNewlines((b[`${key}_hi`] ?? '').trim());
  // Both empty — treat as absent, do not store
  if (!en && !hi) return null;
  return { en, hi };
}

// Convert literal \n / \r\n escape sequences to real newlines.
// This handles the case where a client accidentally double-escaped newlines.
function normalizeNewlines(s: string): string {
  return s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
}

// Repair a field that was incorrectly stored as a JSON string instead of an object.
// Returns null for absent/empty fields — empty stays empty, never stored as {}.
function safeParseML(v: any): { en: string; hi: string } | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const en = normalizeNewlines(String(v.en || ''));
    const hi = normalizeNewlines(String(v.hi || ''));
    // Both empty — treat as absent
    if (!en && !hi) return null;
    return { en, hi };
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    if (s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') {
          const en = normalizeNewlines(typeof parsed.en === 'string' ? parsed.en : '');
          const hi = normalizeNewlines(typeof parsed.hi === 'string' ? parsed.hi : '');
          if (!en && !hi) return null;
          return { en, hi };
        }
      } catch { /* not JSON */ }
    }
    // Legacy plain string — treat as English
    const en = normalizeNewlines(s);
    return en ? { en, hi: '' } : null;
  }
  return null;
}

// The ML content fields that have separate _en / _hi inputs in the Admin form
const ML_FIELDS = [
  'description', 'symptoms', 'organicSolution', 'chemicalSolution',
  'urgentPrevention', 'recoveryTips', 'preventiveMeasures',
  'dos', 'donts', 'recommendedProducts', 'farmerAdvice',
] as const;

// Repair all ML fields in a document returned from MongoDB.
// Converts any JSON-stringified values back to proper { en, hi } objects.
// Removes empty { en: '', hi: '' } objects — they are returned as undefined.
// This is the read-time migration — no DB writes needed.
function repairMLFields(doc: any): any {
  if (!doc) return doc;
  const out = { ...doc };
  for (const k of ML_FIELDS) {
    const repaired = safeParseML(out[k]);
    // null means absent/empty — delete the key so frontend sees undefined, not {}
    if (repaired === null) {
      delete out[k];
    } else {
      out[k] = repaired;
    }
  }
  return out;
}

// LIST
router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const { search, recordType, severity, status, cropName } = req.query as Record<string, string>;

    const filter: any = {};
    if (search)     filter.$or = [{ cropName: createSafeRegex(search) }, { diseasePestName: createSafeRegex(search) }, { tags: createSafeRegex(search) }];
    if (recordType) filter.recordType = recordType;
    if (severity)   filter.severity   = severity;
    if (status)     filter.status     = status;
    if (cropName)   filter.cropName   = createSafeRegex(cropName);

    const [data, total] = await Promise.all([
      DiseasePestSolution.find(filter).sort({ updatedAt: -1 }).skip((page-1)*limit).limit(limit).lean(),
      DiseasePestSolution.countDocuments(filter),
    ]);

    const [totalAll, totalCrops, totalPublished, totalDraft] = await Promise.all([
      DiseasePestSolution.countDocuments(),
      DiseasePestSolution.distinct('cropName').then(r => r.length),
      DiseasePestSolution.countDocuments({ status: 'published' }),
      DiseasePestSolution.countDocuments({ status: 'draft' }),
    ]);

    res.json({
      success: true, data: data.map(repairMLFields),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { total: totalAll, totalCrops, totalPublished, totalDraft },
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// GET ONE
router.get('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseasePestSolution.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: repairMLFields(record) });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// CREATE
router.post('/', authenticate, requireAdmin, upload.array('referenceImages', 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const images = files.map(f => imgUrl(f.filename));
      const b = req.body;
      const mlData: Record<string, { en: string; hi: string }> = {};
      ML_FIELDS.forEach(k => {
        if (b[`${k}_en`] !== undefined || b[`${k}_hi`] !== undefined) {
          // Correct path: admin sent separate _en / _hi keys
          const ml = mlFromBody(b, k);
          if (ml !== null) mlData[k] = ml;
          // If null (both empty): field is omitted — not stored in MongoDB
        } else if (b[k] !== undefined) {
          // Fallback: admin sent a plain value — could be a JSON string (legacy) or plain text
          const ml = safeParseML(b[k]);
          if (ml !== null) mlData[k] = ml;
        }
        // If key absent entirely: field is not stored
      });
      const record = await DiseasePestSolution.create({
        cropName:          b.cropName?.trim(),
        recordType:        b.recordType,
        diseasePestName:   b.diseasePestName?.trim(),
        aiLabel:           b.aiLabel?.trim() || undefined,
        aliases:           parseTags(b.aliases),
        severity:          b.severity || 'medium',
        ...mlData,
        referenceImages:   images,
        tags:              parseTags(b.tags),
        keywords:          parseTags(b.keywords),
        status:            b.status || 'draft',
      });
      res.status(201).json({ success: true, data: repairMLFields(record.toObject()) });
    } catch (e: any) {
      if (e.code === 11000) return res.status(409).json({ success: false, error: 'Record for this Crop + Disease/Pest already exists.' });
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// UPDATE
router.put('/:id', authenticate, requireAdmin, upload.array('referenceImages', 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await DiseasePestSolution.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

      const files = (req.files as Express.Multer.File[]) || [];
      const newImages = files.map(f => imgUrl(f.filename));
      const b = req.body;

      const update: any = {};
      const unsetFields: any = {};

      update.referenceImages = [...(existing.referenceImages || []), ...newImages];
      // Plain scalar fields
      const scalarFields = ['cropName','recordType','diseasePestName','aiLabel','severity','status'];
      scalarFields.forEach(f => { if (b[f] !== undefined) update[f] = b[f]; });
      // Multilingual fields — support both _en/_hi keys (correct) and plain key (legacy fallback)
      ML_FIELDS.forEach(k => {
        if (b[`${k}_en`] !== undefined || b[`${k}_hi`] !== undefined) {
          const ml = mlFromBody(b, k);
          if (ml !== null) {
            update[k] = ml;
          } else {
            // Both empty — unset the field so MongoDB removes it
            unsetFields[k] = '';
          }
        } else if (b[k] !== undefined) {
          const ml = safeParseML(b[k]);
          if (ml !== null) update[k] = ml;
          else unsetFields[k] = '';
        }
      });
      if (b.tags)     update.tags     = parseTags(b.tags);
      if (b.keywords) update.keywords = parseTags(b.keywords);
      if (b.aliases)  update.aliases  = parseTags(b.aliases);

      // Build the MongoDB update operation
      const mongoUpdate: any = { $set: update };
      if (Object.keys(unsetFields).length > 0) mongoUpdate.$unset = unsetFields;

      const updated = await DiseasePestSolution.findByIdAndUpdate(req.params.id, mongoUpdate, { new: true, runValidators: true });
      res.json({ success: true, data: repairMLFields(updated?.toObject() ?? {}) });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  }
);

// DELETE
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const record = await DiseasePestSolution.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// BULK DELETE
router.post('/bulk-delete', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, error: 'ids array required' });
    const result = await DiseasePestSolution.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// EXPORT JSON
router.get('/export/json', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cropName, status } = req.query as Record<string, string>;
    const filter: any = {};
    if (cropName) filter.cropName = createSafeRegex(cropName);
    if (status)   filter.status   = status;
    const data = await DiseasePestSolution.find(filter).lean();
    res.setHeader('Content-Disposition', 'attachment; filename="disease-pest-solutions.json"');
    res.json({ exportedAt: new Date().toISOString(), count: data.length, data: data.map(repairMLFields) });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// IMPORT JSON
router.post('/import/json', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records: any[] = req.body.data || req.body;
    if (!Array.isArray(records) || !records.length) return res.status(400).json({ success: false, error: 'data array required' });
    let created = 0, updated = 0, errors = 0;
    for (const r of records) {
      if (!r.cropName || !r.diseasePestName) { errors++; continue; }
      try {
        const res2 = await DiseasePestSolution.findOneAndUpdate(
          { cropName: createExactSafeRegex(r.cropName.trim()), diseasePestName: createExactSafeRegex(r.diseasePestName.trim()) },
          { ...r },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (res2) { const isNew = (res2 as any).__v === 0; isNew ? created++ : updated++; }
      } catch { errors++; }
    }
    res.json({ success: true, created, updated, errors });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// PUBLIC LOOKUP by cropName + diseasePestName (exact, case-insensitive)
router.get('/lookup/:cropName/:diseasePestName', async (req, res: Response) => {
  try {
    const { cropName, diseasePestName } = req.params;
    const record = await DiseasePestSolution.findOne({
      cropName:        { $regex: `^${cropName}$`,        $options: 'i' },
      diseasePestName: { $regex: `^${diseasePestName}$`, $options: 'i' },
      status: 'published',
    }).lean();
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: repairMLFields(record) });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// PUBLIC LOOKUP by raw AI label (e.g. "Black_Gram_Cercospora_Leaf_Spot")
// Lookup order: aiLabel exact → diseasePestName normalized → aliases → fuzzy
router.get('/lookup/by-label/:aiLabel', async (req, res: Response) => {
  try {
    const rawLabel = decodeURIComponent(req.params.aiLabel);
    const normRaw  = normalizeLabel(rawLabel);

    log.info('[DPS lookup/by-label]', { collection: 'diseasepestsolutions', rawLabel, normRaw });

    // Try to extract crop from label (first 1-3 words before known disease terms)
    // We fetch all published records and match in-memory for flexibility
    const allPublished = await DiseasePestSolution.find({ status: 'published' }).lean();

    // 1. Exact aiLabel match
    let match = allPublished.find(d => d.aiLabel && normalizeLabel(d.aiLabel) === normRaw) ?? null;
    if (match) {
      log.info('[DPS lookup/by-label] hit: aiLabel', { docId: (match as any)._id?.toString() });
      return res.json({ success: true, data: repairMLFields(match) });
    }

    // 2. Normalize: strip crop prefix from each record and compare
    match = allPublished.find(d => {
      const stripped = normalizeAILabel(rawLabel, d.cropName);
      return normalizeLabel(d.diseasePestName) === stripped;
    }) ?? null;
    if (match) {
      log.info('[DPS lookup/by-label] hit: normalized diseasePestName', { docId: (match as any)._id?.toString() });
      return res.json({ success: true, data: repairMLFields(match) });
    }

    // 3. Aliases
    match = allPublished.find(d =>
      (d.aliases || []).some(a => normalizeLabel(a) === normRaw)
    ) ?? null;
    if (match) {
      log.info('[DPS lookup/by-label] hit: alias', { docId: (match as any)._id?.toString() });
      return res.json({ success: true, data: repairMLFields(match) });
    }

    log.warn('[DPS lookup/by-label] FAIL: document not found', { rawLabel, normRaw });
    return res.status(404).json({ success: false, error: `No published DPS record found for AI label: ${rawLabel}` });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
