"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMemoryContext = loadMemoryContext;
exports.writeMemoryTurn = writeMemoryTurn;
exports.updateLanguagePreference = updateLanguagePreference;
exports.updatePreferredTopics = updatePreferredTopics;
exports.buildMemoryContextBlock = buildMemoryContextBlock;
const FarmerMemory_1 = require("../models/FarmerMemory");
const UserSettings_1 = require("../models/UserSettings");
const languageDictionaryService_1 = require("./languageDictionaryService");
const aliasEngine_1 = require("./aliasEngine");
// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_HISTORY_TURNS = 100;
const CONTEXT_WINDOW = 10; // turns to inject into AI prompt
const MAX_FAQ_ENTRIES = 50; // cap FAQ list per farmer
// ─── Read memory ──────────────────────────────────────────────────────────────
/**
 * Load farmer memory context for injection into Pragati AI's prompt.
 * Returns safe defaults if no memory exists yet.
 */
async function loadMemoryContext(userId) {
    try {
        const memory = await FarmerMemory_1.FarmerMemory.findOne({ userId }).lean();
        if (!memory) {
            // Bootstrap preferences from UserSettings if available
            const settings = await UserSettings_1.UserSettings.findOne({ userId }).lean();
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
    }
    catch (err) {
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
async function writeMemoryTurn(input) {
    try {
        const { userId, userMessage, assistantReply, pageContext, agentUsed, langCode, refs, } = input;
        const userTurn = {
            role: 'user',
            content: userMessage.slice(0, 500), // cap length
            timestamp: new Date(),
            pageContext,
            langCode,
        };
        const assistantTurn = {
            role: 'assistant',
            content: assistantReply.slice(0, 1000),
            timestamp: new Date(),
            pageContext,
            agentUsed,
            langCode,
        };
        // Build $push with slice to enforce 100-turn cap
        const historyPush = {
            $each: [userTurn, assistantTurn],
            $slice: -MAX_HISTORY_TURNS,
        };
        // Build ref arrays to append (deduplicated via $addToSet)
        const refUpdates = {};
        if (refs?.cropAdvisoryId)
            refUpdates.cropAdvisoryRefs = refs.cropAdvisoryId;
        if (refs?.diseaseId)
            refUpdates.diseaseHistoryRefs = refs.diseaseId;
        if (refs?.soilReportId)
            refUpdates.soilReportRefs = refs.soilReportId;
        if (refs?.cropId)
            refUpdates.cropHistoryRefs = refs.cropId;
        const addToSetOps = {};
        for (const [field, val] of Object.entries(refUpdates)) {
            addToSetOps[field] = val;
        }
        // Update FAQ
        await updateFAQ(userId, userMessage, pageContext);
        // Update preferences if langCode provided
        const prefUpdate = {
            'preferences.lastActivePageContext': pageContext,
        };
        if (langCode)
            prefUpdate['preferences.selectedLang'] = langCode;
        // Upsert the memory document
        await FarmerMemory_1.FarmerMemory.updateOne({ userId }, {
            $push: { conversationHistory: historyPush },
            $inc: { totalInteractions: 1 },
            $set: { ...prefUpdate, lastInteractionAt: new Date() },
            ...(Object.keys(addToSetOps).length > 0 ? { $addToSet: addToSetOps } : {}),
        }, { upsert: true });
        // Run alias engine on unknown words (non-blocking, best-effort)
        runAliasEngineAsync(userMessage, pageContext, langCode);
    }
    catch (err) {
        console.error('[MemoryEngine] writeMemoryTurn error (non-fatal):', err?.message);
    }
}
// ─── Preference update ────────────────────────────────────────────────────────
/**
 * Update farmer language/dialect preference in memory.
 * Called when user changes language in the UI.
 */
async function updateLanguagePreference(userId, langCode, dialectCode) {
    try {
        await FarmerMemory_1.FarmerMemory.updateOne({ userId }, {
            $set: {
                'preferences.selectedLang': langCode,
                ...(dialectCode ? { 'preferences.selectedDialect': dialectCode } : {}),
            },
        }, { upsert: true });
    }
    catch (err) {
        console.error('[MemoryEngine] updateLanguagePreference error (non-fatal):', err?.message);
    }
}
/**
 * Update preferred topics based on which agents were used.
 */
async function updatePreferredTopics(userId, agentDomain) {
    try {
        await FarmerMemory_1.FarmerMemory.updateOne({ userId }, { $addToSet: { 'preferences.preferredTopics': agentDomain } }, { upsert: true });
    }
    catch {
        // Non-fatal
    }
}
// ─── FAQ tracking ─────────────────────────────────────────────────────────────
async function updateFAQ(userId, question, agentDomain) {
    const nKey = (0, languageDictionaryService_1.normalizeKey)(question.slice(0, 100));
    if (!nKey || nKey.length < 5)
        return;
    // Try to increment existing FAQ entry
    const result = await FarmerMemory_1.FarmerMemory.updateOne({ userId, 'faqEntries.normalizedKey': nKey }, {
        $inc: { 'faqEntries.$.askedCount': 1 },
        $set: { 'faqEntries.$.lastAskedAt': new Date() },
    });
    if (result.modifiedCount === 0) {
        // New FAQ entry — push with cap
        const newEntry = {
            question: question.slice(0, 200),
            normalizedKey: nKey,
            askedCount: 1,
            lastAskedAt: new Date(),
            agentDomain,
        };
        await FarmerMemory_1.FarmerMemory.updateOne({ userId }, {
            $push: {
                faqEntries: {
                    $each: [newEntry],
                    $slice: -MAX_FAQ_ENTRIES,
                    $sort: { askedCount: -1 },
                },
            },
        }, { upsert: true });
    }
}
// ─── Alias engine (async, non-blocking) ──────────────────────────────────────
function runAliasEngineAsync(message, pageContext, langCode) {
    // Fire and forget — never blocks the response
    setImmediate(async () => {
        try {
            const candidates = (0, aliasEngine_1.extractCandidateWords)(message);
            if (candidates.length === 0)
                return;
            await (0, aliasEngine_1.processBatchUnknownWords)(candidates, pageContext, langCode);
        }
        catch {
            // Completely silent — alias engine failure must never surface
        }
    });
}
// ─── Context block builder ────────────────────────────────────────────────────
/**
 * Build a memory context string for injection into Pragati AI's system prompt.
 * Keeps it compact to avoid bloating the prompt.
 */
function buildMemoryContextBlock(ctx) {
    if (ctx.totalInteractions === 0 && ctx.recentHistory.length === 0)
        return '';
    const lines = ['\n\nFARMER MEMORY CONTEXT:'];
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
//# sourceMappingURL=memoryEngine.js.map