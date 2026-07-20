"use strict";
/**
 * Government Agent
 * Domain: Government agriculture schemes, subsidies, eligibility
 * Data sources: GovtScheme MongoDB collection (via knowledgeBaseSearch)
 * Never communicates directly with the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGovernmentAgent = runGovernmentAgent;
const knowledgeBaseSearch_1 = require("../services/knowledgeBaseSearch");
async function runGovernmentAgent(ctx) {
    try {
        const { message, pageData, farmerProfile } = ctx;
        // If a scheme is already open on the page, use it
        if (pageData?.schemeData) {
            const s = pageData.schemeData;
            return {
                agent: 'GovernmentAgent',
                success: true,
                data: s,
                summary: `Scheme: ${s.title}. Benefits: ${(s.benefits || []).join(', ')}. Eligibility: ${s.eligibility || 'N/A'}.`,
            };
        }
        const keyword = extractSchemeKeyword(message);
        const state = farmerProfile?.state || '';
        const kbResult = await (0, knowledgeBaseSearch_1.searchSchemeKB)(keyword, state);
        if (kbResult.found) {
            return {
                agent: 'GovernmentAgent',
                success: true,
                data: kbResult.data,
                summary: kbResult.summary,
            };
        }
        return {
            agent: 'GovernmentAgent',
            success: true,
            data: {},
            summary: 'No matching government schemes found. Guide the farmer to the Schemes page to browse all available schemes.',
        };
    }
    catch (err) {
        return {
            agent: 'GovernmentAgent',
            success: false,
            error: 'Government scheme information is temporarily unavailable.',
        };
    }
}
function extractSchemeKeyword(msg) {
    const keywords = [
        'pm-kisan', 'pmkisan', 'kcc', 'kisan credit', 'pmfby', 'fasal bima',
        'soil health card', 'enam', 'subsidy', 'anudan', 'insurance', 'bima',
        'loan', 'rin', 'drip', 'irrigation', 'organic', 'jaivik',
    ];
    const lower = msg.toLowerCase();
    return keywords.find(k => lower.includes(k)) || '';
}
//# sourceMappingURL=governmentAgent.js.map