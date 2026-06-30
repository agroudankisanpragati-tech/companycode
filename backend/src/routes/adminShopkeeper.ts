import express from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { ShopkeeperProfile } from '../models/ShopkeeperProfile';
import { FertilizerProduct } from '../models/FertilizerProduct';
import { NurseryProduct } from '../models/NurseryProduct';
import { User } from '../models/User';

const router = express.Router();
router.use(authenticate, requireAdmin);

// ── Verification Center ───────────────────────────────────────────────────────

router.get('/verification/pending', async (_req: AuthenticatedRequest, res) => {
  try {
    const shops = await ShopkeeperProfile.find({
      profileCompleted: true,
      verificationSubmitted: true,
      verificationStatus: 'pending',
    })
      .populate('userId', 'name email phone')
      .sort({ updatedAt: -1 });
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

router.get('/verification/verified', async (_req: AuthenticatedRequest, res) => {
  try {
    const shops = await ShopkeeperProfile.find({ verificationStatus: 'verified' })
      .populate('userId', 'name email phone')
      .populate('verifiedBy', 'name email')
      .sort({ verifiedAt: -1 });
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verified shops' });
  }
});

router.get('/verification/rejected', async (_req: AuthenticatedRequest, res) => {
  try {
    const shops = await ShopkeeperProfile.find({ verificationStatus: 'rejected' })
      .populate('userId', 'name email phone')
      .sort({ rejectedAt: -1 });
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rejected shops' });
  }
});

// Approve
router.post('/verification/:id/approve', async (req: AuthenticatedRequest, res) => {
  try {
    const shop = await ShopkeeperProfile.findById(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    shop.verificationStatus = 'verified';
    shop.verifiedAt = new Date();
    shop.verifiedBy = req.user!.userId as any;
    shop.rejectionReason = undefined;
    await shop.save();

    res.json({ message: 'Shop verified successfully', shop });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve verification' });
  }
});

// Reject
router.post('/verification/:id/reject', async (req: AuthenticatedRequest, res) => {
  try {
    const { rejectionReason, allowReApplication } = req.body;
    const shop = await ShopkeeperProfile.findById(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    shop.verificationStatus = 'rejected';
    shop.rejectionReason = rejectionReason || 'Documents not satisfactory';
    shop.rejectedAt = new Date();
    shop.reApplicationAllowed = !!allowReApplication;
    shop.verificationSubmitted = false;
    await shop.save();

    res.json({ message: 'Shop rejected', shop });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject verification' });
  }
});

// ── Registered Shops Management ───────────────────────────────────────────────

router.get('/shops', async (req: AuthenticatedRequest, res) => {
  try {
    const { type, status } = req.query as Record<string, string>;
    const filter: any = {};
    if (type) filter.shopType = type;
    if (status) filter.verificationStatus = status;

    const [shops, totalFertilizer, totalNursery, totalVerified, totalPending, totalRejected] = await Promise.all([
      ShopkeeperProfile.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .lean(),
      ShopkeeperProfile.countDocuments({ shopType: 'fertilizer' }),
      ShopkeeperProfile.countDocuments({ shopType: 'nursery' }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'verified' }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'pending', verificationSubmitted: true }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'rejected' }),
    ]);

    // attach product counts
    const shopIds = shops.map(s => s._id);
    const [fertCounts, nurseryCounts] = await Promise.all([
      FertilizerProduct.aggregate([
        { $match: { shopkeeperId: { $in: shopIds } } },
        { $group: { _id: '$shopkeeperId', count: { $sum: 1 } } },
      ]),
      NurseryProduct.aggregate([
        { $match: { shopkeeperId: { $in: shopIds } } },
        { $group: { _id: '$shopkeeperId', count: { $sum: 1 } } },
      ]),
    ]);

    const productCountMap = new Map<string, number>();
    [...fertCounts, ...nurseryCounts].forEach(r => productCountMap.set(r._id.toString(), r.count));

    const shopsWithCounts = shops.map(s => ({
      ...s,
      productCount: productCountMap.get(s._id.toString()) || 0,
    }));

    res.json({
      shops: shopsWithCounts,
      summary: {
        total: shops.length,
        fertilizer: totalFertilizer,
        nursery: totalNursery,
        verified: totalVerified,
        pending: totalPending,
        rejected: totalRejected,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

router.get('/shops/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const shop = await ShopkeeperProfile.findById(req.params.id).populate('userId', 'name email phone');
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const [fertProducts, nurseryProducts] = await Promise.all([
      FertilizerProduct.find({ shopkeeperId: shop._id }),
      NurseryProduct.find({ shopkeeperId: shop._id }),
    ]);
    res.json({ shop, fertProducts, nurseryProducts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shop' });
  }
});

router.patch('/shops/:id/suspend', async (req: AuthenticatedRequest, res) => {
  try {
    const { suspended } = req.body;
    const shop = await ShopkeeperProfile.findByIdAndUpdate(
      req.params.id,
      { suspended: !!suspended },
      { new: true }
    );
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    res.json({ shop });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update suspension' });
  }
});

router.delete('/shops/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const shop = await ShopkeeperProfile.findByIdAndDelete(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    await Promise.all([
      FertilizerProduct.deleteMany({ shopkeeperId: shop._id }),
      NurseryProduct.deleteMany({ shopkeeperId: shop._id }),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete shop' });
  }
});

// ── Admin Product Monitoring ──────────────────────────────────────────────────

router.get('/products', async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.query as Record<string, string>;
    let fertProducts: any[] = [];
    let nurseryProducts: any[] = [];

    if (!type || type === 'fertilizer') {
      fertProducts = await FertilizerProduct.find()
        .populate('shopkeeperId', 'shopName ownerName verificationStatus')
        .sort({ createdAt: -1 })
        .lean();
      fertProducts = fertProducts.map(p => ({ ...p, productType: 'fertilizer' }));
    }
    if (!type || type === 'nursery') {
      nurseryProducts = await NurseryProduct.find()
        .populate('shopkeeperId', 'shopName ownerName verificationStatus')
        .sort({ createdAt: -1 })
        .lean();
      nurseryProducts = nurseryProducts.map(p => ({ ...p, productType: 'nursery' }));
    }

    res.json({ products: [...fertProducts, ...nurseryProducts] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.delete('/products/:type/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'fertilizer') {
      await FertilizerProduct.findByIdAndDelete(id);
    } else if (type === 'nursery') {
      await NurseryProduct.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get('/shop-stats', async (_req: AuthenticatedRequest, res) => {
  try {
    const [total, fertilizer, nursery, verified, pending, rejected, totalFertProducts, totalNurseryProducts] = await Promise.all([
      ShopkeeperProfile.countDocuments(),
      ShopkeeperProfile.countDocuments({ shopType: 'fertilizer' }),
      ShopkeeperProfile.countDocuments({ shopType: 'nursery' }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'verified' }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'pending', verificationSubmitted: true }),
      ShopkeeperProfile.countDocuments({ verificationStatus: 'rejected' }),
      FertilizerProduct.countDocuments(),
      NurseryProduct.countDocuments(),
    ]);
    res.json({
      total, fertilizer, nursery, verified, pending, rejected,
      totalProducts: totalFertProducts + totalNurseryProducts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
