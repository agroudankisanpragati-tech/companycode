/**
 * Intent Router — Root Router
 *
 * Called immediately after detectIntentAsync(). Selects the correct agent for
 * the detected intent and returns a structured AgentRouteResult.
 *
 * Rules:
 * - greeting/navigation/voice_command → static response, NEVER touch KB or LLM
 * - disease/crop/soil/weather/market/government/kvk → dedicated agent only
 * - general → GeneralAgent (dispatchAgents + composeLocalResponse, optional LLM)
 * - LLM is NEVER called for any intent except general (and only as fallback)
 *
 * Fix 4: intent is detected ONCE upstream and passed in here.
 *        This router NEVER calls detectIntent() again.
 * Fix M2: KVK intent no longer runs SeedAgent (unrelated domain pairing removed).
 */

import { createLogger } from '../utils/logger';
import { IntentType } from '../services/intentEngine';
import { AgentContext, AgentResult } from './types';
import { runDiseaseAgent } from './diseaseAgent';
import { runCropAgent } from './cropAgent';
import { runSoilAgent } from './soilAgent';
import { runWeatherAgent } from './weatherAgent';
import { runMarketAgent } from './marketAgent';
import { runGovernmentAgent } from './governmentAgent';
import { runKVKAgent } from './kvkAgent';
import { runSeedAgent } from './seedAgent';
import { runFertilizerAgent } from './fertilizerAgent';
import { runFarmDiaryAgent } from './farmDiaryAgent';
import { runIrrigationAgent } from './irrigationAgent';
import { runEmergencyAgent } from './emergencyAgent';
import { runMachineryAgent } from './machineryAgent';
import { dispatchAgents } from './agentRouter';

const log = createLogger('intentRouter');

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteMode =
  | 'static'    // greeting/navigation/voice — return immediately, no KB, no LLM
  | 'agent'     // dedicated agent handles the intent
  | 'general';  // GeneralAgent: dispatchAgents + composeLocalResponse + optional LLM

export interface AgentRouteResult {
  mode:         RouteMode;
  intent:       IntentType;
  agentName:    string;
  agentResults: AgentResult[];
  staticReply?: { english: string; hindi: string; native: string };
  yoloUsed:     boolean;
  kbUsed:       boolean;
  executionMs:  number;
}

// ─── Static responses ─────────────────────────────────────────────────────────

const GREETING_RESPONSE = {
  english: '🙏 Namaste! I am Pragati AI, your agriculture assistant. How can I help you today?\n\nYou can ask me about:\n• 🌾 Crop recommendations\n• 🌿 Disease detection\n• 🌱 Soil health\n• 🌤️ Weather forecast\n• 📊 Mandi prices\n• 🏛️ Government schemes',
  hindi:   '🙏 नमस्ते! मैं प्रगति AI हूँ, आपका कृषि सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?\n\nआप मुझसे पूछ सकते हैं:\n• 🌾 फसल सिफारिश\n• 🌿 रोग पहचान\n• 🌱 मिट्टी स्वास्थ्य\n• 🌤️ मौसम पूर्वानुमान\n• 📊 मंडी भाव\n• 🏛️ सरकारी योजनाएं',
  native:  '🙏 नमस्ते! मैं प्रगति AI हूँ, आपका कृषि सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?\n\nआप मुझसे पूछ सकते हैं:\n• 🌾 फसल सिफारिश\n• 🌿 रोग पहचान\n• 🌱 मिट्टी स्वास्थ्य\n• 🌤️ मौसम पूर्वानुमान\n• 📊 मंडी भाव\n• 🏛️ सरकारी योजनाएं',
};

