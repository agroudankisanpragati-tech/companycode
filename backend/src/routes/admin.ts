import express, { Response } from 'express';
import { BlogPost } from '../models/BlogPost';
import { GovtScheme } from '../models/GovtScheme';
import { User } from '../models/User';
import { CropRecommendation } from '../models/CropRecommendation';
import { MarketplaceListing } from '../models/Marketplace';
import { FarmerCropRequest } from '../models/FarmerCropRequest';
import { CropKnowledgeBase } from '../models/CropKnowledgeBase';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.use(authenticate, requireAdmin);

const publicUserFields = 'name email phone farmSize location soilType waterSource role crops points verified isActive lastLogin createdAt updatedAt';

router.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalRecommendations,
      totalListings,
      totalBlogPosts,
      totalSchemes,
      recentUsers,
      recentRecommendations,
      recentListings,
    ] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'admin' }),
        CropRecommendation.countDocuments(),
        MarketplaceListing.countDocuments(),
        BlogPost.countDocuments(),
        GovtScheme.countDocuments(),
        User.find().select(publicUserFields).sort({ createdAt: -1 }).limit(5),
        CropRecommendation.find().sort({ createdAt: -1 }).limit(5),
        MarketplaceListing.find().sort({ createdAt: -1 }).limit(5),
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const { search, role, verified } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (role && ['farmer', 'vendor', 'admin'].includes(role)) filter.role = role;
    if (verified === 'true') filter.verified = true;
    if (verified === 'false') filter.verified = false;

    const [users, total, totalFarmers, totalAdmins, totalVerified, totalActive] = await Promise.all([
      User.find(filter).select(publicUserFields).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ verified: true }),
      User.countDocuments({ isActive: true }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { total: await User.countDocuments(), farmers: totalFarmers, admins: totalAdmins, verified: totalVerified, active: totalActive },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;

    if (!['farmer', 'vendor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select(publicUserFields);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.patch('/users/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { verified } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { verified: Boolean(verified) },
      { new: true }
    ).select(publicUserFields);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

router.patch('/users/:id/disable', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: Boolean(isActive) },
      { new: true }
    ).select(publicUserFields);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/recommendations', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const recommendations = await CropRecommendation.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

router.delete('/recommendations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedRecommendation = await CropRecommendation.findByIdAndDelete(req.params.id);

    if (!deletedRecommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json({
      success: true,
      message: 'Recommendation deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recommendation' });
  }
});

router.get('/listings', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const listings = await MarketplaceListing.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: listings,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

router.patch('/listings/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!['available', 'sold', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedListing = await MarketplaceListing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedListing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({
      success: true,
      data: updatedListing,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update listing status' });
  }
});

router.delete('/listings/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedListing = await MarketplaceListing.findByIdAndDelete(req.params.id);
    if (!deletedListing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// ─── AI Crop Recommendation Admin Routes ─────────────────────────────────────
// Analytics now sourced entirely from CropKnowledgeBase (sourceType: 'AI')

router.get('/ai-analytics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [totalRequests, totalAICalls, totalCached] = await Promise.all([
      FarmerCropRequest.countDocuments(),
      CropKnowledgeBase.countDocuments({ sourceType: 'AI', source: 'openai' }),
      CropKnowledgeBase.countDocuments({ sourceType: 'AI', source: 'database' }),
    ]);

    const cropStats = await CropKnowledgeBase.aggregate([
      { $match: { sourceType: 'AI' } },
      { $group: { _id: '$cropName', count: { $sum: 1 }, category: { $first: '$cropCategory' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const categoryStats = await CropKnowledgeBase.aggregate([
      { $match: { sourceType: 'AI' } },
      { $group: { _id: '$cropCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const estimatedSavings = totalCached * 0.01;

    res.json({
      success: true,
      data: {
        totalFarmerRequests: totalRequests,
        totalAICalls,
        totalCachedRecommendations: totalCached,
        estimatedApiCostSavings: `$${estimatedSavings.toFixed(2)}`,
        feedback: { helpful: 0, notHelpful: 0 },
        mostRecommendedCrops: cropStats.map((c) => ({ cropName: c._id, count: c.count, category: c.category })),
        categoryAnalytics: categoryStats.map((c) => ({ category: c._id, count: c.count })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load AI analytics' });
  }
});

// List all AI-generated entries in CropKnowledgeBase
router.get('/ai-recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;
    const crops = await CropKnowledgeBase.find({ sourceType: 'AI' })
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(limit);
    const total = await CropKnowledgeBase.countDocuments({ sourceType: 'AI' });
    res.json({ success: true, data: crops, total, page, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI recommendations' });
  }
});

// Update an AI-generated crop entry (admin can edit)
router.put('/ai-recommendations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await CropKnowledgeBase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update' });
  }
});

// Change status of an AI crop entry (approve/disable/archive)
router.patch('/ai-recommendations/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updated = await CropKnowledgeBase.findByIdAndUpdate(
      req.params.id,
      { status, lastUpdated: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/ai-recommendations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await CropKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ─── Crop Knowledge Base Admin Routes ────────────────────────────────────────

router.get('/crop-knowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const { search, category } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};
    if (search) filter.cropName = new RegExp(search, 'i');
    if (category && ['Traditional', 'Medicinal', 'Fruit', 'Vegetable'].includes(category)) filter.cropCategory = category;

    const [crops, total, traditional, medicinal, fruit, vegetable] = await Promise.all([
      CropKnowledgeBase.find(filter).sort({ cropName: 1 }).skip(skip).limit(limit),
      CropKnowledgeBase.countDocuments(filter),
      CropKnowledgeBase.countDocuments({ cropCategory: 'Traditional' }),
      CropKnowledgeBase.countDocuments({ cropCategory: 'Medicinal' }),
      CropKnowledgeBase.countDocuments({ cropCategory: 'Fruit' }),
      CropKnowledgeBase.countDocuments({ cropCategory: 'Vegetable' }),
    ]);

    res.json({
      success: true,
      data: crops,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: { total: await CropKnowledgeBase.countDocuments(), traditional, medicinal, fruit, vegetable },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crops' });
  }
});

router.get('/crop-knowledge/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const crop = await CropKnowledgeBase.findById(req.params.id);
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true, data: crop });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crop' });
  }
});

router.post('/crop-knowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const crop = new CropKnowledgeBase(req.body);
    await crop.save();
    res.status(201).json({ success: true, data: crop });
  } catch (error: any) {
    if (error.code === 11000) return res.status(400).json({ error: 'Crop with this name already exists' });
    res.status(500).json({ error: error.message || 'Failed to create crop' });
  }
});

router.put('/crop-knowledge/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const crop = await CropKnowledgeBase.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true, data: crop });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update crop' });
  }
});

router.delete('/crop-knowledge/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const crop = await CropKnowledgeBase.findByIdAndDelete(req.params.id);
    if (!crop) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true, message: 'Crop deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete crop' });
  }
});

export default router;