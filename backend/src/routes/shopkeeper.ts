import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { ShopkeeperProfile } from '../models/ShopkeeperProfile';
import { FertilizerProduct } from '../models/FertilizerProduct';
import { NurseryProduct } from '../models/NurseryProduct';

const router = express.Router();

// ── Upload setup ──────────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), 'uploads', 'shopkeeper');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Only image files allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const fileUrl = (f: string) => `/uploads/shopkeeper/${f}`;

// ── Helper ────────────────────────────────────────────────────────────────────
const requireShopkeeper = (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'vendor') return res.status(403).json({ error: 'Shopkeepers only' });
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/shopkeeper/profile  — get own profile (creates if missing)
router.get('/profile', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    let profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    res.json({ profile: profile || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/shopkeeper/select-type  — first-time shop type selection
router.post('/select-type', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const { shopType } = req.body;
    if (!['fertilizer', 'nursery'].includes(shopType))
      return res.status(400).json({ error: 'Invalid shop type' });

    const existing = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (existing) {
      existing.shopType = shopType;
      await existing.save();
      return res.json({ profile: existing });
    }

    const profile = await ShopkeeperProfile.create({
      userId: req.user!.userId,
      shopType,
      profileCompleted: false,
      verificationStatus: 'pending',
      verificationSubmitted: false,
      reApplicationAllowed: false,
    });
    res.status(201).json({ profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set shop type' });
  }
});

// PUT /api/shopkeeper/profile  — complete/update profile
router.put(
  '/profile',
  authenticate,
  requireShopkeeper,
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'gstCertificate', maxCount: 1 },
    { name: 'shopRegistrationImage', maxCount: 1 },
    { name: 'nurseryPhoto', maxCount: 1 },
    { name: 'nurseryRegistrationCertificate', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const body = req.body;

      const update: any = {
        shopName: body.shopName,
        ownerName: body.ownerName,
        mobileNumber: body.mobileNumber,
        email: body.email,
        address: body.address,
        village: body.village,
        tehsil: body.tehsil,
        district: body.district,
        state: body.state,
        pincode: body.pincode,
        latitude: parseFloat(body.latitude) || 0,
        longitude: parseFloat(body.longitude) || 0,
        registrationDate: body.registrationDate ? new Date(body.registrationDate) : undefined,
        gstNumber: body.gstNumber,
        shopLicenseNumber: body.shopLicenseNumber,
        nurseryName: body.nurseryName,
        nurseryDescription: body.nurseryDescription,
        profileCompleted: true,
      };

      if (files.profileImage?.[0]) update.profileImage = fileUrl(files.profileImage[0].filename);
      if (files.coverImage?.[0]) update.coverImage = fileUrl(files.coverImage[0].filename);
      if (files.gstCertificate?.[0]) update.gstCertificate = fileUrl(files.gstCertificate[0].filename);
      if (files.shopRegistrationImage?.[0]) update.shopRegistrationImage = fileUrl(files.shopRegistrationImage[0].filename);
      if (files.nurseryPhoto?.[0]) update.nurseryPhoto = fileUrl(files.nurseryPhoto[0].filename);
      if (files.nurseryRegistrationCertificate?.[0]) update.nurseryRegistrationCertificate = fileUrl(files.nurseryRegistrationCertificate[0].filename);

      // Remove undefined values
      Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

      const profile = await ShopkeeperProfile.findOneAndUpdate(
        { userId: req.user!.userId },
        update,
        { new: true, upsert: false }
      );
      if (!profile) return res.status(404).json({ error: 'Profile not found. Select shop type first.' });

      res.json({ profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
  }
);

// POST /api/shopkeeper/submit-verification  — submit docs for admin review
router.post('/submit-verification', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!profile.profileCompleted) return res.status(400).json({ error: 'Complete profile first' });
    if (profile.verificationStatus === 'verified') return res.status(400).json({ error: 'Already verified' });
    if (profile.verificationStatus === 'rejected' && !profile.reApplicationAllowed)
      return res.status(400).json({ error: 'Re-application not allowed' });

    profile.verificationSubmitted = true;
    profile.verificationStatus = 'pending';
    await profile.save();
    res.json({ message: 'Verification request submitted', profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FERTILIZER PRODUCT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/fertilizer-products', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const products = await FertilizerProduct.find({ shopkeeperId: profile._id }).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post(
  '/fertilizer-products',
  authenticate,
  requireShopkeeper,
  upload.array('productImages', 5),
  async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.shopType !== 'fertilizer') return res.status(403).json({ error: 'Fertilizer shops only' });

      const files = req.files as Express.Multer.File[];
      const images = files?.map(f => fileUrl(f.filename)) || [];

      const body = req.body;
      const product = await FertilizerProduct.create({
        shopkeeperId: profile._id,
        productName: body.productName,
        brandName: body.brandName || '',
        category: body.category || 'Fertilizer',
        productSubCategory: body.productSubCategory || 'fertilizer',
        cropType: body.cropType || '',
        variety: body.variety || '',
        productImages: images,
        quantity: parseFloat(body.quantity) || 0,
        unit: body.unit || 'kg',
        mrp: parseFloat(body.mrp) || 0,
        sellingPrice: parseFloat(body.sellingPrice) || 0,
        description: body.description || '',
        usageInstructions: body.usageInstructions || '',
        dosage: body.dosage || '',
        cropSuitability: body.cropSuitability ? JSON.parse(body.cropSuitability) : [],
        nutrientComposition: body.nutrientComposition || '',
        manufacturingCompany: body.manufacturingCompany || '',
        manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
        stockStatus: body.stockStatus || 'in_stock',
        aiScanned: body.aiScanned === 'true',
      });
      res.status(201).json({ product });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create product' });
    }
  }
);

router.put(
  '/fertilizer-products/:id',
  authenticate,
  requireShopkeeper,
  upload.array('productImages', 5),
  async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      const product = await FertilizerProduct.findOne({ _id: req.params.id, shopkeeperId: profile._id });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const files = req.files as Express.Multer.File[];
      const body = req.body;

      const update: any = {
        productName: body.productName,
        brandName: body.brandName,
        category: body.category,
        productSubCategory: body.productSubCategory,
        cropType: body.cropType,
        variety: body.variety,
        quantity: parseFloat(body.quantity) || product.quantity,
        unit: body.unit,
        mrp: parseFloat(body.mrp) || product.mrp,
        sellingPrice: parseFloat(body.sellingPrice) || product.sellingPrice,
        description: body.description,
        usageInstructions: body.usageInstructions,
        dosage: body.dosage,
        cropSuitability: body.cropSuitability ? JSON.parse(body.cropSuitability) : product.cropSuitability,
        nutrientComposition: body.nutrientComposition,
        manufacturingCompany: body.manufacturingCompany,
        stockStatus: body.stockStatus || product.stockStatus,
      };
      if (body.manufacturingDate) update.manufacturingDate = new Date(body.manufacturingDate);
      if (body.expiryDate) update.expiryDate = new Date(body.expiryDate);
      if (files?.length > 0) update.productImages = files.map(f => fileUrl(f.filename));
      Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

      const updated = await FertilizerProduct.findByIdAndUpdate(req.params.id, update, { new: true });
      res.json({ product: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update product' });
    }
  }
);

router.delete('/fertilizer-products/:id', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const deleted = await FertilizerProduct.findOneAndDelete({ _id: req.params.id, shopkeeperId: profile._id });
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NURSERY PRODUCT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/nursery-products', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const products = await NurseryProduct.find({ shopkeeperId: profile._id }).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post(
  '/nursery-products',
  authenticate,
  requireShopkeeper,
  upload.array('productImages', 8),
  async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      if (profile.shopType !== 'nursery') return res.status(403).json({ error: 'Nursery shops only' });

      const files = req.files as Express.Multer.File[];
      const images = files?.map(f => fileUrl(f.filename)) || [];
      const body = req.body;

      const product = await NurseryProduct.create({
        shopkeeperId: profile._id,
        plantName: body.plantName,
        variety: body.variety || '',
        productImages: images,
        price: parseFloat(body.price) || 0,
        description: body.description || '',
        availableQuantity: parseInt(body.availableQuantity) || 0,
        plantAge: body.plantAge || '',
        plantHeight: body.plantHeight || '',
        sunlightRequirement: body.sunlightRequirement || '',
        waterRequirement: body.waterRequirement || '',
        suitableSeason: body.suitableSeason ? JSON.parse(body.suitableSeason) : [],
        growthDuration: body.growthDuration || '',
        maintenanceLevel: body.maintenanceLevel || 'medium',
        organicCertified: body.organicCertified === 'true',
        stockStatus: body.stockStatus || 'in_stock',
      });
      res.status(201).json({ product });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create product' });
    }
  }
);

