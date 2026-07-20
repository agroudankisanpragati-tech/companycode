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

import { detectIntent, IntentType } from '../services/intentEngine';
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

/** Keyword-based secondary routing for seed/fertilizer queries */
function detectSecondaryAgents(message: string): AgentName[] {
  const lower = message.toLowerCase();
  const agents: AgentName[] = [];
  if (/seed|beej|variety|kism|nursery/i.test(lower)) agents.push('SeedAgent');
  if (/fertilizer|khad|urea|dap|npk|compost|vermicompost/i.test(lower)) agents.push('FertilizerAgent');
  if (/diary|task|schedule|aaj ka kaam|today.*task|farm.*log/i.test(lower)) agents.push('FarmDiaryAgent');
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
export async function dispatchAgents(
  message: string,
  ctx: Omit<AgentContext, 'message'>
): Promise<AgentResult[]> {
  const intent = detectIntent(message);
  const fullCtx: AgentContext = { ...ctx, message };

  // Determine which agents to run
  const primaryAgents = INTENT_TO_AGENTS[intent] || [];
  const secondaryAgents = detectSecondaryAgents(message);

  // Deduplicate
  const agentSet = new Set<AgentName>([...primaryAgents, ...secondaryAgents]);

  // Also run FarmDiaryAgent for general/dashboard context if no specific agent matched
  if (agentSet.size === 0 && (intent === 'general' || !intent)) {
    agentSet.add('FarmDiaryAgent');
  }

  if (agentSet.size === 0) return [];

  // Run all matched agents in parallel (isolated failover per agent)
  const results = await Promise.all(
    Array.from(agentSet).map(name => runAgent(name, fullCtx))
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
