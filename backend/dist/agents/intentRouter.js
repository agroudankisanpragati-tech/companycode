"use strict";
/**
 * Intent Router — Root Router
 *
 * Called immediately after detectIntent(). Selects the correct agent for
 * the detected intent and returns a structured AgentRouteResult.
 *
 * Rules:
 * - greeting/navigation/voice_command → static response, NEVER touch KB or LLM
 * - disease/crop/soil/weather/market/government/kvk → dedicated agent only
 * - general → GeneralAgent (dispatchAgents + composeLocalResponse, optional LLM)
 * - LLM is NEVER called for any intent except general (and only as fallback)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeIntent = routeIntent;
const logger_1 = require("../utils/logger");
const diseaseAgent_1 = require("./diseaseAgent");
const cropAgent_1 = require("./cropAgent");
const soilAgent_1 = require("./soilAgent");
const weatherAgent_1 = require("./weatherAgent");
const marketAgent_1 = require("./marketAgent");
const governmentAgent_1 = require("./governmentAgent");
const kvkAgent_1 = require("./kvkAgent");
const seedAgent_1 = require("./seedAgent");
const fertilizerAgent_1 = require("./fertilizerAgent");
const irrigationAgent_1 = require("./irrigationAgent");
const emergencyAgent_1 = require("./emergencyAgent");
const machineryAgent_1 = require("./machineryAgent");
const agentRouter_1 = require("./agentRouter");
const log = (0, logger_1.createLogger)('intentRouter');
// ─── Static greeting responses ────────────────────────────────────────────────
const GREETING_RESPONSE = {
    english: '🙏 Namaste! I am Pragati AI, your agriculture assistant. How can I help you today?\n\nYou can ask me about:\n• 🌾 Crop recommendations\n• 🌿 Disease detection\n• 🌱 Soil health\n• 🌤️ Weather forecast\n• 📊 Mandi prices\n• 🏛️ Government schemes',
    hindi: '🙏 नमस्ते! मैं प्रगति AI हूँ, आपका कृषि सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?\n\nआप मुझसे पूछ सकते हैं:\n• 🌾 फसल सिफारिश\n• 🌿 रोग पहचान\n• 🌱 मिट्टी स्वास्थ्य\n• 🌤️ मौसम पूर्वानुमान\n• 📊 मंडी भाव\n• 🏛️ सरकारी योजनाएं',
    native: '🙏 नमस्ते! मैं प्रगति AI हूँ, आपका कृषि सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?\n\nआप मुझसे पूछ सकते हैं:\n• 🌾 फसल सिफारिश\n• 🌿 रोग पहचान\n• 🌱 मिट्टी स्वास्थ्य\n• 🌤️ मौसम पूर्वानुमान\n• 📊 मंडी भाव\n• 🏛️ सरकारी योजनाएं',
};
const NAVIGATION_RESPONSE = {
    english: '🧭 Here are the main sections of the platform:\n• 🌾 Crop Advisor → /crop-recommendation\n• 🌿 Disease Detection → /disease-detection\n• 🌱 Soil Health → /dashboard/farmer/soil-health\n• 🌤️ Weather → /weather\n• 📊 Market Prices → /dashboard/farmer/market\n• 🏛️ Government Schemes → /schemes\n• 🌾 My Crops → /dashboard/farmer/my-crops',
    hindi: '🧭 प्लेटफॉर्म के मुख्य अनुभाग:\n• 🌾 फसल सलाहकार → /crop-recommendation\n• 🌿 रोग पहचान → /disease-detection\n• 🌱 मिट्टी स्वास्थ्य → /dashboard/farmer/soil-health\n• 🌤️ मौसम → /weather\n• 📊 मंडी भाव → /dashboard/farmer/market\n• 🏛️ सरकारी योजनाएं → /schemes\n• 🌾 मेरी फसलें → /dashboard/farmer/my-crops',
    native: '🧭 प्लेटफॉर्म के मुख्य अनुभाग:\n• 🌾 फसल सलाहकार → /crop-recommendation\n• 🌿 रोग पहचान → /disease-detection\n• 🌱 मिट्टी स्वास्थ्य → /dashboard/farmer/soil-health\n• 🌤️ मौसम → /weather\n• 📊 मंडी भाव → /dashboard/farmer/market\n• 🏛️ सरकारी योजनाएं → /schemes\n• 🌾 मेरी फसलें → /dashboard/farmer/my-crops',
};
const VOICE_RESPONSE = {
    english: '🎙️ Voice command received. Please use the voice controls on the page.',
    hindi: '🎙️ वॉयस कमांड प्राप्त हुई। कृपया पेज पर वॉयस नियंत्रण का उपयोग करें।',
    native: '🎙️ वॉयस कमांड प्राप्त हुई। कृपया पेज पर वॉयस नियंत्रण का उपयोग करें।',
};
// ─── Intent → Agent mapping ───────────────────────────────────────────────────
async function runDedicatedAgent(intent, ctx) {
    switch (intent) {
        case 'disease': {
            const result = await (0, diseaseAgent_1.runDiseaseAgent)(ctx);
            const yoloUsed = !!(ctx.pageData?.diseaseResult);
            const kbUsed = result.success && !!result.data && Object.keys(result.data).length > 0;
            return { agentName: 'DiseaseAgent', results: [result], yoloUsed, kbUsed };
        }
        case 'crop': {
            const [crop, fert] = await Promise.all([(0, cropAgent_1.runCropAgent)(ctx), (0, fertilizerAgent_1.runFertilizerAgent)(ctx)]);
            return { agentName: 'CropAgent', results: [crop, fert], yoloUsed: false, kbUsed: crop.success };
        }
        case 'soil': {
            const [soil, fert] = await Promise.all([(0, soilAgent_1.runSoilAgent)(ctx), (0, fertilizerAgent_1.runFertilizerAgent)(ctx)]);
            return { agentName: 'SoilAgent', results: [soil, fert], yoloUsed: false, kbUsed: soil.success };
        }
        case 'weather': {
            const result = await (0, weatherAgent_1.runWeatherAgent)(ctx);
            return { agentName: 'WeatherAgent', results: [result], yoloUsed: false, kbUsed: result.success };
        }
        case 'market': {
            const result = await (0, marketAgent_1.runMarketAgent)(ctx);
            return { agentName: 'MarketAgent', results: [result], yoloUsed: false, kbUsed: result.success };
        }
        case 'government': {
            const result = await (0, governmentAgent_1.runGovernmentAgent)(ctx);
            return { agentName: 'GovernmentAgent', results: [result], yoloUsed: false, kbUsed: result.success };
        }
        case 'kvk': {
            const [kvk, seed] = await Promise.all([(0, kvkAgent_1.runKVKAgent)(ctx), (0, seedAgent_1.runSeedAgent)(ctx)]);
            return { agentName: 'KVKAgent', results: [kvk, seed], yoloUsed: false, kbUsed: kvk.success };
        }
        case 'irrigation': {
            const result = await (0, irrigationAgent_1.runIrrigationAgent)(ctx);
            return { agentName: 'IrrigationAgent', results: [result], yoloUsed: false, kbUsed: result.success && !!result.data && Object.keys(result.data).length > 0 };
        }
        case 'machinery': {
            const result = await (0, machineryAgent_1.runMachineryAgent)(ctx);
            return { agentName: 'MachineryAgent', results: [result], yoloUsed: false, kbUsed: false };
        }
        case 'emergency': {
            const result = await (0, emergencyAgent_1.runEmergencyAgent)(ctx);
            return { agentName: 'EmergencyAgent', results: [result], yoloUsed: false, kbUsed: false };
        }
        default:
            return { agentName: 'GeneralAgent', results: [], yoloUsed: false, kbUsed: false };
    }
}
// ─── Root Router ──────────────────────────────────────────────────────────────
async function routeIntent(intent, ctx) {
    const start = Date.now();
    // ── Static intents — NEVER touch KB or LLM ───────────────────────────────
    if (intent === 'greeting') {
        log.info('Intent routed', { intent, agent: 'GreetingAgent', mode: 'static' });
        return {
            mode: 'static',
            intent,
            agentName: 'GreetingAgent',
            agentResults: [],
            staticReply: GREETING_RESPONSE,
            yoloUsed: false,
            kbUsed: false,
            executionMs: Date.now() - start,
        };
    }
    if (intent === 'navigation') {
        log.info('Intent routed', { intent, agent: 'NavigationAgent', mode: 'static' });
        return {
            mode: 'static',
            intent,
            agentName: 'NavigationAgent',
            agentResults: [],
            staticReply: NAVIGATION_RESPONSE,
            yoloUsed: false,
            kbUsed: false,
            executionMs: Date.now() - start,
        };
    }
    if (intent === 'voice_command') {
        log.info('Intent routed', { intent, agent: 'VoiceAgent', mode: 'static' });
        return {
            mode: 'static',
            intent,
            agentName: 'VoiceAgent',
            agentResults: [],
            staticReply: VOICE_RESPONSE,
            yoloUsed: false,
            kbUsed: false,
            executionMs: Date.now() - start,
        };
    }
    // ── General intent — GeneralAgent (KB + optional LLM) ────────────────────
    if (intent === 'general') {
        log.info('Intent routed', { intent, agent: 'GeneralAgent', mode: 'general' });
        let agentResults = [];
        try {
            agentResults = await (0, agentRouter_1.dispatchAgents)(ctx.message, {
                userId: ctx.userId,
                farmerProfile: ctx.farmerProfile,
                pageData: ctx.pageData,
            });
        }
        catch (err) {
            log.warn('GeneralAgent dispatch error (non-fatal)', { error: err?.message });
        }
        return {
            mode: 'general',
            intent,
            agentName: 'GeneralAgent',
            agentResults,
            yoloUsed: false,
            kbUsed: agentResults.some(r => r.success && r.data && Object.keys(r.data).length > 0),
            executionMs: Date.now() - start,
        };
    }
    // ── Dedicated agent intents ───────────────────────────────────────────────
    let agentName = 'UnknownAgent';
    let agentResults = [];
    let yoloUsed = false;
    let kbUsed = false;
    try {
        const routed = await runDedicatedAgent(intent, ctx);
        agentName = routed.agentName;
        agentResults = routed.results;
        yoloUsed = routed.yoloUsed;
        kbUsed = routed.kbUsed;
    }
    catch (err) {
        log.warn('Dedicated agent error (non-fatal)', { intent, error: err?.message });
    }
    log.info('Intent routed', {
        intent,
        agent: agentName,
        mode: 'agent',
        yoloUsed,
        kbUsed,
        executionMs: Date.now() - start,
    });
    return {
        mode: 'agent',
        intent,
        agentName,
        agentResults,
        yoloUsed,
        kbUsed,
        executionMs: Date.now() - start,
    };
}
//# sourceMappingURL=intentRouter.js.map