const NAVIGATION_RESPONSE = {
  english: '🧭 Here are the main sections of the platform:\n• 🌾 Crop Advisor → /crop-recommendation\n• 🌿 Disease Detection → /disease-detection\n• 🌱 Soil Health → /dashboard/farmer/soil-health\n• 🌤️ Weather → /weather\n• 📊 Market Prices → /dashboard/farmer/market\n• 🏛️ Government Schemes → /schemes\n• 🌾 My Crops → /dashboard/farmer/my-crops',
  hindi:   '🧭 प्लेटफॉर्म के मुख्य अनुभाग:\n• 🌾 फसल सलाहकार → /crop-recommendation\n• 🌿 रोग पहचान → /disease-detection\n• 🌱 मिट्टी स्वास्थ्य → /dashboard/farmer/soil-health\n• 🌤️ मौसम → /weather\n• 📊 मंडी भाव → /dashboard/farmer/market\n• 🏛️ सरकारी योजनाएं → /schemes\n• 🌾 मेरी फसलें → /dashboard/farmer/my-crops',
  native:  '🧭 प्लेटफॉर्म के मुख्य अनुभाग:\n• 🌾 फसल सलाहकार → /crop-recommendation\n• 🌿 रोग पहचान → /disease-detection\n• 🌱 मिट्टी स्वास्थ्य → /dashboard/farmer/soil-health\n• 🌤️ मौसम → /weather\n• 📊 मंडी भाव → /dashboard/farmer/market\n• 🏛️ सरकारी योजनाएं → /schemes\n• 🌾 मेरी फसलें → /dashboard/farmer/my-crops',
};

const VOICE_RESPONSE = {
  english: '🎙️ Voice command received. Please use the voice controls on the page.',
  hindi:   '🎙️ वॉयस कमांड प्राप्त हुई। कृपया पेज पर वॉयस नियंत्रण का उपयोग करें।',
  native:  '🎙️ वॉयस कमांड प्राप्त हुई। कृपया पेज पर वॉयस नियंत्रण का उपयोग करें।',
};

// ─── Dedicated agent runner ───────────────────────────────────────────────────

async function runDedicatedAgent(
  intent: IntentType,
  ctx:    AgentContext,
): Promise<{ agentName: string; results: AgentResult[]; yoloUsed: boolean; kbUsed: boolean }> {
  switch (intent) {
    case 'disease': {
      const result   = await runDiseaseAgent(ctx);
      const yoloUsed = !!(ctx.pageData?.diseaseResult);
      const kbUsed   = result.success && !!result.data && Object.keys(result.data).length > 0;
      return { agentName: 'DiseaseAgent', results: [result], yoloUsed, kbUsed };
    }
    case 'crop': {
      // SoilAgent and FertilizerAgent share ctx.shared.soilReport — no duplicate query
      const [crop, fert] = await Promise.all([runCropAgent(ctx), runFertilizerAgent(ctx)]);
      return { agentName: 'CropAgent', results: [crop, fert], yoloUsed: false, kbUsed: crop.success };
    }
    case 'soil': {
      // Both agents read ctx.shared.soilReport — no duplicate query (Fix 8)
      const [soil, fert] = await Promise.all([runSoilAgent(ctx), runFertilizerAgent(ctx)]);
      return { agentName: 'SoilAgent', results: [soil, fert], yoloUsed: false, kbUsed: soil.success };
    }
    case 'weather': {
      const result = await runWeatherAgent(ctx);
      return { agentName: 'WeatherAgent', results: [result], yoloUsed: false, kbUsed: result.success };
    }
    case 'market': {
      const result = await runMarketAgent(ctx);
      return { agentName: 'MarketAgent', results: [result], yoloUsed: false, kbUsed: result.success };
    }
    case 'government': {
      const result = await runGovernmentAgent(ctx);
      return { agentName: 'GovernmentAgent', results: [result], yoloUsed: false, kbUsed: result.success };
    }
    case 'kvk': {
      // Fix M2: removed unrelated SeedAgent pairing — KVK queries only run KVKAgent
      const result = await runKVKAgent(ctx);
      return { agentName: 'KVKAgent', results: [result], yoloUsed: false, kbUsed: result.success };
    }
    case 'irrigation': {
      const result = await runIrrigationAgent(ctx);
      const kbUsed = result.success && !!result.data && Object.keys(result.data).length > 0;
      return { agentName: 'IrrigationAgent', results: [result], yoloUsed: false, kbUsed };
    }
    case 'machinery': {
      const result = await runMachineryAgent(ctx);
      return { agentName: 'MachineryAgent', results: [result], yoloUsed: false, kbUsed: false };
    }
    case 'emergency': {
      const result = await runEmergencyAgent(ctx);
      return { agentName: 'EmergencyAgent', results: [result], yoloUsed: false, kbUsed: false };
    }
    default:
      return { agentName: 'GeneralAgent', results: [], yoloUsed: false, kbUsed: false };
  }
}

