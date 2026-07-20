/**
 * Integration Bus — Final Enterprise Integration Layer
 *
 * Single shared service that wires together:
 *   Language Engine → Pragati AI → Specialized Modules → Shared Memory
 *
 * Pragati AI is the one and only AI. Internally it uses specialized modules
 * (crop, disease, soil, weather, market, etc.) to enrich its context before
 * calling the LLM. These modules are NOT separate AIs and are never exposed
 * to the user. The user always sees only "Pragati AI".
 *
 * Every AI request flows through here. No page or route needs to know
 * about the internal wiring. Business logic (YOLO, MongoDB, Disease,
 * Pest Solutions, existing APIs) is NEVER modified.
 *
 * Rules:
 * - All failures are non-fatal and logged.
 * - YOLO / MongoDB / existing routes are untouched.
 * - Future speech datasets plug in via voiceDatasetRegistry — zero logic change.
 * - Only Pragati AI is visible to the user.
 */

import { createLogger } from '../utils/logger';
import { loadMemoryContext, writeMemoryTurn, buildMemoryContextBlock } from './memoryEngine';
import { runSpeechTranslationPipeline, translateOutputForDisplay } from './speechTranslationPipeline';
import { dispatchAgents, buildAgentContextBlock } from '../agents/agentRouter';
import { detectIntent } from './intentEngine';
import { buildPageContextBlock, buildMismatchWarning, type PageData } from './contextEngine';
import { updateLanguagePreference, updatePreferredTopics } from './memoryEngine';

const log = createLogger('integrationBus');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusRequest {
  userId: string;
  rawMessage: string;
  langCode: string;
  pageContext?: string;
  pageData?: PageData;
  farmerProfile?: {
    name?: string;
    district?: string;
    state?: string;
    farmSize?: string;
    soilType?: string;
  };
}

export interface BusResult {
  /** Normalized English text sent to AI/DB/YOLO */
  englishForBackend: string;
  /** Full memory + agent context block for AI system prompt injection */
  contextBlock: string;
  /** Detected intent */
  intent: string;
  /** Whether the input term was found in the dictionary */
  foundInDictionary: boolean;
}

// ─── Main bus function ────────────────────────────────────────────────────────

/**
 * Process an incoming message through the full integration pipeline:
 *   1. Language Engine — normalize + translate input
 *   2. Shared Memory — load farmer context
 *   3. Intent detection + page context
 *   4. Specialized agent dispatch
 *   5. Build combined context block for Pragati AI's system prompt
 *
 * Called BEFORE the LLM call. Returns a context block to inject into the prompt.
 */
export async function processRequest(req: BusRequest): Promise<BusResult> {
  const { userId, rawMessage, langCode, pageContext, pageData, farmerProfile } = req;

  let contextBlock = '';
  let englishForBackend = rawMessage;
  let foundInDictionary = false;

  // ── Step 1: Language Engine — normalize input ─────────────────────────────
  try {
    const pipelineResult = await runSpeechTranslationPipeline({
      rawText: rawMessage,
      appLangCode: langCode,
      pageContext,
    });
    englishForBackend = pipelineResult.englishForBackend || rawMessage;
    foundInDictionary = pipelineResult.foundInDictionary;
    log.debug('Language pipeline complete', {
      lang: langCode,
      found: foundInDictionary,
      ctx: pageContext,
    });
  } catch (err: any) {
    log.warn('Language pipeline error (non-fatal)', { error: err?.message });
  }

  // ── Step 2: Shared Memory — load farmer context ───────────────────────────
  try {
    const memCtx = await loadMemoryContext(userId);
    contextBlock += buildMemoryContextBlock(memCtx);
  } catch (err: any) {
    log.warn('Memory load error (non-fatal)', { error: err?.message });
  }

  // ── Step 3: Intent + page context ────────────────────────────────────────
  const intent = detectIntent(englishForBackend);
  try {
    if (pageData?.pageContext) {
      contextBlock += buildPageContextBlock(pageData, englishForBackend);
      contextBlock += buildMismatchWarning(pageData.pageContext, intent);
    }
  } catch (err: any) {
    log.warn('Page context build error (non-fatal)', { error: err?.message });
  }

  // ── Step 4: Internal module dispatch (Pragati AI internal enrichment) ──────
  // These modules feed data into Pragati AI's context. They are NOT separate AIs.
  try {
    const agentResults = await dispatchAgents(englishForBackend, {
      userId,
      farmerProfile,
      pageData: pageData as any,
    });
    contextBlock += buildAgentContextBlock(agentResults);

    // Update preferred topics from agent usage
    for (const r of agentResults) {
      if (r.success && r.agent) {
        updatePreferredTopics(userId, r.agent).catch(() => {});
      }
    }
  } catch (err: any) {
    log.warn('Agent dispatch error (non-fatal)', { error: err?.message });
  }

  return { englishForBackend, contextBlock, intent, foundInDictionary };
}

// ─── Post-response: write memory + update preferences ────────────────────────

/**
 * Called AFTER Pragati AI sends its response to the user.
 * Writes memory turn and updates language preference.
 * Fire-and-forget — never blocks the response.
 */
export function postProcess(params: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  langCode: string;
  pageContext?: string;
  agentUsed?: string;
}): void {
  const { userId, userMessage, assistantReply, langCode, pageContext, agentUsed } = params;

  setImmediate(async () => {
    try {
      await writeMemoryTurn({
        userId,
        userMessage,
        assistantReply,
        pageContext,
        agentUsed,
        langCode,
      });
      await updateLanguagePreference(userId, langCode);
    } catch (err: any) {
      log.warn('Post-process error (non-fatal)', { error: err?.message });
    }
  });
}

// ─── Translate AI output for display ─────────────────────────────────────────

/**
 * Translate Pragati AI's English output to the user's display language.
 * English selected → return as-is.
 * Other language → return Hindi display + dialect voice text.
 */
export async function translateAIOutput(
  englishText: string,
  langCode: string
): Promise<{ displayText: string; voiceText: string }> {
  try {
    return await translateOutputForDisplay(englishText, langCode);
  } catch {
    return { displayText: englishText, voiceText: englishText };
  }
}
