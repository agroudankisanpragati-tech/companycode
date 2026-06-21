import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { MyCrop } from '../models/MyCrop';

const router = express.Router();

// POST /api/my-crops
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const crop = await MyCrop.create({ ...req.body, userId });
    res.status(201).json({ success: true, data: crop });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save crop' });
  }
});

// GET /api/my-crops
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const crops = await MyCrop.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: crops });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch crops' });
  }
});

// GET /api/my-crops/:id
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const crop = await MyCrop.findOne({ _id: req.params.id, userId });
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true, data: crop });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch crop' });
  }
});

// DELETE /api/my-crops/:id
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const crop = await MyCrop.findOneAndDelete({ _id: req.params.id, userId });
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true, message: 'Crop removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete crop' });
  }
});

export default router;