// ─── Root Router ──────────────────────────────────────────────────────────────

export async function routeIntent(
  intent: IntentType,
  ctx:    AgentContext,
): Promise<AgentRouteResult> {
  const start = Date.now();

  // ── Static intents — NEVER touch KB or LLM ──────────────────────────────
  if (intent === 'greeting') {
    log.info('Intent routed', { intent, agent: 'GreetingAgent', mode: 'static' });
    return {
      mode: 'static', intent,
      agentName: 'GreetingAgent', agentResults: [],
      staticReply: GREETING_RESPONSE,
      yoloUsed: false, kbUsed: false,
      executionMs: Date.now() - start,
    };
  }

  if (intent === 'navigation') {
    log.info('Intent routed', { intent, agent: 'NavigationAgent', mode: 'static' });
    return {
      mode: 'static', intent,
      agentName: 'NavigationAgent', agentResults: [],
      staticReply: NAVIGATION_RESPONSE,
      yoloUsed: false, kbUsed: false,
      executionMs: Date.now() - start,
    };
  }

  if (intent === 'voice_command') {
    log.info('Intent routed', { intent, agent: 'VoiceAgent', mode: 'static' });
    return {
      mode: 'static', intent,
      agentName: 'VoiceAgent', agentResults: [],
      staticReply: VOICE_RESPONSE,
      yoloUsed: false, kbUsed: false,
      executionMs: Date.now() - start,
    };
  }

  // ── General intent — GeneralAgent (KB + optional LLM) ───────────────────
  if (intent === 'general') {
    log.info('Intent routed', { intent, agent: 'GeneralAgent', mode: 'general' });
    let agentResults: AgentResult[] = [];
    try {
      // Fix 4: pass already-detected intent — dispatchAgents never re-detects
      agentResults = await dispatchAgents(intent, ctx);
    } catch (err: any) {
      log.warn('GeneralAgent dispatch error (non-fatal)', { error: err?.message });
    }
    return {
      mode: 'general', intent,
      agentName: 'GeneralAgent',
      agentResults,
      yoloUsed: false,
      kbUsed: agentResults.some(r => r.success && r.data && Object.keys(r.data).length > 0),
      executionMs: Date.now() - start,
    };
  }

  // ── Dedicated agent intents ──────────────────────────────────────────────
  let agentName    = 'UnknownAgent';
  let agentResults: AgentResult[] = [];
  let yoloUsed     = false;
  let kbUsed       = false;

  try {
    const routed = await runDedicatedAgent(intent, ctx);
    agentName    = routed.agentName;
    agentResults = routed.results;
    yoloUsed     = routed.yoloUsed;
    kbUsed       = routed.kbUsed;
  } catch (err: any) {
    log.warn('Dedicated agent error (non-fatal)', { intent, error: err?.message });
  }

  log.info('Intent routed', {
    intent, agent: agentName, mode: 'agent',
    yoloUsed, kbUsed, executionMs: Date.now() - start,
  });

  return {
    mode: 'agent', intent,
    agentName, agentResults,
    yoloUsed, kbUsed,
    executionMs: Date.now() - start,
  };
}
