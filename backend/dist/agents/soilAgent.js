"use strict";
/**
 * Soil Agent
 * Domain: Soil health analysis, deficiencies, fertilizer recommendations
 * Data sources: SoilReport, SoilStandard MongoDB collections
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSoilAgent = runSoilAgent;
const SoilReport_1 = require("../models/SoilReport");
async function runSoilAgent(ctx) {
    try {
        const { userId, pageData } = ctx;
        // If soil data is already on the page, use it directly
        if (pageData?.soilData) {
            const s = pageData.soilData;
            return {
                agent: 'SoilAgent',
                success: true,
                data: s,
                summary: `Soil Health Score: ${s.healthScore}/100 (${s.healthStatus}). pH: ${s.ph}. N: ${s.nitrogen}, P: ${s.phosphorus}, K: ${s.potassium}. Recommendations: ${s.recommendations || 'See soil report.'}`,
            };
        }
        // Fetch the farmer's latest soil report from DB
        const report = await SoilReport_1.SoilReport.findOne({ farmerId: userId })
            .sort({ createdAt: -1 })
            .lean();
        if (!report) {
            return {
                agent: 'SoilAgent',
                success: true,
                data: {},
                summary: 'No soil report found. Guide the farmer to upload a soil report on the Soil Health page.',
            };
        }
        const r = report;
        return {
            agent: 'SoilAgent',
            success: true,
            data: {
                soilType: r.soilType,
                healthScore: r.soilHealthScore,
                healthStatus: r.soilHealthStatus,
                ph: r.pH,
                nitrogen: r.nitrogen,
                phosphorus: r.phosphorus,
                potassium: r.potassium,
                organicCarbon: r.organicCarbon,
                deficiencies: r.deficiencies,
                organicRecommendations: r.recommendations?.organic,
                fertilizerRecommendations: r.recommendations?.fertilizer,
                reasoning: r.recommendations?.reasoning,
                cropRecommendations: r.cropRecommendations,
            },
            summary: `Soil: ${r.soilType || 'Unknown'}, Score: ${r.soilHealthScore}/100 (${r.soilHealthStatus}). pH: ${r.pH}. Deficiencies: ${(r.deficiencies || []).map((d) => d.nutrient).join(', ') || 'None detected'}.`,
        };
    }
    catch (err) {
        return {
            agent: 'SoilAgent',
            success: false,
            error: 'Soil health information is temporarily unavailable.',
        };
    }
}
//# sourceMappingURL=soilAgent.js.map