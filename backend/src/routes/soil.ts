import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { SoilReport } from '../models/SoilReport';
import { SoilStandard, SOIL_STANDARDS_DATA } from '../models/SoilStandard';
import {
  extractAndAnalyzeSoilWithAI,
  generateAIAnalysisFromData,
  calculateSoilHealthScore,
  buildBenchmarkComparison,
  detectDeficiencies,
  SoilAnalysisInput,
} from '../services/soilAIService';
import { translateNestedObject, SUPPORTED_LANGUAGES } from '../services/translationService';

const router = express.Router();

// Configure multer for soil report uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'soil');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `soil_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /pdf|png|jpg|jpeg/i;
    if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, JPG, JPEG files are allowed'));
    }
  },
});

// Seed soil standards if not already present
async function ensureSoilStandards() {
  const count = await SoilStandard.countDocuments();
  if (count === 0) {
    await SoilStandard.insertMany(SOIL_STANDARDS_DATA);
    console.log('✅ Soil standards seeded');
  }
}
ensureSoilStandards().catch(console.error);

// Simple OCR using file reading for PDF text / base64 for images
async function extractTextFromFile(filePath: string, mimetype: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  // For PDF: try to read text content
  if (ext === '.pdf') {
    try {
      // Read raw buffer and extract readable ASCII text
      const buffer = fs.readFileSync(filePath);
      const raw = buffer.toString('latin1');
      // Extract text between BT/ET markers (basic PDF text extraction)
      const matches = raw.match(/BT[\s\S]*?ET/g) || [];
      let text = '';
      for (const block of matches) {
        const strMatches = block.match(/\((.*?)\)/g) || [];
        text += strMatches.map((s: string) => s.slice(1, -1)).join(' ') + ' ';
      }
      // Also try extracting plain readable text
      const plainText = raw.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
      return (text.trim() || plainText.trim()).substring(0, 3000);
    } catch {
      return 'PDF soil report uploaded. Unable to extract text directly.';
    }
  }

  // For images: convert to base64 and use OpenAI vision
  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');

      const response = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Kisan Pragati',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract ALL text from this soil test report image. Include all numbers, parameter names, units, and values. Return the raw extracted text only.',
                },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
          max_tokens: 1500,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content || 'Image uploaded, text extraction in progress.';
      }
    } catch (err) {
      console.error('Vision OCR error:', err);
    }
    return 'Image soil report uploaded. Proceeding with AI analysis.';
  }

  return 'File uploaded. Proceeding with AI analysis.';
}

// Get best matching soil standard
async function getMatchingStandard(soilType?: string) {
  if (soilType) {
    const normalized = soilType.trim().toLowerCase();
    const standards = await SoilStandard.find();
    const match = standards.find((s) => s.soilType.toLowerCase() === normalized || normalized.includes(s.soilType.toLowerCase()));
    if (match) return match;
  }
  // Default to Alluvial (most common in India)
  return await SoilStandard.findOne({ soilType: 'Alluvial' });
}

// POST /api/soil/upload — Upload soil report file and run full AI analysis
router.post('/upload', authenticate, upload.single('report'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a PDF, PNG, or JPG file.' });
    }

    const filePath = req.file.path;
    const reportUrl = `/uploads/soil/${req.file.filename}`;

    // Step 1: Extract text via OCR
    const ocrText = await extractTextFromFile(filePath, req.file.mimetype);

    // Step 2: Get default standard (Alluvial) for initial parse
    const defaultStandard = await SoilStandard.findOne({ soilType: 'Alluvial' });
    if (!defaultStandard) return res.status(500).json({ error: 'Soil standards not initialized' });

    // Step 3: AI analysis — extract data + generate recommendations
    const aiResult = await extractAndAnalyzeSoilWithAI(ocrText, defaultStandard);

    // Step 4: Get matching standard for detected soil type
    const matchedStandard = await getMatchingStandard(aiResult.soilType) || defaultStandard;

    // Step 5: Recalculate with matched standard
    const { score, status } = calculateSoilHealthScore(aiResult, matchedStandard);
    const benchmarkComparison = buildBenchmarkComparison(aiResult, matchedStandard);
    const deficiencies = detectDeficiencies(aiResult, matchedStandard);

    // Step 6: Save to database
    const soilReport = await SoilReport.create({
      farmerId,
      reportUrl,
      uploadDate: new Date(),
      soilType: aiResult.soilType,
      pH: aiResult.pH,
      nitrogen: aiResult.nitrogen,
      phosphorus: aiResult.phosphorus,
      potassium: aiResult.potassium,
      organicCarbon: aiResult.organicCarbon,
      ec: aiResult.ec,
      micronutrients: aiResult.micronutrients,
      soilHealthScore: score,
      soilHealthStatus: status,
      deficiencies,
      benchmarkComparison,
      recommendations: aiResult.recommendations,
      cropRecommendations: aiResult.cropRecommendations,
      aiAnalysis: aiResult.aiAnalysis,
    });

    return res.json({
      success: true,
      message: 'Soil report analyzed successfully',
      data: soilReport,
    });
  } catch (error: any) {
    console.error('Soil upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze soil report' });
  }
});

