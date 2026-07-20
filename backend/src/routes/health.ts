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

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest, authenticate, requireAdmin } from '../middleware/auth';
import { isYoloServiceHealthy } from '../services/yoloService';
import { isPragatiAIHealthy, getAIStatus } from '../services/pragatiAIService';
import { getActiveSTTProvider, getActiveTTSProvider, listProviders } from '../services/voiceProviderAdapter';
import { getCacheStats } from '../services/translationCacheService';
import { SpeechCacheEntry } from '../models/SpeechCacheEntry';
import { TrainingDataset } from '../models/TrainingDataset';
import { FarmerMemory } from '../models/FarmerMemory';
import { LanguageDictionary } from '../models/LanguageDictionary';
import { DictionaryReviewQueue } from '../models/DictionaryReviewQueue';
import { createLogger } from '../utils/logger';

const router = express.Router();
const log = createLogger('health');

const START_TIME = Date.now();

// ─── Liveness probe (public) ──────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Agroudan Kisan Pragati Backend',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    ts: new Date().toISOString(),
  });
});

// ─── Deep health check (admin) ────────────────────────────────────────────────

router.get('/deep', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'degraded' | 'down'; detail?: string; ms?: number }> = {};
  let criticalDown = false;

  // ── 1. MongoDB ──────────────────────────────────────────────────────────────
  await runCheck('mongodb', async () => {
    const state = mongoose.connection.readyState;
    if (state !== 1) throw new Error(`readyState=${state}`);
    // Quick ping
    await mongoose.connection.db!.admin().ping();
    return 'connected';
  }, checks, true, () => { criticalDown = true; });

  // ── 2. YOLO inference service ───────────────────────────────────────────────
  await runCheck('yolo', async () => {
    const healthy = await isYoloServiceHealthy();
    if (!healthy) throw new Error('YOLO service not responding');
    return 'ok';
  }, checks, false);

  // ── 2b. Pragati AI Bridge ────────────────────────────────────────────────────
  await runCheck('pragati_ai_bridge', async () => {
    const healthy = await isPragatiAIHealthy();
    if (!healthy) throw new Error('Pragati AI Bridge not responding on port 8001');
    const status = await getAIStatus();
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
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`LLM API returned ${res.status}`);
    return 'reachable';
  }, checks, false);

  // ── 4. Language Dictionary ──────────────────────────────────────────────────
  await runCheck('language_dictionary', async () => {
    const [total, approved, pending] = await Promise.all([
      LanguageDictionary.countDocuments(),
      LanguageDictionary.countDocuments({ approved: true }),
      DictionaryReviewQueue.countDocuments({ status: 'pending' }),
    ]);
    return `${approved}/${total} approved, ${pending} pending review`;
  }, checks, false);

  // ── 5. Memory Engine ────────────────────────────────────────────────────────
  await runCheck('memory_engine', async () => {
    const [farmers, totalInteractions] = await Promise.all([
      FarmerMemory.countDocuments(),
      FarmerMemory.aggregate([{ $group: { _id: null, total: { $sum: '$totalInteractions' } } }])
        .then(r => r[0]?.total || 0),
    ]);
    return `${farmers} farmers, ${totalInteractions} total interactions`;
  }, checks, false);

  // ── 6. Translation Cache ────────────────────────────────────────────────────
  await runCheck('translation_cache', async () => {
    const stats = await getCacheStats();
    return `L1=${stats.l1Size}, L2=${stats.l2Size}`;
  }, checks, false);

  // ── 7. Speech Cache ─────────────────────────────────────────────────────────
  await runCheck('speech_cache', async () => {
    const count = await SpeechCacheEntry.countDocuments();
    return `${count} cached entries`;
  }, checks, false);

  // ── 8. Training Datasets ────────────────────────────────────────────────────
  await runCheck('training_pipeline', async () => {
    const [total, approved] = await Promise.all([
      TrainingDataset.countDocuments(),
      TrainingDataset.countDocuments({ status: 'approved' }),
    ]);
    return `${total} datasets, ${approved} approved`;
  }, checks, false);

  // ── 9. Voice Providers ──────────────────────────────────────────────────────
  await runCheck('voice_providers', async () => {
    const providers = listProviders();
    const activeSTT = getActiveSTTProvider().name;
    const activeTTS = getActiveTTSProvider().name;
    const available = providers.filter(p => p.available).map(p => `${p.type}:${p.name}`).join(', ');
    return `STT=${activeSTT}, TTS=${activeTTS}, available=[${available}]`;
  }, checks, false);

  // ── 10. Language Engine pipeline ────────────────────────────────────────────
  await runCheck('language_engine', async () => {
    // Quick self-test: lookup a known term
    const entry = await LanguageDictionary.findOne({ approved: true }).lean();
    if (!entry) return 'no dictionary entries yet';
    return `pipeline ready, sample term: ${(entry as any).english}`;
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

async function runCheck(
  name: string,
  fn: () => Promise<string>,
  checks: Record<string, any>,
  isCritical: boolean,
  onFail?: () => void
): Promise<void> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    checks[name] = { status: 'ok', detail, ms: Date.now() - t0 };
  } catch (err: any) {
    checks[name] = { status: 'down', detail: err?.message || 'check failed', ms: Date.now() - t0 };
    if (isCritical) onFail?.();
    log.warn(`Health check failed: ${name}`, { error: err?.message });
  }
}

export default router;