router.put(
  '/nursery-products/:id',
  authenticate,
  requireShopkeeper,
  upload.array('productImages', 8),
  async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
      if (!profile) return res.status(404).json({ error: 'Profile not found' });

      const product = await NurseryProduct.findOne({ _id: req.params.id, shopkeeperId: profile._id });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const files = req.files as Express.Multer.File[];
      const body = req.body;
      const update: any = {
        plantName: body.plantName,
        variety: body.variety,
        price: parseFloat(body.price) || product.price,
        description: body.description,
        availableQuantity: parseInt(body.availableQuantity) || product.availableQuantity,
        plantAge: body.plantAge,
        plantHeight: body.plantHeight,
        sunlightRequirement: body.sunlightRequirement,
        waterRequirement: body.waterRequirement,
        suitableSeason: body.suitableSeason ? JSON.parse(body.suitableSeason) : product.suitableSeason,
        growthDuration: body.growthDuration,
        maintenanceLevel: body.maintenanceLevel,
        organicCertified: body.organicCertified !== undefined ? body.organicCertified === 'true' : product.organicCertified,
        stockStatus: body.stockStatus || product.stockStatus,
      };
      if (files?.length > 0) update.productImages = files.map(f => fileUrl(f.filename));
      Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

      const updated = await NurseryProduct.findByIdAndUpdate(req.params.id, update, { new: true });
      res.json({ product: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update product' });
    }
  }
);

