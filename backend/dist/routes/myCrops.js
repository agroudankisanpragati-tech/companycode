"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const MyCrop_1 = require("../models/MyCrop");
const router = express_1.default.Router();
// POST /api/my-crops
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const crop = await MyCrop_1.MyCrop.create({ ...req.body, userId });
        res.status(201).json({ success: true, data: crop });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to save crop' });
    }
});
// GET /api/my-crops
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const crops = await MyCrop_1.MyCrop.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: crops });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch crops' });
    }
});
// GET /api/my-crops/:id
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const crop = await MyCrop_1.MyCrop.findOne({ _id: req.params.id, userId });
        if (!crop)
            return res.status(404).json({ error: 'Crop not found' });
        res.json({ success: true, data: crop });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch crop' });
    }
});
// DELETE /api/my-crops/:id
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const crop = await MyCrop_1.MyCrop.findOneAndDelete({ _id: req.params.id, userId });
        if (!crop)
            return res.status(404).json({ error: 'Crop not found' });
        res.json({ success: true, message: 'Crop removed' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete crop' });
    }
});
exports.default = router;
//# sourceMappingURL=myCrops.js.map