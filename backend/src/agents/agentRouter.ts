/**
 * Agent Router — Phase 4
 *
 * Pragati AI uses this router internally to fetch domain-specific data
 * before composing its response. These are data-fetching modules, NOT
 * separate AIs. They are never exposed to the user.
 *
 * Routing is based on the IntentType already detected by intentEngine.ts.
 * Intent is detected EXACTLY ONCE in pragatiAIController and passed here.
 * This router NEVER calls detectIntent() — Fix 4.
 *
 * Failover: if one module fails, only that domain returns an error.
 * All other modules continue working normally.
 */

import { IntentType } from '../services/intentEngine';
import { AgentContext, AgentResult, AgentName } from './types';
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
import { createLogger } from '../utils/logger';

const log = createLogger('agentRouter');

/**
 * Maps intent types to the agent(s) that should handle them.
 * NOTE: greeting/navigation/voice_command are handled by intentRouter (static).
 * This map is only used by GeneralAgent (general intent) via dispatchAgents().
 */
const INTENT_TO_AGENTS: Record<IntentType, AgentName[]> = {
  greeting:      [],
  disease:       ['DiseaseAgent'],
  crop:          ['CropAgent'],
  soil:          ['SoilAgent', 'FertilizerAgent'],
  weather:       ['WeatherAgent'],
  market:        ['MarketAgent'],
  government:    ['GovernmentAgent'],
  kvk:           ['KVKAgent'],
  irrigation:    ['IrrigationAgent'],
  machinery:     ['MachineryAgent'],
  emergency:     ['EmergencyAgent'],
  navigation:    [],
  voice_command: [],
  // general: intentRouter dispatches all agents for cross-domain scan
  general:       ['WeatherAgent', 'SoilAgent', 'CropAgent', 'MarketAgent', 'GovernmentAgent', 'FarmDiaryAgent'],
};

/** Secondary routing for seed/fertilizer/diary helpers using shared context. */
function detectSecondaryAgents(intent: IntentType, ctx: AgentContext): AgentName[] {
  // Use pre-extracted entities and shared context only (Fix 2 / Fix 5)
  const entities = ctx.entities;
  const shared = ctx.shared;
  const agents: AgentName[] = [];

  if (entities) {
    if (entities.crop && (intent === 'general' || intent === 'crop')) agents.push('SeedAgent');
    if (entities.fertilizer || intent === 'soil' || intent === 'crop') agents.push('FertilizerAgent');
    if (shared?.activeCrops?.length || ctx.pageData?.farmDiaryData) agents.push('FarmDiaryAgent');
  }

  return agents;
}

/** Run a single agent with isolated error handling */
async function runAgent(name: AgentName, ctx: AgentContext): Promise<AgentResult> {
  try {
    switch (name) {
      case 'DiseaseAgent':    return await runDiseaseAgent(ctx);
      case 'CropAgent':       return await runCropAgent(ctx);
      case 'SoilAgent':       return await runSoilAgent(ctx);
      case 'WeatherAgent':    return await runWeatherAgent(ctx);
      case 'MarketAgent':     return await runMarketAgent(ctx);
      case 'GovernmentAgent': return await runGovernmentAgent(ctx);
      case 'KVKAgent':        return await runKVKAgent(ctx);
      case 'SeedAgent':       return await runSeedAgent(ctx);
      case 'FertilizerAgent':  return await runFertilizerAgent(ctx);
      case 'FarmDiaryAgent':   return await runFarmDiaryAgent(ctx);
      case 'IrrigationAgent':  return await runIrrigationAgent(ctx);
      case 'EmergencyAgent':   return await runEmergencyAgent(ctx);
      case 'MachineryAgent':   return await runMachineryAgent(ctx);
      default:
        return { agent: name, success: false, error: `Unknown agent: ${name}` };
    }
  } catch (err: any) {
    // Isolated failover — one agent failure does not affect others
    log.error(`${name} failed`, { error: err?.message });
    return {
      agent: name,
      success: false,
      error: `${name} is temporarily unavailable. Other features continue to work normally.`,
    };
  }
}

/**
 * Main dispatch function called by Pragati Root AI.
 *
 * IMPORTANT (Fix 4): intent is passed in — never re-detected here.
 * The intent was already detected once in pragatiAIController.
 *
 * @param intent  - Already-detected intent (do NOT call detectIntent again)
 * @param ctx     - Full agent context including pre-extracted entities
 */
export async function dispatchAgents(
  intent:  IntentType,
  ctx:     AgentContext,
): Promise<AgentResult[]> {
  // Determine which agents to run using the already-detected intent
  const primaryAgents = INTENT_TO_AGENTS[intent] || [];
  const secondaryAgents = detectSecondaryAgents(intent, ctx);

  // Deduplicate
  const agentSet = new Set<AgentName>([...primaryAgents, ...secondaryAgents]);

  // Also run FarmDiaryAgent for general/dashboard context if no specific agent matched
  if (agentSet.size === 0 && (intent === 'general' || !intent)) {
    agentSet.add('FarmDiaryAgent');
  }

  if (agentSet.size === 0) return [];

  log.debug('Dispatching agents', { intent, agents: Array.from(agentSet) });

  // Run all matched agents in parallel (isolated failover per agent)
  const results = await Promise.all(
    Array.from(agentSet).map(name => runAgent(name, ctx))
  );

  return results;
}

/**
 * Build a context block string from module results.
 * This is injected into Pragati AI's system prompt to enrich its response.
 */
export function buildAgentContextBlock(results: AgentResult[]): string {
  if (results.length === 0) return '';

  const lines: string[] = ['\n\nSPECIALIZED AGENT DATA (use this to answer the farmer accurately):'];

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
