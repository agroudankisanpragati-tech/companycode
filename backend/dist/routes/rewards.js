"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const router = express_1.default.Router();
// Points to INR conversion rate: 2 points = ₹1
const POINTS_TO_INR = 0.5;
// GET /api/rewards — get current user's points balance
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.userId).select('points name');
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, points: user.points });
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/rewards/redeem — redeem points for INR value
router.post('/redeem', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const redeemAmount = Number(req.body.amount) || 0;
        if (redeemAmount <= 0)
            return res.status(400).json({ error: 'Invalid amount' });
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        if (user.points < redeemAmount) {
            return res.status(400).json({ error: 'Insufficient points' });
        }
        user.points -= redeemAmount;
        await user.save();
        const redeemedValue = Math.round(redeemAmount * POINTS_TO_INR);
        return res.json({ success: true, points: user.points, redeemedValue });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=rewards.js.map