import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { SoilReport } from '../models/SoilReport';
import { calculateFertilizer, SUPPORTED_CROPS, AREA_UNITS, FertilizerCalcInput } from '../services/fertilizerCalculatorService';

const router = express.Router();

// GET /api/fertilizer-calculator/meta — crops list + area units
router.get('/meta', (_req, res: Response) => {
  res.json({ success: true, crops: SUPPORTED_CROPS, areaUnits: AREA_UNITS });
});

// POST /api/fertilizer-calculator/calculate
// Body: { crop, areaValue, areaUnit, soilReportId? }
// If soilReportId provided → auto-loads soil nutrients from DB
router.post('/calculate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { crop, areaValue, areaUnit, soilReportId } = req.body;

    if (!crop || !areaValue || !areaUnit) {
      return res.status(400).json({ error: 'crop, areaValue, and areaUnit are required' });
    }

    const area = parseFloat(areaValue);
    if (isNaN(area) || area <= 0) {
      return res.status(400).json({ error: 'areaValue must be a positive number' });
    }

    let soil: FertilizerCalcInput['soil'] | undefined;

    if (soilReportId) {
      const report = await SoilReport.findById(soilReportId).lean();
      if (report && report.farmerId.toString() === req.user!.userId) {
        soil = {
          nitrogen: report.nitrogen,
          phosphorus: report.phosphorus,
          potassium: report.potassium,
          organicCarbon: report.organicCarbon,
          pH: report.pH,
        };
      }
    } else {
      // Try latest soil report automatically
      const latest = await SoilReport.findOne({ farmerId: req.user!.userId })
        .sort({ createdAt: -1 })
        .select('nitrogen phosphorus potassium organicCarbon pH')
        .lean();
      if (latest) {
        soil = {
          nitrogen: latest.nitrogen,
          phosphorus: latest.phosphorus,
          potassium: latest.potassium,
          organicCarbon: latest.organicCarbon,
          pH: latest.pH,
        };
      }
    }

    const result = calculateFertilizer({ crop, areaValue: area, areaUnit, soil });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Fertilizer calculator error:', err);
    res.status(500).json({ error: err.message || 'Calculation failed' });
  }
});

// GET /api/fertilizer-calculator/soil-reports — list farmer's soil reports for selector
router.get('/soil-reports', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reports = await SoilReport.find({ farmerId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('soilType soilHealthScore soilHealthStatus createdAt nitrogen phosphorus potassium')
      .lean();
    res.json({ success: true, data: reports });
  } catch {
    res.status(500).json({ error: 'Failed to fetch soil reports' });
  }
});

export default router;
