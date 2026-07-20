"use strict";
/**
 * Pragati AI Controller — ROOT AGENT
 *
 * Pipeline:
 *
 *   User Message
 *     ↓
 *   Language Engine (normalize + translate input)
 *     ↓
 *   Intent Engine (classify intent)
 *     ↓
 *   Root Router — routeIntent()
 *     ├─ greeting/navigation/voice → static response (NEVER KB, NEVER LLM)
 *     ├─ disease/crop/soil/weather/market/government/kvk → dedicated agent → local composer
 *     └─ general → GeneralAgent → dispatchAgents → composeLocalResponse → [optional LLM]
 *     ↓
 *   Memory Engine (persist turn, update preferences)
 *     ↓
 *   Response
 *
 * LLM Rules:
 * - NEVER called for: greeting, navigation, voice, disease, crop, soil, weather, market, government, kvk
 * - ONLY optional fallback for: general (and only when local KB returns nothing)
 * - NEVER called if OPENAI_API_KEY is absent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPragatiAIController = runPragatiAIController;
const logger_1 = require("../utils/logger");
const intentEngine_1 = require("./intentEngine");
const intentRouter_1 = require("../agents/intentRouter");
const agentRouter_1 = require("../agents/agentRouter");
const memoryEngine_1 = require("./memoryEngine");
const speechTranslationPipeline_1 = require("./speechTranslationPipeline");
const contextEngine_1 = require("./contextEngine");
const localResponseComposer_1 = require("./localResponseComposer");
const aliasNormalizer_1 = require("./aliasNormalizer");
const contextMemoryEngine_1 = require("./contextMemoryEngine");
const log = (0, logger_1.createLogger)('pragatiAIController');
// ─── LLM fallback config ──────────────────────────────────────────────────────
function getLLMConfig() {
    const apiKey = process.env.OPENAI_API_KEY || '';
    return {
        enabled: !!apiKey,
        apiKey,
        model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    };
}
// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Pragati AI, an intelligent agriculture assistant helping Indian farmers. You are part of the Agroudan Kisan Pragati platform.

Help farmers with crop recommendations, pest management, fertilizer advice, irrigation, soil health, weather-based decisions, government schemes, and market prices.

RESPONSE FORMAT:
- ALWAYS return valid JSON: {"native":"...","hindi":"...","english":"..."}
- Use simple, farmer-friendly language with bullet points and emojis.`;
const LANG_NAMES = {
    en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi',
    bn: 'Bengali', as: 'Assamese', or: 'Odia', te: 'Telugu', ta: 'Tamil',
    kn: 'Kannada', ml: 'Malayalam', ur: 'Urdu', sa: 'Sanskrit',
    kok: 'Konkani', ks: 'Kashmiri', mni: 'Manipuri', brx: 'Bodo',
    doi: 'Dogri', mai: 'Maithili', ne: 'Nepali', sd: 'Sindhi', raj: 'Rajasthani',
};
// ─── LLM fallback (general intent only) ──────────────────────────────────────
async function callLLMFallback(messages, contextBlock, langCode, llm) {
    try {
        let systemContent = SYSTEM_PROMPT + contextBlock;
        if (langCode && LANG_NAMES[langCode]) {
            systemContent += `\n\nLANGUAGE INSTRUCTION (MANDATORY): Write "native" in ${LANG_NAMES[langCode]}, "hindi" in Hindi, "english" in English.`;
        }
        else {
            systemContent += `\n\nLANGUAGE INSTRUCTION: Detect user language for "native". "hindi" in Hindi. "english" in English.`;
        }
        const res = await fetch(`${llm.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${llm.apiKey}`,
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                'X-Title': 'Pragati AI',
            },
            body: JSON.stringify({
                model: llm.model,
                messages: [{ role: 'system', content: systemContent }, ...messages.slice(-20)],
                temperature: 0.4,
                max_tokens: 1000,
            }),
        });
        if (!res.ok) {
            log.warn('LLM API error', { status: res.status });
            return null;
        }
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            return {
                english: parsed.english || parsed.native || cleaned,
                hindi: parsed.hindi || parsed.native || cleaned,
                native: parsed.native || parsed.english || cleaned,
            };
        }
        catch {
            return { english: cleaned, hindi: cleaned, native: cleaned };
        }
    }
    catch (err) {
        log.warn('LLM fallback failed', { error: err?.message });
        return null;
    }
}
// ─── Persist memory async ─────────────────────────────────────────────────────
function persistMemory(userId, lastUserMsg, reply, pageContext, agentUsed, langCode, topics) {
    setImmediate(() => {
        (0, memoryEngine_1.writeMemoryTurn)({ userId, userMessage: lastUserMsg, assistantReply: reply, pageContext, agentUsed, langCode }).catch(() => { });
        (0, memoryEngine_1.updateLanguagePreference)(userId, langCode).catch(() => { });
        for (const t of topics)
            (0, memoryEngine_1.updatePreferredTopics)(userId, t).catch(() => { });
    });
}
// ─── Main controller ──────────────────────────────────────────────────────────
async function runPragatiAIController(req) {
    const start = Date.now();
    const { userId, messages, langCode, pageData, dashboardContext, farmerProfile } = req;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    // ── Step 1: Language Engine ───────────────────────────────────────────────
    let englishForBackend = lastUserMsg;
    let aliasMatched = false;
    try {
        const pipeline = await (0, speechTranslationPipeline_1.runSpeechTranslationPipeline)({
            rawText: lastUserMsg,
            appLangCode: langCode,
            pageContext: pageData?.pageContext,
        });
        englishForBackend = pipeline.englishForBackend || lastUserMsg;
    }
    catch (err) {
        log.warn('Language pipeline error (non-fatal)', { error: err?.message });
    }
    // ── Step 1b: Alias normalization — runs BEFORE intent detection ───────────
    const aliasPrepped = (0, aliasNormalizer_1.prepareForIntentDetection)(englishForBackend);
    if (aliasPrepped !== englishForBackend) {
        aliasMatched = true;
        englishForBackend = aliasPrepped;
    }
    // ── Step 2: Intent Engine ─────────────────────────────────────────────────
    const intent = (0, intentEngine_1.detectIntent)(englishForBackend);
    // ── Step 2b: Load memory + resolve context references ────────────────────
    let memCtxForHistory = null;
    let memoryUsed = false;
    let resolvedMessage = englishForBackend;
    try {
        memCtxForHistory = await (0, memoryEngine_1.loadMemoryContext)(userId);
        if (memCtxForHistory.recentHistory.length > 0) {
            const resolved = (0, contextMemoryEngine_1.resolveContextReferences)(englishForBackend, memCtxForHistory.recentHistory);
            if (resolved.resolved) {
                resolvedMessage = resolved.enriched;
                memoryUsed = true;
                log.info('Context resolved from memory', {
                    intent,
                    refs: resolved.resolvedRefs,
                    original: resolved.original.slice(0, 60),
                });
            }
        }
    }
    catch (err) {
        log.warn('Memory/context resolution error (non-fatal)', { error: err?.message });
    }
    // ── Step 3: Root Router — select agent immediately ────────────────────────
    const routeResult = await (0, intentRouter_1.routeIntent)(intent, {
        userId,
        message: resolvedMessage,
        farmerProfile,
        pageData: pageData,
    });
    log.info('Request routed', {
        intent,
        agent: routeResult.agentName,
        mode: routeResult.mode,
        yoloUsed: routeResult.yoloUsed,
        kbUsed: routeResult.kbUsed,
        memoryUsed,
        aliasMatched,
        confidence: routeResult.agentResults.find(r => r.success)?.data?.confidence ?? null,
        executionMs: Date.now() - start,
    });
    // ── Step 4: Static response (greeting / navigation / voice) ──────────────
    // NEVER reaches KB or LLM
    if (routeResult.mode === 'static' && routeResult.staticReply) {
        const { english, hindi, native } = routeResult.staticReply;
        const reply = langCode === 'en' ? english : native;
        persistMemory(userId, lastUserMsg, english, pageData?.pageContext, routeResult.agentName, langCode, []);
        log.info('Static response returned', {
            intent,
            agent: routeResult.agentName,
            kbUsed: false,
            llmUsed: false,
            fallbackUsed: false,
            memoryUsed,
            aliasMatched,
            executionMs: Date.now() - start,
        });
        return {
            success: true,
            reply,
            bilingual: { english, hindi, native, timestamp: new Date().toISOString(), source: 'local' },
            intent,
            agentsUsed: [routeResult.agentName],
            localAnswered: true,
        };
    }
    // ── Step 5: Compose local response from agent results ────────────────────
    const localResponse = (0, localResponseComposer_1.composeLocalResponse)(intent, routeResult.agentResults, langCode, resolvedMessage);
    if (localResponse) {
        const reply = langCode === 'en' ? localResponse.english : localResponse.native;
        persistMemory(userId, lastUserMsg, localResponse.english, pageData?.pageContext, routeResult.agentName, langCode, localResponse.agentsUsed);
        log.info('Local KB answered', {
            intent,
            agent: routeResult.agentName,
            agents: localResponse.agentsUsed,
            confidence: localResponse.confidence,
            yoloUsed: routeResult.yoloUsed,
            kbUsed: true,
            llmUsed: false,
            fallbackUsed: false,
            memoryUsed,
            aliasMatched,
            executionMs: Date.now() - start,
        });
        return {
            success: true,
            reply,
            bilingual: {
                english: localResponse.english,
                hindi: localResponse.hindi,
                native: localResponse.native,
                timestamp: new Date().toISOString(),
                source: 'local',
            },
            intent,
            agentsUsed: localResponse.agentsUsed,
            localAnswered: true,
        };
    }
    // ── Step 6: LLM Fallback — ONLY for general intent ───────────────────────
    // Non-general intents (greeting, disease, crop, soil, weather, market,
    // government, kvk, irrigation, machinery, emergency) NEVER reach LLM.
    if (intent !== 'general') {
        log.info('Non-general intent — no LLM fallback', { intent, agent: routeResult.agentName });
        const notFound = (0, localResponseComposer_1.buildNotFoundResponse)(langCode);
        const reply = langCode === 'en' ? notFound.english : notFound.native;
        return {
            success: true,
            reply,
            bilingual: { english: notFound.english, hindi: notFound.hindi, native: notFound.native, timestamp: new Date().toISOString(), source: 'fallback' },
            intent,
            agentsUsed: [],
            localAnswered: false,
        };
    }
    const llm = getLLMConfig();
    if (!llm.enabled) {
        log.info('LLM disabled (no API key)', { intent });
        const notFound = (0, localResponseComposer_1.buildNotFoundResponse)(langCode);
        const reply = langCode === 'en' ? notFound.english : notFound.native;
        return {
            success: true,
            reply,
            bilingual: { english: notFound.english, hindi: notFound.hindi, native: notFound.native, timestamp: new Date().toISOString(), source: 'fallback' },
            intent,
            agentsUsed: [],
            localAnswered: false,
        };
    }
    // Build LLM context block — reuse already-loaded memory
    let contextBlock = '';
    try {
        if (memCtxForHistory)
            contextBlock += (0, memoryEngine_1.buildMemoryContextBlock)(memCtxForHistory);
    }
    catch { /* non-fatal */ }
    if (farmerProfile) {
        contextBlock += `\n\nFARMER CONTEXT:\nName: ${farmerProfile.name || 'N/A'}\nLocation: ${farmerProfile.district || 'Unknown'}, ${farmerProfile.state || 'Unknown'}\nFarm Size: ${farmerProfile.farmSize || 'Unknown'} acres\nSoil Type: ${farmerProfile.soilType || 'Unknown'}`;
    }
    if (pageData?.pageContext) {
        try {
            contextBlock += (0, contextEngine_1.buildPageContextBlock)(pageData, englishForBackend);
            contextBlock += (0, contextEngine_1.buildMismatchWarning)(pageData.pageContext, intent);
        }
        catch { /* non-fatal */ }
    }
    if (routeResult.agentResults.length > 0) {
        contextBlock += (0, agentRouter_1.buildAgentContextBlock)(routeResult.agentResults);
    }
    if (dashboardContext) {
        const { weather, soilMoisture } = dashboardContext;
        if (weather)
            contextBlock += `\n\nLIVE DASHBOARD:\nWeather: ${weather.condition || 'N/A'}, ${weather.temp !== undefined ? weather.temp + '°C' : 'N/A'}, Humidity: ${weather.humidity !== undefined ? weather.humidity + '%' : 'N/A'}`;
        if (soilMoisture)
            contextBlock += `\nSoil Moisture: ${soilMoisture.percentage}% (${soilMoisture.status})`;
    }
    log.info('LLM fallback called', { intent, agent: 'GeneralAgent', model: llm.model });
    const llmResult = await callLLMFallback(messages, contextBlock, langCode, llm);
    if (!llmResult) {
        const notFound = (0, localResponseComposer_1.buildNotFoundResponse)(langCode);
        const reply = langCode === 'en' ? notFound.english : notFound.native;
        log.info('LLM fallback failed — returning not-found', {
            intent,
            kbUsed: false,
            llmUsed: false,
            fallbackUsed: true,
            executionMs: Date.now() - start,
        });
        return {
            success: true,
            reply,
            bilingual: { english: notFound.english, hindi: notFound.hindi, native: notFound.native, timestamp: new Date().toISOString(), source: 'fallback' },
            intent,
            agentsUsed: [],
            localAnswered: false,
        };
    }
    setImmediate(() => {
        (0, memoryEngine_1.writeMemoryTurn)({ userId, userMessage: lastUserMsg, assistantReply: llmResult.english, pageContext: pageData?.pageContext, langCode }).catch(() => { });
        (0, memoryEngine_1.updateLanguagePreference)(userId, langCode).catch(() => { });
    });
    const reply = langCode === 'en' ? llmResult.english : llmResult.native;
    log.info('LLM fallback answered', {
        intent,
        agent: 'GeneralAgent',
        kbUsed: routeResult.kbUsed,
        llmUsed: true,
        fallbackUsed: false,
        executionMs: Date.now() - start,
    });
    return {
        success: true,
        reply,
        bilingual: { english: llmResult.english, hindi: llmResult.hindi, native: llmResult.native, timestamp: new Date().toISOString(), source: 'llm' },
        intent,
        agentsUsed: routeResult.agentResults.filter(r => r.success).map(r => r.agent),
        localAnswered: false,
    };
}
//# sourceMappingURL=pragatiAIController.js.map