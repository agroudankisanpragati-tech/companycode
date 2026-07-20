"use strict";
/**
 * Seed Agent
 * Domain: Seed varieties, availability, nearby seed shops
 * Data sources: NurseryProduct, ShopProduct, Shop MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeedAgent = runSeedAgent;
const NurseryProduct_1 = require("../models/NurseryProduct");
const ShopProduct_1 = require("../models/ShopProduct");
async function runSeedAgent(ctx) {
    try {
        const { message, farmerProfile } = ctx;
        const cropName = extractCropFromMessage(message);
        const state = farmerProfile?.state || '';
        const district = farmerProfile?.district || '';
        // Search nursery products for seeds
        const nurseryFilter = { productType: /seed/i };
        if (cropName)
            nurseryFilter.cropName = new RegExp(cropName, 'i');
        const nurseryProducts = await NurseryProduct_1.NurseryProduct.find(nurseryFilter)
            .limit(5)
            .lean();
        // Search shop products for seeds
        const shopFilter = { category: /seed/i, isAvailable: true };
        if (cropName)
            shopFilter.name = new RegExp(cropName, 'i');
        const shopProducts = await ShopProduct_1.ShopProduct.find(shopFilter)
            .limit(5)
            .lean();
        if (nurseryProducts.length === 0 && shopProducts.length === 0) {
            return {
                agent: 'SeedAgent',
                success: true,
                data: {},
                summary: `No seed products found${cropName ? ` for ${cropName}` : ''}. Guide the farmer to the Marketplace to find nearby seed shops.`,
            };
        }
        const seeds = [
            ...nurseryProducts.map((p) => ({
                name: p.name || p.cropName,
                variety: p.variety,
                price: p.price,
                unit: p.unit,
                source: 'nursery',
            })),
            ...shopProducts.map((p) => ({
                name: p.name,
                variety: p.description,
                price: p.price,
                unit: p.unit,
                source: 'shop',
            })),
        ];
        return {
            agent: 'SeedAgent',
            success: true,
            data: { seeds, cropName, district, state },
            summary: `Found ${seeds.length} seed product(s)${cropName ? ` for ${cropName}` : ''}. Varieties: ${seeds.slice(0, 3).map(s => s.name).join(', ')}.`,
        };
    }
    catch (err) {
        return {
            agent: 'SeedAgent',
            success: false,
            error: 'Seed information is temporarily unavailable.',
        };
    }
}
function extractCropFromMessage(msg) {
    const crops = [
        'wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane',
        'potato', 'onion', 'mustard', 'gram', 'soybean', 'bajra', 'jowar',
        'groundnut', 'sunflower', 'chilli', 'brinjal', 'cucumber', 'pumpkin',
    ];
    const lower = msg.toLowerCase();
    return crops.find(c => lower.includes(c)) || '';
}
//# sourceMappingURL=seedAgent.js.map