router.delete('/nursery-products/:id', authenticate, requireShopkeeper, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await ShopkeeperProfile.findOne({ userId: req.user!.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const deleted = await NurseryProduct.findOneAndDelete({ _id: req.params.id, shopkeeperId: profile._id });
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE — public discovery for farmers
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/shopkeeper/marketplace?lat=&lng=&village=&tehsil=&district=&state=&type=&search=
router.get('/marketplace', async (req, res) => {
  try {
    const { lat, lng, village, tehsil, district, state, type, search } = req.query as Record<string, string>;

    const filter: any = { profileCompleted: true, suspended: false };
    if (type && ['fertilizer', 'nursery'].includes(type)) filter.shopType = type;

    const shops = await ShopkeeperProfile.find(filter)
      .select('shopType shopName ownerName mobileNumber village tehsil district state latitude longitude profileImage coverImage verificationStatus nurseryName')
      .lean();

    const userLat = parseFloat(lat) || 0;
    const userLng = parseFloat(lng) || 0;

    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // Fetch product counts
    const shopIds = shops.map(s => s._id);
    const [fertCounts, nurseryCounts] = await Promise.all([
      FertilizerProduct.aggregate([{ $match: { shopkeeperId: { $in: shopIds }, stockStatus: 'in_stock' } }, { $group: { _id: '$shopkeeperId', count: { $sum: 1 } } }]),
      NurseryProduct.aggregate([{ $match: { shopkeeperId: { $in: shopIds }, stockStatus: 'in_stock' } }, { $group: { _id: '$shopkeeperId', count: { $sum: 1 } } }]),
    ]);
    const productCountMap = new Map<string, number>();
    [...fertCounts, ...nurseryCounts].forEach(r => productCountMap.set(r._id.toString(), r.count));

    const ranked = shops
      .map(shop => {
        // Ranking score — higher = shown first (6-level distance hierarchy)
        let score = 0;
        if (shop.verificationStatus === 'verified') score += 10000;
        const sv = (s?: string) => s?.toLowerCase().trim() || '';
        if (village && sv(shop.village) === sv(village)) score += 8000;       // same village
        else if (tehsil && sv(shop.tehsil) === sv(tehsil)) score += 4000;    // same panchayat/tehsil
        if (district && sv(shop.district) === sv(district)) score += 2000;   // same district
        if (state && sv(shop.state) === sv(state)) score += 500;             // same state

        let distance: number | null = null;
        if (userLat && userLng && shop.latitude && shop.longitude) {
          distance = Math.round(haversine(userLat, userLng, shop.latitude, shop.longitude) * 10) / 10;
          score -= distance; // closer = higher score
        }

        return {
          ...shop,
          distance,
          productCount: productCountMap.get(shop._id.toString()) || 0,
          score,
        };
      })
      .filter(shop => {
        if (!search) return true;
        const q = search.toLowerCase();
        return shop.shopName?.toLowerCase().includes(q) ||
          shop.ownerName?.toLowerCase().includes(q) ||
          shop.district?.toLowerCase().includes(q) ||
          shop.village?.toLowerCase().includes(q);
      })
      .sort((a, b) => b.score - a.score);

    res.json({ shops: ranked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch marketplace' });
  }
});

// GET /api/shopkeeper/marketplace/:id  — public shop + products
router.get('/marketplace/:id', async (req, res) => {
  try {
    const shop = await ShopkeeperProfile.findById(req.params.id)
      .select('-userId -gstCertificate -shopRegistrationImage -nurseryRegistrationCertificate')
      .lean();
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    let products: any[] = [];
    if (shop.shopType === 'fertilizer') {
      products = await FertilizerProduct.find({ shopkeeperId: shop._id, stockStatus: 'in_stock' })
        .select('productName brandName category productSubCategory cropType variety productImages mrp sellingPrice quantity unit description stockStatus')
        .sort({ productSubCategory: 1, productName: 1 })
        .lean();
    } else {
      products = await NurseryProduct.find({ shopkeeperId: shop._id, stockStatus: 'in_stock' })
        .select('plantName variety productImages price description availableQuantity organicCertified suitableSeason stockStatus')
        .sort({ plantName: 1 })
        .lean();
    }

    res.json({ shop, products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shop' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROP PRODUCTS — AI Crop Advisory full product enrichment
// GET /api/shopkeeper/crop-products?crop=Wheat&category=&lat=&lng=&village=&tehsil=&district=&state=
// Returns all in-stock products (seeds, fertilizers, pesticides, fungicides, etc.) relevant to a crop
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/crop-products', async (req, res) => {
  try {
    const { crop, category, lat, lng, village, tehsil, district, state } = req.query as Record<string, string>;
    if (!crop) return res.status(400).json({ error: 'crop parameter required' });

    const cropNorm = crop.trim().toLowerCase();

    // Build match condition: crop relevance across all subcategories
    const cropMatch = {
      stockStatus: 'in_stock',
      ...(category ? { productSubCategory: category } : {}),
      $or: [
        { cropType: { $regex: cropNorm, $options: 'i' } },
        { cropSuitability: { $elemMatch: { $regex: cropNorm, $options: 'i' } } },
        { productName: { $regex: cropNorm, $options: 'i' } },
        // For non-seed categories (fertilizers, pesticides, etc.) also match if no specific crop is set
        // meaning the product is general-purpose (empty cropType / suitability)
        ...(category && category !== 'seed' ? [{ cropType: '' }, { cropType: { $exists: false } }] : []),
      ],
    };

    const products = await FertilizerProduct.find(cropMatch)
      .select('shopkeeperId productName brandName category productSubCategory cropType variety sellingPrice mrp quantity unit description stockStatus')
      .lean();

    if (products.length === 0) return res.json({ crop, results: [] });

    const shopIds = [...new Set(products.map(p => p.shopkeeperId.toString()))];
    const shops = await ShopkeeperProfile.find({ _id: { $in: shopIds }, suspended: false, profileCompleted: true })
      .select('shopName ownerName mobileNumber village tehsil district state latitude longitude profileImage verificationStatus')
      .lean();

    const shopMap = new Map(shops.map(s => [s._id.toString(), s]));

    const userLat = parseFloat(lat) || 0;
    const userLng = parseFloat(lng) || 0;

    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const sv = (s?: string) => s?.toLowerCase().trim() || '';

    // Group products by subcategory → then by shop
    const byCategory = new Map<string, Map<string, { shop: any; products: any[]; distance: number | null; score: number }>>();

    for (const product of products) {
      const shopId = product.shopkeeperId.toString();
      const shop = shopMap.get(shopId);
      if (!shop) continue;

      const subcat = product.productSubCategory || 'other';
      if (!byCategory.has(subcat)) byCategory.set(subcat, new Map());
      const catMap = byCategory.get(subcat)!;

      if (!catMap.has(shopId)) {
        let score = 0;
        if (shop.verificationStatus === 'verified') score += 10000;
        if (village && sv(shop.village) === sv(village)) score += 8000;
        else if (tehsil && sv(shop.tehsil) === sv(tehsil)) score += 4000;
        if (district && sv(shop.district) === sv(district)) score += 2000;
        if (state && sv(shop.state) === sv(state)) score += 500;

        let distance: number | null = null;
        if (userLat && userLng && shop.latitude && shop.longitude) {
          distance = Math.round(haversine(userLat, userLng, shop.latitude, shop.longitude) * 10) / 10;
          score -= distance;
        }
        catMap.set(shopId, { shop, products: [], distance, score });
      }
      catMap.get(shopId)!.products.push(product);
    }

    // Build response: { category -> top 3 shops each with top 3 products }
    const results: Record<string, any[]> = {};
    for (const [subcat, catMap] of byCategory.entries()) {
      results[subcat] = Array.from(catMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(entry => ({ ...entry, products: entry.products.slice(0, 3) }));
    }

    res.json({ crop, results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch crop products' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEED SEARCH — AI Crop Advisory integration
// GET /api/shopkeeper/seed-search?crop=Wheat&lat=&lng=&district=&state=
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/seed-search', async (req, res) => {
  try {
    const { crop, lat, lng, district, state } = req.query as Record<string, string>;
    if (!crop) return res.status(400).json({ error: 'crop parameter required' });

    const cropNorm = crop.trim().toLowerCase();

    // Find in-stock products matching crop name (seed subcategory OR category="Seed" OR name match)
    const seeds = await FertilizerProduct.find({
      stockStatus: 'in_stock',
      $or: [
        // Strict seed subcategory with crop match
        { productSubCategory: 'seed', cropType: { $regex: cropNorm, $options: 'i' } },
        { productSubCategory: 'seed', cropSuitability: { $elemMatch: { $regex: cropNorm, $options: 'i' } } },
        { productSubCategory: 'seed', productName: { $regex: cropNorm, $options: 'i' } },
        // category field = "Seed" (case insensitive) with crop match
        { category: { $regex: /^seed$/i }, cropType: { $regex: cropNorm, $options: 'i' } },
        { category: { $regex: /^seed$/i }, productName: { $regex: cropNorm, $options: 'i' } },
        // Fallback: product name directly matches crop name (any subcategory)
        { productName: { $regex: cropNorm, $options: 'i' } },
      ],
    })
      .select('shopkeeperId productName brandName variety productImages sellingPrice mrp quantity unit description productSubCategory category cropType')
      .lean();

    if (seeds.length === 0) return res.json({ results: [] });

    // Get shop profiles for those seeds
    const shopIds = [...new Set(seeds.map(s => s.shopkeeperId.toString()))];
    const shops = await ShopkeeperProfile.find({ _id: { $in: shopIds }, suspended: false, profileCompleted: true })
      .select('shopName ownerName mobileNumber village tehsil district state latitude longitude profileImage verificationStatus')
      .lean();

    const shopMap = new Map(shops.map(s => [s._id.toString(), s]));

    const userLat = parseFloat(lat) || 0;
    const userLng = parseFloat(lng) || 0;

    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // Also accept village/tehsil for full proximity hierarchy
    const { village: seedVillage, tehsil: seedTehsil } = req.query as Record<string, string>;

    // Group seeds by shop
    const shopSeedMap = new Map<string, any[]>();
    seeds.forEach(seed => {
      const sid = seed.shopkeeperId.toString();
      if (!shopSeedMap.has(sid)) shopSeedMap.set(sid, []);
      shopSeedMap.get(sid)!.push(seed);
    });

    const results = Array.from(shopSeedMap.entries())
      .map(([shopId, shopSeeds]) => {
        const shop = shopMap.get(shopId);
        if (!shop) return null;

        const sv = (s?: string) => s?.toLowerCase().trim() || '';
        let score = 0;
        if (shop.verificationStatus === 'verified') score += 10000;
        if (seedVillage && sv(shop.village) === sv(seedVillage)) score += 8000;
        else if (seedTehsil && sv(shop.tehsil) === sv(seedTehsil)) score += 4000;
        if (district && sv(shop.district) === sv(district)) score += 2000;
        if (state && sv(shop.state) === sv(state)) score += 500;

        let distance: number | null = null;
        if (userLat && userLng && shop.latitude && shop.longitude) {
          distance = Math.round(haversine(userLat, userLng, shop.latitude, shop.longitude) * 10) / 10;
          score -= distance;
        }

        return { shop, seeds: shopSeeds, distance, score };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    res.json({ crop, results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search seeds' });
  }
});

export default router;
