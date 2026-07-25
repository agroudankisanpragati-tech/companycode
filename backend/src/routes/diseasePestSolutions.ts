import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { DiseasePestSolution } from '../models/DiseasePestSolution';
import { createExactSafeRegex, createSafeRegex } from '../utils/regex';

const router = express.Router();

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
      success: true, data,
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
    res.json({ success: true, data: record });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// CREATE
router.post('/', authenticate, requireAdmin, upload.array('referenceImages', 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const images = files.map(f => imgUrl(f.filename));
      const b = req.body;
      const record = await DiseasePestSolution.create({
        cropName:          b.cropName?.trim(),
        recordType:        b.recordType,
        diseasePestName:   b.diseasePestName?.trim(),
        severity:          b.severity || 'medium',
        description:       b.description,
        symptoms:          b.symptoms,
        organicSolution:   b.organicSolution,
        chemicalSolution:  b.chemicalSolution,
        urgentPrevention:  b.urgentPrevention,
        recoveryTips:      b.recoveryTips,
        preventiveMeasures:b.preventiveMeasures,
        dos:               b.dos,
        donts:             b.donts,
        recommendedProducts: b.recommendedProducts,
        farmerAdvice:      b.farmerAdvice,
        referenceImages:   images,
        tags:              parseTags(b.tags),
        keywords:          parseTags(b.keywords),
        status:            b.status || 'draft',
      });
      res.status(201).json({ success: true, data: record });
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

      const update: any = {
        referenceImages: [...(existing.referenceImages || []), ...newImages],
      };
      const fields = ['cropName','recordType','diseasePestName','severity','description','symptoms',
        'organicSolution','chemicalSolution','urgentPrevention','recoveryTips','preventiveMeasures',
        'dos','donts','recommendedProducts','farmerAdvice','status'];
      fields.forEach(f => { if (b[f] !== undefined) update[f] = b[f]; });
      if (b.tags)     update.tags     = parseTags(b.tags);
      if (b.keywords) update.keywords = parseTags(b.keywords);

      const updated = await DiseasePestSolution.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
      res.json({ success: true, data: updated });
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
    res.json({ exportedAt: new Date().toISOString(), count: data.length, data });
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

// PUBLIC LOOKUP (used by Disease Detection in next prompt)
router.get('/lookup/:cropName/:diseasePestName', async (req, res: Response) => {
  try {
    const { cropName, diseasePestName } = req.params;
    const record = await DiseasePestSolution.findOne({
      cropName:        { $regex: `^${cropName}$`,        $options: 'i' },
      diseasePestName: { $regex: `^${diseasePestName}$`, $options: 'i' },
      status: 'published',
    }).lean();
    if (!record) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: record });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
