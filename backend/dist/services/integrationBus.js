"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRequest = processRequest;
exports.postProcess = postProcess;
exports.translateAIOutput = translateAIOutput;
const logger_1 = require("../utils/logger");
const memoryEngine_1 = require("./memoryEngine");
const speechTranslationPipeline_1 = require("./speechTranslationPipeline");
const agentRouter_1 = require("../agents/agentRouter");
const intentEngine_1 = require("./intentEngine");
const contextEngine_1 = require("./contextEngine");
const memoryEngine_2 = require("./memoryEngine");
const log = (0, logger_1.createLogger)('integrationBus');
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
async function processRequest(req) {
    const { userId, rawMessage, langCode, pageContext, pageData, farmerProfile } = req;
    let contextBlock = '';
    let englishForBackend = rawMessage;
    let foundInDictionary = false;
    // ── Step 1: Language Engine — normalize input ─────────────────────────────
    try {
        const pipelineResult = await (0, speechTranslationPipeline_1.runSpeechTranslationPipeline)({
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
    }
    catch (err) {
        log.warn('Language pipeline error (non-fatal)', { error: err?.message });
    }
    // ── Step 2: Shared Memory — load farmer context ───────────────────────────
    try {
        const memCtx = await (0, memoryEngine_1.loadMemoryContext)(userId);
        contextBlock += (0, memoryEngine_1.buildMemoryContextBlock)(memCtx);
    }
    catch (err) {
        log.warn('Memory load error (non-fatal)', { error: err?.message });
    }
    // ── Step 3: Intent + page context ────────────────────────────────────────
    const intent = (0, intentEngine_1.detectIntent)(englishForBackend);
    try {
        if (pageData?.pageContext) {
            contextBlock += (0, contextEngine_1.buildPageContextBlock)(pageData, englishForBackend);
            contextBlock += (0, contextEngine_1.buildMismatchWarning)(pageData.pageContext, intent);
        }
    }
    catch (err) {
        log.warn('Page context build error (non-fatal)', { error: err?.message });
    }
    // ── Step 4: Internal module dispatch (Pragati AI internal enrichment) ──────
    // These modules feed data into Pragati AI's context. They are NOT separate AIs.
    try {
        const agentResults = await (0, agentRouter_1.dispatchAgents)(englishForBackend, {
            userId,
            farmerProfile,
            pageData: pageData,
        });
        contextBlock += (0, agentRouter_1.buildAgentContextBlock)(agentResults);
        // Update preferred topics from agent usage
        for (const r of agentResults) {
            if (r.success && r.agent) {
                (0, memoryEngine_2.updatePreferredTopics)(userId, r.agent).catch(() => { });
            }
        }
    }
    catch (err) {
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
function postProcess(params) {
    const { userId, userMessage, assistantReply, langCode, pageContext, agentUsed } = params;
    setImmediate(async () => {
        try {
            await (0, memoryEngine_1.writeMemoryTurn)({
                userId,
                userMessage,
                assistantReply,
                pageContext,
                agentUsed,
                langCode,
            });
            await (0, memoryEngine_2.updateLanguagePreference)(userId, langCode);
        }
        catch (err) {
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
async function translateAIOutput(englishText, langCode) {
    try {
        return await (0, speechTranslationPipeline_1.translateOutputForDisplay)(englishText, langCode);
    }
    catch {
        return { displayText: englishText, voiceText: englishText };
    }
}
//# sourceMappingURL=integrationBus.js.map