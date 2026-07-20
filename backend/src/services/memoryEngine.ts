/**
 * Shared Memory Engine — Phase 5
 *
 * One shared memory service used by Pragati AI and every internal module.
 * Reads and writes to FarmerMemory (MongoDB) per farmer.
 *
 * Architecture:
 *   User → Language Engine → Pragati AI → Internal Modules
 *        → Shared Memory Engine → Language Engine → User
 *
 * Responsibilities:
 * 1. Store/retrieve conversation history (capped at 100 turns)
 * 2. Store/retrieve farmer preferences (lang, dialect, topics)
 * 3. Track domain history references (crop, disease, soil, advisory)
 * 4. Track frequently asked questions
 * 5. Run alias engine on unknown words after each turn
 * 6. Build memory context block for Pragati AI's system prompt
 *
 * Rules:
 * - Never retrain AI automatically
 * - Never auto-approve dictionary words
 * - Never modify existing workflows
 * - Failures are non-fatal (memory is enhancement, not core)
 */

import { FarmerMemory, IConversationTurn, IFAQEntry } from '../models/FarmerMemory';
import { UserSettings } from '../models/UserSettings';
import { FarmerProfileData } from '../models/FarmerProfileData';
import { normalizeKey } from './languageDictionaryService';
import { extractCandidateWords, processBatchUnknownWords } from './aliasEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryWriteInput {
  userId: string;
  userMessage: string;
  assistantReply: string;
  pageContext?: string;
  agentUsed?: string;
  langCode?: string;
  /** Domain refs to append */
  refs?: {
    cropAdvisoryId?: string;
    diseaseId?: string;
    soilReportId?: string;
    cropId?: string;
  };
}

