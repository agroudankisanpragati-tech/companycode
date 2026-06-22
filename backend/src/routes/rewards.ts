import express, { Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { User } from '../models/User';

const router = express.Router();

// Points to INR conversion rate: 2 points = ₹1
const POINTS_TO_INR = 0.5;

// GET /api/rewards — get current user's points balance
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('points name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, points: user.points });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rewards/redeem — redeem points for INR value
router.post('/redeem', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const redeemAmount = Number(req.body.amount) || 0;

    if (redeemAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.points < redeemAmount) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    user.points -= redeemAmount;
    await user.save();

    const redeemedValue = Math.round(redeemAmount * POINTS_TO_INR);

    return res.json({ success: true, points: user.points, redeemedValue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
