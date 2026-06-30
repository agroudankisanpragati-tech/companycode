import express from 'express';
import { User } from '../models/User';
import { MarketplaceListing } from '../models/Marketplace';
import { Shop } from '../models/Shop';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get list of shops (vendors) with optional state/district filtering
router.get('/', async (req, res, next) => {
    try {
        const { state, district } = req.query as any;
        const filter: any = {};

        if (state) filter['location.state'] = state;
        if (district) filter['location.district'] = district;

        const shops = await Shop.find(filter).select('name phone location verified ownerId');
        res.json({ data: shops });
    } catch (err) {
        next(err);
    }
});

// Create a shop (authenticated vendor/shopkeeper)
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { userId, role } = req.user || {};
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        if (role !== 'vendor' && role !== 'admin') {
            // allow admin to create shops too
            return res.status(403).json({ error: 'Only vendors can create shops' });
        }

        const { name, phone, address, location, openHours, description, images } = req.body;
        const existing = await Shop.findOne({ ownerId: userId });
        if (existing) return res.status(400).json({ error: 'Shop already exists for this user' });

        const shop = await Shop.create({
            ownerId: userId,
            name,
            phone,
            address,
            location,
            openHours,
            description,
            images,
        });

        res.status(201).json({ shop });
    } catch (err) {
        next(err);
    }
});

// Get shop profile by shop id, include a summary of listings
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const shop = await Shop.findById(id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        const listings = await MarketplaceListing.find({ sellerId: shop.ownerId, status: 'available' }).select(
            'cropName quantity unit pricePerUnit image description'
        );

        // also return basic owner info
        const owner = await User.findById(shop.ownerId).select('name phone');

        res.json({ shop, owner, listings });
    } catch (err) {
        next(err);
    }
});

// Add a product/listing under a shop (only owner or admin)
router.post('/:id/products', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params; // shop id
        const { userId, role } = req.user || {};
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const shop = await Shop.findById(id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        // only shop owner or admin can add products
        if (shop.ownerId.toString() !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not allowed' });
        }

        const { cropName, quantity, unit, pricePerUnit, image, description } = req.body;

        const listing = await MarketplaceListing.create({
            sellerId: shop.ownerId,
            cropName,
            quantity,
            unit: unit || 'kg',
            pricePerUnit,
            image,
            description,
            location: shop.location || { state: '', district: '' },
            status: 'available',
        });

        res.status(201).json({ listing });
    } catch (err) {
        next(err);
    }
});

// Update a product/listing under a shop (only owner or admin)
router.put('/:id/products/:productId', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id, productId } = req.params;
        const { userId, role } = req.user || {};
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const shop = await Shop.findById(id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        if (shop.ownerId.toString() !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not allowed' });
        }

        const updated = await MarketplaceListing.findOneAndUpdate(
            { _id: productId, sellerId: shop.ownerId },
            {
                cropName: req.body.cropName,
                quantity: req.body.quantity,
                unit: req.body.unit || 'kg',
                pricePerUnit: req.body.pricePerUnit,
                image: req.body.image,
                description: req.body.description,
                location: shop.location || { state: '', district: '' },
            },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: 'Product not found' });

        res.json({ listing: updated });
    } catch (err) {
        next(err);
    }
});

// Delete a product/listing under a shop (only owner or admin)
router.delete('/:id/products/:productId', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id, productId } = req.params;
        const { userId, role } = req.user || {};
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const shop = await Shop.findById(id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        if (shop.ownerId.toString() !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not allowed' });
        }

        const deleted = await MarketplaceListing.findOneAndDelete({ _id: productId, sellerId: shop.ownerId });
        if (!deleted) return res.status(404).json({ error: 'Product not found' });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Update shop profile (only owner or admin)
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user || {};
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const shop = await Shop.findById(id);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        // only shop owner or admin can update
        if (shop.ownerId.toString() !== userId && role !== 'admin') {
            return res.status(403).json({ error: 'Not allowed' });
        }

        const { name, phone, address, location, openHours, description, images } = req.body;

        const updated = await Shop.findByIdAndUpdate(
            id,
            { name, phone, address, location, openHours, description, images },
            { new: true }
        );

        res.json({ shop: updated });
    } catch (err) {
        next(err);
    }
});

export default router;