// POST /api/soil/analyze — Analyze manually entered soil data (no file)
router.post('/analyze', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const { soilType, pH, nitrogen, phosphorus, potassium, organicCarbon, ec, micronutrients } = req.body;

    if (!pH || !nitrogen || !phosphorus || !potassium) {
      return res.status(400).json({ error: 'pH, Nitrogen, Phosphorus, and Potassium are required' });
    }

    const soilData: SoilAnalysisInput = {
      soilType,
      pH: Number(pH),
      nitrogen: Number(nitrogen),
      phosphorus: Number(phosphorus),
      potassium: Number(potassium),
      organicCarbon: organicCarbon ? Number(organicCarbon) : undefined,
      ec: ec ? Number(ec) : undefined,
      micronutrients,
    };

    const standard = await getMatchingStandard(soilType) || await SoilStandard.findOne({ soilType: 'Alluvial' });
    if (!standard) return res.status(500).json({ error: 'Soil standards not initialized' });

    const { score, status } = calculateSoilHealthScore(soilData, standard);
    const benchmarkComparison = buildBenchmarkComparison(soilData, standard);
    const deficiencies = detectDeficiencies(soilData, standard);
    const aiResult = await generateAIAnalysisFromData(soilData, standard);

    const soilReport = await SoilReport.create({
      farmerId,
      uploadDate: new Date(),
      soilType: soilType || standard.soilType,
      pH: soilData.pH,
      nitrogen: soilData.nitrogen,
      phosphorus: soilData.phosphorus,
      potassium: soilData.potassium,
      organicCarbon: soilData.organicCarbon,
      ec: soilData.ec,
      micronutrients: soilData.micronutrients,
      soilHealthScore: score,
      soilHealthStatus: status,
      deficiencies,
      benchmarkComparison,
      recommendations: aiResult.recommendations,
      cropRecommendations: aiResult.cropRecommendations,
      aiAnalysis: aiResult.aiAnalysis,
    });

    return res.json({ success: true, message: 'Soil analysis complete', data: soilReport });
  } catch (error: any) {
    console.error('Soil analyze error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze soil data' });
  }
});

// GET /api/soil/history — Get report history for the authenticated farmer
router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farmerId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const reports = await SoilReport.find({ farmerId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('uploadDate soilType soilHealthScore soilHealthStatus reportUrl createdAt');

    const total = await SoilReport.countDocuments({ farmerId });

    res.json({ success: true, data: reports, total, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch soil report history' });
  }
});

// GET /api/soil/crops/:id — Get crop recommendations for a report
router.get('/crops/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await SoilReport.findById(req.params.id).select('cropRecommendations soilType soilHealthScore farmerId');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.farmerId.toString() !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    res.json({ success: true, data: report.cropRecommendations, soilType: report.soilType, soilHealthScore: report.soilHealthScore });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crop recommendations' });
  }
});

// POST /api/soil/translate — Translate a soil report into a selected language
router.post('/translate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recordId, language } = req.body;
    if (!recordId || !language) return res.status(400).json({ error: 'recordId and language are required' });
    if (language === 'en') return res.status(400).json({ error: 'Source language is already English' });
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const report = await SoilReport.findById(recordId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.farmerId.toString() !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    // Check if translation already exists
    const existing = (report.translations as any)?.get?.(language) ?? (report.translations as any)?.[language];
    if (existing) {
      return res.json({ success: true, cached: true, language, data: existing });
    }

    // Build translatable English content
    const enData: Record<string, any> = {
      soilType: report.soilType,
      soilHealthStatus: report.soilHealthStatus,
      aiAnalysis: report.aiAnalysis,
      deficiencies: report.deficiencies,
      recommendations: report.recommendations,
      cropRecommendations: report.cropRecommendations,
      benchmarkComparison: report.benchmarkComparison,
    };

    const translated = await translateNestedObject(enData, language);

    // Permanently save to DB
    await SoilReport.findByIdAndUpdate(recordId, {
      $set: { [`translations.${language}`]: translated },
    });

    return res.json({ success: true, cached: false, language, data: translated });
  } catch (error: any) {
    console.error('Soil translate error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

// DELETE /api/soil/:id — Permanently delete a soil report (only by owning farmer)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await SoilReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.farmerId.toString() !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    // Delete uploaded file if it exists
    if (report.reportUrl) {
      const filePath = path.join(process.cwd(), report.reportUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await SoilReport.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete soil report' });
  }
});

// GET /api/soil/:id — Get complete soil report analysis
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const report = await SoilReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.farmerId.toString() !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch soil report' });
  }
});

export default router;
