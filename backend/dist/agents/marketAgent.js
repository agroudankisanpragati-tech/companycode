"use strict";
/**
 * Market Agent
 * Domain: Mandi prices, commodity rates, selling advice
 * Data sources: Marketplace, MarketPriceHistory MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMarketAgent = runMarketAgent;
const Marketplace_1 = require("../models/Marketplace");
const MarketPriceHistory_1 = require("../models/MarketPriceHistory");
async function runMarketAgent(ctx) {
    try {
        const { message, pageData, farmerProfile } = ctx;
        // If market data is already on the page, use it
        if (pageData?.marketData) {
            const m = pageData.marketData;
            return {
                agent: 'MarketAgent',
                success: true,
                data: m,
                summary: `${m.commodity} at ${m.market}, ${m.state}: Modal ₹${m.modalPrice}/quintal, Min ₹${m.minPrice}, Max ₹${m.maxPrice}.`,
            };
        }
        const commodity = extractCommodityFromMessage(message);
        const state = farmerProfile?.state || '';
        // Search by commodity and/or state
        const filter = {};
        if (commodity)
            filter.commodity = new RegExp(commodity, 'i');
        if (state)
            filter.state = new RegExp(state, 'i');
        // Try MarketPriceHistory first (most recent prices)
        const priceRecord = await MarketPriceHistory_1.MarketPriceHistory.findOne(filter)
            .sort({ arrivalDate: -1 })
            .lean();
        if (priceRecord) {
            const p = priceRecord;
            return {
                agent: 'MarketAgent',
                success: true,
                data: {
                    commodity: p.commodity,
                    market: p.market,
                    state: p.state,
                    district: p.district,
                    modalPrice: p.modalPrice,
                    minPrice: p.minPrice,
                    maxPrice: p.maxPrice,
                    arrivalDate: p.arrivalDate,
                },
                summary: `${p.commodity} at ${p.market} (${p.state}): Modal ₹${p.modalPrice}/quintal, Min ₹${p.minPrice}, Max ₹${p.maxPrice} as of ${p.arrivalDate}.`,
            };
        }
        // Fallback: Marketplace listings
        const listing = await Marketplace_1.MarketplaceListing.findOne(commodity ? { cropName: new RegExp(commodity, 'i') } : {}).sort({ createdAt: -1 }).lean();
        if (listing) {
            const l = listing;
            return {
                agent: 'MarketAgent',
                success: true,
                data: {
                    commodity: l.cropName,
                    price: l.price,
                    unit: l.unit,
                    location: l.location,
                },
                summary: `${l.cropName} listed at ₹${l.price}/${l.unit} in ${l.location?.district || 'N/A'}.`,
            };
        }
        return {
            agent: 'MarketAgent',
            success: true,
            data: {},
            summary: 'No market price data found. Guide the farmer to the Mandi Prices page for live rates.',
        };
    }
    catch (err) {
        return {
            agent: 'MarketAgent',
            success: false,
            error: 'Market price information is temporarily unavailable.',
        };
    }
}
function extractCommodityFromMessage(msg) {
    const commodities = [
        'wheat', 'rice', 'paddy', 'maize', 'corn', 'cotton', 'sugarcane',
        'potato', 'onion', 'tomato', 'mustard', 'gram', 'soybean', 'groundnut',
        'bajra', 'jowar', 'arhar', 'moong', 'urad', 'sunflower',
    ];
    const lower = msg.toLowerCase();
    return commodities.find(c => lower.includes(c)) || '';
}
//# sourceMappingURL=marketAgent.js.map