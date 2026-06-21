"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const BlogPost_1 = require("../models/BlogPost");
const GovtScheme_1 = require("../models/GovtScheme");
const User_1 = require("../models/User");
const CropRecommendation_1 = require("../models/CropRecommendation");
const Marketplace_1 = require("../models/Marketplace");
const AIRecommendation_1 = require("../models/AIRecommendation");
const FarmerCropRequest_1 = require("../models/FarmerCropRequest");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate, auth_1.requireAdmin);
const publicUserFields = 'name email phone farmSize location soilType waterSource role crops points verified createdAt updatedAt';
router.get('/overview', async (_req, res) => {
    try {
        const [totalUsers, totalAdmins, totalRecommendations, totalListings, totalBlogPosts, totalSchemes, recentUsers, recentRecommendations, recentListings,] = await Promise.all([
            User_1.User.countDocuments(),
            User_1.User.countDocuments({ role: 'admin' }),
            CropRecommendation_1.CropRecommendation.countDocuments(),
            Marketplace_1.MarketplaceListing.countDocuments(),
            BlogPost_1.BlogPost.countDocuments(),
            GovtScheme_1.GovtScheme.countDocuments(),
            User_1.User.find().select(publicUserFields).sort({ createdAt: -1 }).limit(5),
            CropRecommendation_1.CropRecommendation.find().sort({ createdAt: -1 }).limit(5),
            Marketplace_1.MarketplaceListing.find().sort({ createdAt: -1 }).limit(5),
        ]);
        res.json({
            success: true,
            data: {
                totals: {
                    users: totalUsers,
                    admins: totalAdmins,
                    cropRecommendations: totalRecommendations,
                    marketplaceListings: totalListings,
                    blogPosts: totalBlogPosts,
                    govtSchemes: totalSchemes,
                },
                recentUsers,
                recentRecommendations,
                recentListings,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to load admin overview' });
    }
});
router.get('/users', async (_req, res) => {
    try {
        const users = await User_1.User.find().select(publicUserFields).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: users,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['farmer', 'vendor', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select(publicUserFields);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            data: updatedUser,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});
router.patch('/users/:id/verify', async (req, res) => {
    try {
        const { verified } = req.body;
        const updatedUser = await User_1.User.findByIdAndUpdate(req.params.id, { verified: Boolean(verified) }, { new: true }).select(publicUserFields);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            data: updatedUser,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update verification' });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        const deletedUser = await User_1.User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
router.get('/recommendations', async (_req, res) => {
    try {
        const recommendations = await CropRecommendation_1.CropRecommendation.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: recommendations,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});
router.delete('/recommendations/:id', async (req, res) => {
    try {
        const deletedRecommendation = await CropRecommendation_1.CropRecommendation.findByIdAndDelete(req.params.id);
        if (!deletedRecommendation) {
            return res.status(404).json({ error: 'Recommendation not found' });
        }
        res.json({
            success: true,
            message: 'Recommendation deleted successfully',
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete recommendation' });
    }
});
router.get('/listings', async (_req, res) => {
    try {
        const listings = await Marketplace_1.MarketplaceListing.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: listings,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});
router.patch('/listings/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['available', 'sold', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const updatedListing = await Marketplace_1.MarketplaceListing.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!updatedListing) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        res.json({
            success: true,
            data: updatedListing,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update listing status' });
    }
});
router.delete('/listings/:id', async (req, res) => {
    try {
        const deletedListing = await Marketplace_1.MarketplaceListing.findByIdAndDelete(req.params.id);
        if (!deletedListing)
            return res.status(404).json({ error: 'Listing not found' });
        res.json({ success: true, message: 'Listing deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete listing' });
    }
});
// ─── AI Crop Recommendation Admin Routes ─────────────────────────────────────
router.get('/ai-analytics', async (_req, res) => {
    try {
        const [totalRequests, totalAICalls, totalCached, feedbackHelpful, feedbackNotHelpful] = await Promise.all([
            FarmerCropRequest_1.FarmerCropRequest.countDocuments(),
            AIRecommendation_1.AIRecommendation.countDocuments({ source: 'openai' }),
            AIRecommendation_1.AIRecommendation.countDocuments({ source: 'database' }),
            AIRecommendation_1.AIRecommendation.countDocuments({ feedback: 'helpful' }),
            AIRecommendation_1.AIRecommendation.countDocuments({ feedback: 'not_helpful' }),
        ]);
        // Most recommended crops
        const cropStats = await AIRecommendation_1.AIRecommendation.aggregate([
            { $unwind: '$recommendations' },
            { $group: { _id: '$recommendations.cropName', count: { $sum: 1 }, category: { $first: '$recommendations.cropCategory' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);
        // Category breakdown
        const categoryStats = await AIRecommendation_1.AIRecommendation.aggregate([
            { $unwind: '$recommendations' },
            { $group: { _id: '$recommendations.cropCategory', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        // Cost savings: each cached result saved ~1 API call at avg $0.01
        const estimatedSavings = totalCached * 0.01;
        res.json({
            success: true,
            data: {
                totalFarmerRequests: totalRequests,
                totalAICalls,
                totalCachedRecommendations: totalCached,
                estimatedApiCostSavings: `$${estimatedSavings.toFixed(2)}`,
                feedback: { helpful: feedbackHelpful, notHelpful: feedbackNotHelpful },
                mostRecommendedCrops: cropStats.map((c) => ({ cropName: c._id, count: c.count, category: c.category })),
                categoryAnalytics: categoryStats.map((c) => ({ category: c._id, count: c.count })),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to load AI analytics' });
    }
});
router.get('/ai-recommendations', async (_req, res) => {
    try {
        const recommendations = await AIRecommendation_1.AIRecommendation.find().sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data: recommendations });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI recommendations' });
    }
});
router.delete('/ai-recommendations/:id', async (req, res) => {
    try {
        const deleted = await AIRecommendation_1.AIRecommendation.findByIdAndDelete(req.params.id);
        if (!deleted)
            return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map