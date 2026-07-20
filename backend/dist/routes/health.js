"use strict";
/**
 * Health Check Route — Phase 7
 *
 * GET /api/health          — public liveness probe (load balancer / k8s)
 * GET /api/health/deep     — full subsystem check (admin only)
 *
 * Checks every integrated subsystem:
 *   ✓ MongoDB connection
 *   ✓ YOLO inference service
 *   ✓ OpenAI / LLM provider
 *   ✓ Language Engine (dictionary + pipeline)
 *   ✓ Voice Engine (speech cache + providers)
 *   ✓ Memory Engine (FarmerMemory collection)
 *   ✓ Translation Cache
 *   ✓ Speech Cache
 *
 * Graceful: each check is isolated — one failure never blocks others.
 * Returns HTTP 200 if core services are up, 503 if critical services are down.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const yoloService_1 = require("../services/yoloService");
const pragatiAIService_1 = require("../services/pragatiAIService");
const voiceProviderAdapter_1 = require("../services/voiceProviderAdapter");
const translationCacheService_1 = require("../services/translationCacheService");
const SpeechCacheEntry_1 = require("../models/SpeechCacheEntry");
const TrainingDataset_1 = require("../models/TrainingDataset");
const FarmerMemory_1 = require("../models/FarmerMemory");
const LanguageDictionary_1 = require("../models/LanguageDictionary");
const DictionaryReviewQueue_1 = require("../models/DictionaryReviewQueue");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const log = (0, logger_1.createLogger)('health');
const START_TIME = Date.now();
// ─── Liveness probe (public) ──────────────────────────────────────────────────
router.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Agroudan Kisan Pragati Backend',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        ts: new Date().toISOString(),
    });
});
// ─── Deep health check (admin) ────────────────────────────────────────────────
router.get('/deep', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    const checks = {};
    let criticalDown = false;
    // ── 1. MongoDB ──────────────────────────────────────────────────────────────
    await runCheck('mongodb', async () => {
        const state = mongoose_1.default.connection.readyState;
        if (state !== 1)
            throw new Error(`readyState=${state}`);
        // Quick ping
        await mongoose_1.default.connection.db.admin().ping();
        return 'connected';
    }, checks, true, () => { criticalDown = true; });
    // ── 2. YOLO inference service ───────────────────────────────────────────────
    await runCheck('yolo', async () => {
        const healthy = await (0, yoloService_1.isYoloServiceHealthy)();
        if (!healthy)
            throw new Error('YOLO service not responding');
        return 'ok';
    }, checks, false);
    // ── 2b. Pragati AI Bridge ────────────────────────────────────────────────────
    await runCheck('pragati_ai_bridge', async () => {
        const healthy = await (0, pragatiAIService_1.isPragatiAIHealthy)();
        if (!healthy)
            throw new Error('Pragati AI Bridge not responding on port 8001');
        const status = await (0, pragatiAIService_1.getAIStatus)();
        const modules = status?.modules || {};
        const available = Object.entries(modules)
            .filter(([, v]) => v === 'available')
            .map(([k]) => k)
            .join(', ');
        return `bridge ok | available modules: [${available || 'none loaded yet'}]`;
    }, checks, false);
    // ── 3. OpenAI / LLM provider ───────────────────────────────────────────────
    await runCheck('llm_provider', async () => {
        const key = process.env.OPENAI_API_KEY;
        if (!key)
            throw new Error('OPENAI_API_KEY not configured');
        const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const res = await fetch(`${base}/models`, {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            throw new Error(`LLM API returned ${res.status}`);
        return 'reachable';
    }, checks, false);
    // ── 4. Language Dictionary ──────────────────────────────────────────────────
    await runCheck('language_dictionary', async () => {
        const [total, approved, pending] = await Promise.all([
            LanguageDictionary_1.LanguageDictionary.countDocuments(),
            LanguageDictionary_1.LanguageDictionary.countDocuments({ approved: true }),
            DictionaryReviewQueue_1.DictionaryReviewQueue.countDocuments({ status: 'pending' }),
        ]);
        return `${approved}/${total} approved, ${pending} pending review`;
    }, checks, false);
    // ── 5. Memory Engine ────────────────────────────────────────────────────────
    await runCheck('memory_engine', async () => {
        const [farmers, totalInteractions] = await Promise.all([
            FarmerMemory_1.FarmerMemory.countDocuments(),
            FarmerMemory_1.FarmerMemory.aggregate([{ $group: { _id: null, total: { $sum: '$totalInteractions' } } }])
                .then(r => r[0]?.total || 0),
        ]);
        return `${farmers} farmers, ${totalInteractions} total interactions`;
    }, checks, false);
    // ── 6. Translation Cache ────────────────────────────────────────────────────
    await runCheck('translation_cache', async () => {
        const stats = await (0, translationCacheService_1.getCacheStats)();
        return `L1=${stats.l1Size}, L2=${stats.l2Size}`;
    }, checks, false);
    // ── 7. Speech Cache ─────────────────────────────────────────────────────────
    await runCheck('speech_cache', async () => {
        const count = await SpeechCacheEntry_1.SpeechCacheEntry.countDocuments();
        return `${count} cached entries`;
    }, checks, false);
    // ── 8. Training Datasets ────────────────────────────────────────────────────
    await runCheck('training_pipeline', async () => {
        const [total, approved] = await Promise.all([
            TrainingDataset_1.TrainingDataset.countDocuments(),
            TrainingDataset_1.TrainingDataset.countDocuments({ status: 'approved' }),
        ]);
        return `${total} datasets, ${approved} approved`;
    }, checks, false);
    // ── 9. Voice Providers ──────────────────────────────────────────────────────
    await runCheck('voice_providers', async () => {
        const providers = (0, voiceProviderAdapter_1.listProviders)();
        const activeSTT = (0, voiceProviderAdapter_1.getActiveSTTProvider)().name;
        const activeTTS = (0, voiceProviderAdapter_1.getActiveTTSProvider)().name;
        const available = providers.filter(p => p.available).map(p => `${p.type}:${p.name}`).join(', ');
        return `STT=${activeSTT}, TTS=${activeTTS}, available=[${available}]`;
    }, checks, false);
    // ── 10. Language Engine pipeline ────────────────────────────────────────────
    await runCheck('language_engine', async () => {
        // Quick self-test: lookup a known term
        const entry = await LanguageDictionary_1.LanguageDictionary.findOne({ approved: true }).lean();
        if (!entry)
            return 'no dictionary entries yet';
        return `pipeline ready, sample term: ${entry.english}`;
    }, checks, false);
    const overallStatus = criticalDown ? 'critical' : Object.values(checks).some(c => c.status === 'down') ? 'degraded' : 'ok';
    log.info('Deep health check completed', { status: overallStatus, checks: Object.keys(checks).length });
    res.status(criticalDown ? 503 : 200).json({
        status: overallStatus,
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        ts: new Date().toISOString(),
        checks,
        summary: {
            total: Object.keys(checks).length,
            ok: Object.values(checks).filter(c => c.status === 'ok').length,
            degraded: Object.values(checks).filter(c => c.status === 'degraded').length,
            down: Object.values(checks).filter(c => c.status === 'down').length,
        },
    });
});
// ─── Helper ───────────────────────────────────────────────────────────────────
async function runCheck(name, fn, checks, isCritical, onFail) {
    const t0 = Date.now();
    try {
        const detail = await fn();
        checks[name] = { status: 'ok', detail, ms: Date.now() - t0 };
    }
    catch (err) {
        checks[name] = { status: 'down', detail: err?.message || 'check failed', ms: Date.now() - t0 };
        if (isCritical)
            onFail?.();
        log.warn(`Health check failed: ${name}`, { error: err?.message });
    }
}
exports.default = router;
//# sourceMappingURL=health.js.map