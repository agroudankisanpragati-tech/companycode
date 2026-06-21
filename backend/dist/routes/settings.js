"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const UserSettings_1 = require("../models/UserSettings");
const User_1 = require("../models/User");
const router = express_1.default.Router();
// GET /api/settings — load settings, create with defaults if first visit
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const settings = await UserSettings_1.UserSettings.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true });
        res.json({ success: true, data: settings });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// PUT /api/settings — save all or partial settings
router.put('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updates = { ...req.body };
        delete updates.userId; // never allow overwriting userId
        const settings = await UserSettings_1.UserSettings.findOneAndUpdate({ userId }, { $set: updates }, { upsert: true, new: true });
        res.json({ success: true, data: settings });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/settings/reset — reset to defaults
router.post('/reset', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const settings = await UserSettings_1.UserSettings.findOneAndUpdate({ userId }, { $set: { ...UserSettings_1.settingsDefaults } }, { upsert: true, new: true });
        res.json({ success: true, data: settings });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/settings/change-password
router.post('/change-password', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Both current and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
        }
        const user = await User_1.User.findById(userId);
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        const valid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!valid)
            return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        user.password = await bcryptjs_1.default.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map