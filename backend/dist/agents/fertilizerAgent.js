"use strict";
/**
 * Fertilizer Agent
 * Domain: Fertilizer products, NPK recommendations, organic alternatives
 * Data sources: FertilizerProduct, SoilReport MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFertilizerAgent = runFertilizerAgent;
const FertilizerProduct_1 = require("../models/FertilizerProduct");
const SoilReport_1 = require("../models/SoilReport");
async function runFertilizerAgent(ctx) {
    try {
        const { userId, message } = ctx;
        const fertilizerType = extractFertilizerType(message);
        const cropName = extractCropFromMessage(message);
        // Fetch farmer's latest soil report for context
        const soilReport = await SoilReport_1.SoilReport.findOne({ farmerId: userId })
            .sort({ createdAt: -1 })
            .lean();
        // Search fertilizer products
        const filter = {};
        if (fertilizerType)
            filter.$or = [
                { name: new RegExp(fertilizerType, 'i') },
                { type: new RegExp(fertilizerType, 'i') },
                { nutrientContent: new RegExp(fertilizerType, 'i') },
            ];
        if (cropName)
            filter.suitableCrops = new RegExp(cropName, 'i');
        const products = await FertilizerProduct_1.FertilizerProduct.find(filter).limit(5).lean();
        const soilContext = soilReport ? {
            soilType: soilReport.soilType,
            ph: soilReport.pH,
            nitrogenStatus: soilReport.nitrogen < 200 ? 'Low' : 'Adequate',
            phosphorusStatus: soilReport.phosphorus < 10 ? 'Low' : 'Adequate',
            potassiumStatus: soilReport.potassium < 150 ? 'Low' : 'Adequate',
            organicRecommendations: soilReport.recommendations?.organic,
            fertilizerRecommendations: soilReport.recommendations?.fertilizer,
        } : null;
        if (products.length === 0 && !soilContext) {
            return {
                agent: 'FertilizerAgent',
                success: true,
                data: {},
                summary: 'No specific fertilizer data found. Recommend the farmer to upload a soil report for personalized fertilizer advice.',
            };
        }
        const productList = products.map((p) => ({
            name: p.name,
            type: p.type,
            nutrientContent: p.nutrientContent,
            applicationRate: p.applicationRate,
            price: p.price,
            suitableCrops: p.suitableCrops,
        }));
        return {
            agent: 'FertilizerAgent',
            success: true,
            data: {
                products: productList,
                soilContext,
                cropName,
            },
            summary: soilContext
                ? `Soil N: ${soilContext.nitrogenStatus}, P: ${soilContext.phosphorusStatus}, K: ${soilContext.potassiumStatus}. Recommended fertilizers: ${soilContext.fertilizerRecommendations?.join(', ') || 'See soil report'}.`
                : `Found ${products.length} fertilizer product(s)${cropName ? ` for ${cropName}` : ''}.`,
        };
    }
    catch (err) {
        return {
            agent: 'FertilizerAgent',
            success: false,
            error: 'Fertilizer information is temporarily unavailable.',
        };
    }
}
function extractFertilizerType(msg) {
    const types = ['urea', 'dap', 'npk', 'potash', 'mop', 'compost', 'vermicompost', 'organic', 'micronutrient', 'zinc', 'boron', 'iron'];
    const lower = msg.toLowerCase();
    return types.find(t => lower.includes(t)) || '';
}
function extractCropFromMessage(msg) {
    const crops = ['wheat', 'rice', 'tomato', 'corn', 'maize', 'cotton', 'sugarcane', 'potato', 'onion', 'mustard', 'gram', 'soybean'];
    const lower = msg.toLowerCase();
    return crops.find(c => lower.includes(c)) || '';
}
//# sourceMappingURL=fertilizerAgent.js.map