export interface MemoryContext {
  /** Last N conversation turns for context injection */
  recentHistory: IConversationTurn[];
  /** Farmer's language and dialect preferences */
  preferences: {
    selectedLang: string;
    selectedDialect?: string;
    voiceEnabled: boolean;
    preferredTopics: string[];
  };
  /** Top 5 most asked questions */
  topFAQs: IFAQEntry[];
  /** Summary stats */
  totalInteractions: number;
  lastActivePageContext?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY_TURNS = 100;
const CONTEXT_WINDOW = 10;       // turns to inject into AI prompt
const MAX_FAQ_ENTRIES = 50;      // cap FAQ list per farmer

// ─── Read memory ──────────────────────────────────────────────────────────────

/**
 * Load farmer memory context for injection into Pragati AI's prompt.
 * Returns safe defaults if no memory exists yet.
 */
export async function loadMemoryContext(userId: string): Promise<MemoryContext> {
  try {
    const memory = await FarmerMemory.findOne({ userId }).lean();

    if (!memory) {
      // Bootstrap preferences from UserSettings if available
      const settings = await UserSettings.findOne({ userId }).lean();
      return {
        recentHistory: [],
        preferences: {
          selectedLang: settings?.appLanguage?.toLowerCase().slice(0, 2) || 'hi',
          selectedDialect: undefined,
          voiceEnabled: settings?.voiceResponses ?? false,
          preferredTopics: [],
        },
        topFAQs: [],
        totalInteractions: 0,
      };
    }

    const recentHistory = (memory.conversationHistory || [])
      .slice(-CONTEXT_WINDOW);

    const topFAQs = [...(memory.faqEntries || [])]
      .sort((a, b) => b.askedCount - a.askedCount)
      .slice(0, 5);

    return {
      recentHistory,
      preferences: {
        selectedLang: memory.preferences?.selectedLang || 'hi',
        selectedDialect: memory.preferences?.selectedDialect,
        voiceEnabled: memory.preferences?.voiceEnabled ?? false,
        preferredTopics: memory.preferences?.preferredTopics || [],
      },
      topFAQs,
      totalInteractions: memory.totalInteractions || 0,
      lastActivePageContext: memory.preferences?.lastActivePageContext,
    };
  } catch (err: any) {
    console.error('[MemoryEngine] loadMemoryContext error (non-fatal):', err?.message);
    return {
      recentHistory: [],
      preferences: { selectedLang: 'hi', voiceEnabled: false, preferredTopics: [] },
      topFAQs: [],
      totalInteractions: 0,
    };
  }
}

// ─── Write memory ─────────────────────────────────────────────────────────────

/**
 * Persist a conversation turn and update all memory fields.
 * Called AFTER the AI response is sent to the user.
 * Non-blocking — errors are logged but never thrown.
 */
export async function writeMemoryTurn(input: MemoryWriteInput): Promise<void> {
  try {
    const {
      userId, userMessage, assistantReply,
      pageContext, agentUsed, langCode, refs,
    } = input;

    const userTurn: IConversationTurn = {
      role: 'user',
      content: userMessage.slice(0, 500), // cap length
      timestamp: new Date(),
      pageContext,
      langCode,
    };

    const assistantTurn: IConversationTurn = {
      role: 'assistant',
      content: assistantReply.slice(0, 1000),
      timestamp: new Date(),
      pageContext,
      agentUsed,
      langCode,
    };

    // Build $push with slice to enforce 100-turn cap
    const historyPush: any = {
      $each: [userTurn, assistantTurn],
      $slice: -MAX_HISTORY_TURNS,
    };

    // Build ref arrays to append (deduplicated via $addToSet)
    const refUpdates: Record<string, any> = {};
    if (refs?.cropAdvisoryId) refUpdates.cropAdvisoryRefs = refs.cropAdvisoryId;
    if (refs?.diseaseId)      refUpdates.diseaseHistoryRefs = refs.diseaseId;
    if (refs?.soilReportId)   refUpdates.soilReportRefs = refs.soilReportId;
    if (refs?.cropId)         refUpdates.cropHistoryRefs = refs.cropId;

    const addToSetOps: Record<string, any> = {};
    for (const [field, val] of Object.entries(refUpdates)) {
      addToSetOps[field] = val;
    }

    // Update FAQ
    await updateFAQ(userId, userMessage, pageContext);

    // Update preferences if langCode provided
    const prefUpdate: Record<string, any> = {
      'preferences.lastActivePageContext': pageContext,
    };
    if (langCode) prefUpdate['preferences.selectedLang'] = langCode;

    // Upsert the memory document
    await FarmerMemory.updateOne(
      { userId },
      {
        $push: { conversationHistory: historyPush },
        $inc: { totalInteractions: 1 },
        $set: { ...prefUpdate, lastInteractionAt: new Date() },
        ...(Object.keys(addToSetOps).length > 0 ? { $addToSet: addToSetOps } : {}),
      },
      { upsert: true }
    );

    // Run alias engine on unknown words (non-blocking, best-effort)
    runAliasEngineAsync(userMessage, pageContext, langCode);

  } catch (err: any) {
    console.error('[MemoryEngine] writeMemoryTurn error (non-fatal):', err?.message);
  }
}

// ─── Preference update ────────────────────────────────────────────────────────

/**
 * Update farmer language/dialect preference in memory.
 * Called when user changes language in the UI.
 */
export async function updateLanguagePreference(
  userId: string,
  langCode: string,
  dialectCode?: string
): Promise<void> {
  try {
    await FarmerMemory.updateOne(
      { userId },
      {
        $set: {
          'preferences.selectedLang': langCode,
          ...(dialectCode ? { 'preferences.selectedDialect': dialectCode } : {}),
        },
      },
      { upsert: true }
    );
  } catch (err: any) {
    console.error('[MemoryEngine] updateLanguagePreference error (non-fatal):', err?.message);
  }
}

/**
 * Update preferred topics based on which agents were used.
 */
export async function updatePreferredTopics(
  userId: string,
  agentDomain: string
): Promise<void> {
  try {
    await FarmerMemory.updateOne(
      { userId },
      { $addToSet: { 'preferences.preferredTopics': agentDomain } },
      { upsert: true }
    );
  } catch {
    // Non-fatal
  }
}

// ─── FAQ tracking ─────────────────────────────────────────────────────────────

async function updateFAQ(
  userId: string,
  question: string,
  agentDomain?: string
): Promise<void> {
  const nKey = normalizeKey(question.slice(0, 100));
  if (!nKey || nKey.length < 5) return;

  // Try to increment existing FAQ entry
  const result = await FarmerMemory.updateOne(
    { userId, 'faqEntries.normalizedKey': nKey },
    {
      $inc: { 'faqEntries.$.askedCount': 1 },
      $set: { 'faqEntries.$.lastAskedAt': new Date() },
    }
  );

  if (result.modifiedCount === 0) {
    // New FAQ entry — push with cap
    const newEntry: IFAQEntry = {
      question: question.slice(0, 200),
      normalizedKey: nKey,
      askedCount: 1,
      lastAskedAt: new Date(),
      agentDomain,
    };

    await FarmerMemory.updateOne(
      { userId },
      {
        $push: {
          faqEntries: {
            $each: [newEntry],
            $slice: -MAX_FAQ_ENTRIES,
            $sort: { askedCount: -1 },
          },
        },
      },
      { upsert: true }
    );
  }
}

// ─── Alias engine (async, non-blocking) ──────────────────────────────────────

function runAliasEngineAsync(
  message: string,
  pageContext?: string,
  langCode?: string
): void {
  // Fire and forget — never blocks the response
  setImmediate(async () => {
    try {
      const candidates = extractCandidateWords(message);
      if (candidates.length === 0) return;
      await processBatchUnknownWords(candidates, pageContext, langCode);
    } catch {
      // Completely silent — alias engine failure must never surface
    }
  });
}

// ─── Context block builder ────────────────────────────────────────────────────

/**
 * Build a memory context string for injection into Pragati AI's system prompt.
 * Keeps it compact to avoid bloating the prompt.
 */
export function buildMemoryContextBlock(ctx: MemoryContext): string {
  if (ctx.totalInteractions === 0 && ctx.recentHistory.length === 0) return '';

  const lines: string[] = ['\n\nFARMER MEMORY CONTEXT:'];

  lines.push(`Total interactions: ${ctx.totalInteractions}`);
  lines.push(`Preferred language: ${ctx.preferences.selectedLang}${ctx.preferences.selectedDialect ? ` (dialect: ${ctx.preferences.selectedDialect})` : ''}`);

  if (ctx.preferences.preferredTopics.length > 0) {
    lines.push(`Frequently interested in: ${ctx.preferences.preferredTopics.slice(0, 5).join(', ')}`);
  }

  if (ctx.topFAQs.length > 0) {
    lines.push(`Top questions asked: ${ctx.topFAQs.slice(0, 3).map(f => f.question.slice(0, 60)).join(' | ')}`);
  }

  if (ctx.recentHistory.length > 0) {
    lines.push('Recent conversation (last turns):');
    for (const turn of ctx.recentHistory.slice(-6)) {
      const prefix = turn.role === 'user' ? 'Farmer' : 'Pragati AI';
      lines.push(`  ${prefix}: ${turn.content.slice(0, 120)}`);
    }
  }

  lines.push('Use this memory to personalize your response. Do not repeat information the farmer already knows.');

  return lines.join('\n');
}
