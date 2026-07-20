"use strict";
/**
 * Agent Router — Phase 4
 *
 * Pragati AI uses this router internally to fetch domain-specific data
 * before composing its response. These are data-fetching modules, NOT
 * separate AIs. They are never exposed to the user.
 *
 * Routing is based on the IntentType already detected by intentEngine.ts.
 * No new routes or APIs are created — this is a pure internal service.
 *
 * Failover: if one module fails, only that domain returns an error.
 * All other modules continue working normally.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchAgents = dispatchAgents;
exports.buildAgentContextBlock = buildAgentContextBlock;
const intentEngine_1 = require("../services/intentEngine");
const diseaseAgent_1 = require("./diseaseAgent");
const cropAgent_1 = require("./cropAgent");
const soilAgent_1 = require("./soilAgent");
const weatherAgent_1 = require("./weatherAgent");
const marketAgent_1 = require("./marketAgent");
const governmentAgent_1 = require("./governmentAgent");
const kvkAgent_1 = require("./kvkAgent");
const seedAgent_1 = require("./seedAgent");
const fertilizerAgent_1 = require("./fertilizerAgent");
const farmDiaryAgent_1 = require("./farmDiaryAgent");
const irrigationAgent_1 = require("./irrigationAgent");
const emergencyAgent_1 = require("./emergencyAgent");
const machineryAgent_1 = require("./machineryAgent");
/**
 * Maps intent types to the agent(s) that should handle them.
 * NOTE: greeting/navigation/voice_command are handled by intentRouter (static).
 * This map is only used by GeneralAgent (general intent) via dispatchAgents().
 */
const INTENT_TO_AGENTS = {
    greeting: [],
    disease: ['DiseaseAgent'],
    crop: ['CropAgent'],
    soil: ['SoilAgent', 'FertilizerAgent'],
    weather: ['WeatherAgent'],
    market: ['MarketAgent'],
    government: ['GovernmentAgent'],
    kvk: ['KVKAgent'],
    irrigation: ['IrrigationAgent'],
    machinery: ['MachineryAgent'],
    emergency: ['EmergencyAgent'],
    navigation: [],
    voice_command: [],
    // general: intentRouter dispatches all agents for cross-domain scan
    general: ['WeatherAgent', 'SoilAgent', 'CropAgent', 'MarketAgent', 'GovernmentAgent', 'FarmDiaryAgent'],
};
/** Keyword-based secondary routing for seed/fertilizer queries */
function detectSecondaryAgents(message) {
    const lower = message.toLowerCase();
    const agents = [];
    if (/seed|beej|variety|kism|nursery/i.test(lower))
        agents.push('SeedAgent');
    if (/fertilizer|khad|urea|dap|npk|compost|vermicompost/i.test(lower))
        agents.push('FertilizerAgent');
    if (/diary|task|schedule|aaj ka kaam|today.*task|farm.*log/i.test(lower))
        agents.push('FarmDiaryAgent');
    return agents;
}
/** Run a single agent with isolated error handling */
async function runAgent(name, ctx) {
    try {
        switch (name) {
            case 'DiseaseAgent': return await (0, diseaseAgent_1.runDiseaseAgent)(ctx);
            case 'CropAgent': return await (0, cropAgent_1.runCropAgent)(ctx);
            case 'SoilAgent': return await (0, soilAgent_1.runSoilAgent)(ctx);
            case 'WeatherAgent': return await (0, weatherAgent_1.runWeatherAgent)(ctx);
            case 'MarketAgent': return await (0, marketAgent_1.runMarketAgent)(ctx);
            case 'GovernmentAgent': return await (0, governmentAgent_1.runGovernmentAgent)(ctx);
            case 'KVKAgent': return await (0, kvkAgent_1.runKVKAgent)(ctx);
            case 'SeedAgent': return await (0, seedAgent_1.runSeedAgent)(ctx);
            case 'FertilizerAgent': return await (0, fertilizerAgent_1.runFertilizerAgent)(ctx);
            case 'FarmDiaryAgent': return await (0, farmDiaryAgent_1.runFarmDiaryAgent)(ctx);
            case 'IrrigationAgent': return await (0, irrigationAgent_1.runIrrigationAgent)(ctx);
            case 'EmergencyAgent': return await (0, emergencyAgent_1.runEmergencyAgent)(ctx);
            case 'MachineryAgent': return await (0, machineryAgent_1.runMachineryAgent)(ctx);
            default:
                return { agent: name, success: false, error: `Unknown agent: ${name}` };
        }
    }
    catch (err) {
        // Isolated failover — one agent failure does not affect others
        console.error(`[AgentRouter] ${name} failed:`, err?.message);
        return {
            agent: name,
            success: false,
            error: `${name} is temporarily unavailable. Other features continue to work normally.`,
        };
    }
}
/**
 * Main dispatch function called by Pragati Root AI.
 * Returns an array of agent results to be injected into the AI context.
 */
async function dispatchAgents(message, ctx) {
    const intent = (0, intentEngine_1.detectIntent)(message);
    const fullCtx = { ...ctx, message };
    // Determine which agents to run
    const primaryAgents = INTENT_TO_AGENTS[intent] || [];
    const secondaryAgents = detectSecondaryAgents(message);
    // Deduplicate
    const agentSet = new Set([...primaryAgents, ...secondaryAgents]);
    // Also run FarmDiaryAgent for general/dashboard context if no specific agent matched
    if (agentSet.size === 0 && (intent === 'general' || !intent)) {
        agentSet.add('FarmDiaryAgent');
    }
    if (agentSet.size === 0)
        return [];
    // Run all matched agents in parallel (isolated failover per agent)
    const results = await Promise.all(Array.from(agentSet).map(name => runAgent(name, fullCtx)));
    return results;
}
/**
 * Build a context block string from module results.
 * This is injected into Pragati AI's system prompt to enrich its response.
 */
function buildAgentContextBlock(results) {
    if (results.length === 0)
        return '';
    const lines = ['\n\nSPECIALIZED AGENT DATA (use this to answer the farmer accurately):'];
    for (const result of results) {
        if (!result.success) {
            lines.push(`\n[${result.agent}] ⚠️ ${result.error}`);
            continue;
        }
        if (result.summary) {
            lines.push(`\n[${result.agent}] ${result.summary}`);
        }
        if (result.data && Object.keys(result.data).length > 0) {
            // Serialize key data fields compactly
            const compact = JSON.stringify(result.data, null, 0);
            if (compact.length < 1500) {
                lines.push(`Data: ${compact}`);
            }
        }
    }
    lines.push('\nUse the above agent data to give the farmer a precise, data-driven answer. Do not fabricate data not present above.');
    return lines.join('\n');
}
//# sourceMappingURL=agentRouter.js.map