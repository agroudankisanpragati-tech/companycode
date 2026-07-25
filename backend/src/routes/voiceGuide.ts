/**
 * Voice Guide Routes — Integration Layer
 *
 * Proxies Voice Guide AI bridge (Python FastAPI on port 8002) and
 * enriches every request with the authenticated user's context so
 * the AI runtime knows login state, language, and profile completeness.
 *
 * Mounted at /api/voice-guide
 */

import express, { Response } from 'express';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User } from '../models/User';
import { UserSettings } from '../models/UserSettings';
import { FarmerProfileData } from '../models/FarmerProfileData';
import { createLogger } from '../utils/logger';

const router = express.Router();
const log = createLogger('voice-guide');

const BRIDGE_URL = process.env.VOICE_GUIDE_BRIDGE_URL || 'http://localhost:8002';

// Cold-start timeout is longer — Python RuntimeManager init can take 8–12 s.
// Subsequent requests use the fast timeout.
const BRIDGE_TIMEOUT_COLD = parseInt(process.env.VOICE_GUIDE_BRIDGE_TIMEOUT_COLD_MS || '15000', 10);
const BRIDGE_TIMEOUT_FAST = parseInt(process.env.VOICE_GUIDE_BRIDGE_TIMEOUT_MS || '8000', 10);

const IS_DEV = process.env.NODE_ENV !== 'production';

// ── Bridge proxy helper ───────────────────────────────────────────────────────

async function bridgeRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  timeoutMs = BRIDGE_TIMEOUT_FAST,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BRIDGE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, status: res.status };
  } catch (err: any) {
    const isAbort = err.name === 'AbortError';
    const isRefused = err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED';

    // Always log the real error so it appears in server logs
    log.error('[bridge] request failed', {
      method,
      path,
      error: err.message,
      code: err.code ?? err.cause?.code,
      type: isAbort ? 'timeout' : isRefused ? 'connection_refused' : 'unknown',
    });

    if (isAbort) {
      return {
        ok: false,
        data: { error: `Voice Guide bridge timeout after ${timeoutMs}ms`, detail: err.message },
        status: 504,
      };
    }
    if (isRefused) {
      return {
        ok: false,
        data: {
          error: 'Voice Guide bridge is not running',
          detail: `Cannot connect to ${BRIDGE_URL}. Start the Python bridge: cd Ai/voice_guide_ai && python api_bridge.py`,
        },
        status: 503,
      };
    }
    return {
      ok: false,
      data: { error: err.message || 'Bridge unavailable', detail: String(err) },
      status: 503,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Error response helper ─────────────────────────────────────────────────────
// In development: include the real error message.
// In production:  return a safe generic message.

function bridgeError(res: Response, result: { ok: boolean; data: unknown; status: number }): Response {
  const data = result.data as any;
  const payload: Record<string, unknown> = { success: false };

  if (IS_DEV) {
    payload.error = data?.error ?? 'Voice Guide unavailable';
    payload.detail = data?.detail ?? null;
    payload.bridge_url = BRIDGE_URL;
  } else {
    payload.error = 'Voice Guide unavailable';
  }

  return res.status(result.status).json(payload);
}

// ── Build user conditions for the runtime ────────────────────────────────────

async function buildConditions(userId: string): Promise<Record<string, unknown>> {
  try {
    const [user, settings, profile] = await Promise.all([
      User.findById(userId).select('name role phone').lean(),
      UserSettings.findOne({ userId }).select('appLanguage notificationsEnabled').lean(),
      FarmerProfileData.findOne({ userId }).select('isComplete location cropType').lean(),
    ]);

    return {
      logged_in: true,
      farmer_profile_complete: !!(profile as any)?.isComplete,
      location_available: !!(profile as any)?.location,
      language: (settings as any)?.appLanguage || 'hi',
      role: (user as any)?.role || 'farmer',
      permission_granted: true,
    };
  } catch {
    return { logged_in: true, farmer_profile_complete: false, location_available: false };
  }
}

// ── GET /api/voice-guide/health — NO auth required ───────────────────────────
// Health check must be reachable before the user has a valid token.

router.get('/health', async (_req, res: Response) => {
  const result = await bridgeRequest('GET', '/health', undefined, BRIDGE_TIMEOUT_FAST);
  if (!result.ok) return bridgeError(res, result);
  return res.status(200).json(result.data);
});

// ── All remaining routes require authentication ───────────────────────────────
router.use(authenticate);

// ── POST /api/voice-guide/initialize ─────────────────────────────────────────
router.post('/initialize', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 'home', language } = req.body as { page?: string; language?: string };

    const conditions = await buildConditions(req.user!.userId);

    // Run conditions + session start in parallel; use cold timeout for session/start
    const [conditionsResult, runtimeResult] = await Promise.all([
      bridgeRequest('POST', '/voice-guide/conditions', { conditions }),
      bridgeRequest('POST', '/voice-guide/session/start', {}, BRIDGE_TIMEOUT_COLD),
    ]);

    if (!conditionsResult.ok) {
      log.error('[initialize] conditions failed', { status: conditionsResult.status, data: conditionsResult.data });
      return bridgeError(res, conditionsResult);
    }
    if (!runtimeResult.ok) {
      log.error('[initialize] session/start failed', { status: runtimeResult.status, data: runtimeResult.data });
      return bridgeError(res, runtimeResult);
    }

    // Fetch avatar config + dialogue + page in parallel
    const [avatarResult, dialogueResult, pageResult] = await Promise.all([
      bridgeRequest('GET', '/voice-guide/avatar/config'),
      bridgeRequest('GET', `/voice-guide/dialogue/${encodeURIComponent(page)}/welcome?lang=${encodeURIComponent(language || 'hi')}`),
      bridgeRequest('POST', '/voice-guide/page', { page, language }),
    ]);

    if (!avatarResult.ok) {
      log.warn('[initialize] avatar config failed — continuing', { status: avatarResult.status });
    }
    if (!dialogueResult.ok) {
      log.warn('[initialize] dialogue fetch failed — continuing', { status: dialogueResult.status });
    }
    if (!pageResult.ok) {
      log.error('[initialize] page open failed', { status: pageResult.status, data: pageResult.data });
      return bridgeError(res, pageResult);
    }

    log.info('[initialize] success', { page, language, userId: req.user!.userId });

    return res.status(200).json({
      success: true,
      data: {
        runtime: runtimeResult.data,
        avatar: avatarResult.data,
        dialogue: dialogueResult.data,
        page: pageResult.data,
      },
    });
  } catch (err: any) {
    log.error('[initialize] unhandled exception', { error: err.message, stack: err.stack });
    return res.status(503).json({
      success: false,
      error: IS_DEV ? err.message : 'Voice Guide unavailable',
      ...(IS_DEV && { stack: err.stack }),
    });
  }
});

// ── POST /api/voice-guide/page ────────────────────────────────────────────────
router.post('/page', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, language } = req.body as { page: string; language?: string };
    if (!page) return res.status(400).json({ error: 'page is required' });

    const conditions = await buildConditions(req.user!.userId);
    await bridgeRequest('POST', '/voice-guide/conditions', { conditions });

    const result = await bridgeRequest('POST', '/voice-guide/page', { page, language });
    if (!result.ok) {
      log.error('[page] bridge error', { page, status: result.status, data: result.data });
      return bridgeError(res, result);
    }

    log.debug('[page] opened', { page, language, userId: req.user!.userId });
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[page] unhandled exception', { error: err.message, stack: err.stack });
    return res.status(503).json({
      success: false,
      error: IS_DEV ? err.message : 'Voice Guide unavailable',
    });
  }
});

// ── POST /api/voice-guide/play ────────────────────────────────────────────────
router.post('/play', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, dialogue_type = 'welcome', language, priority, context } = req.body as {
      page: string;
      dialogue_type?: string;
      language?: string;
      priority?: number;
      context?: Record<string, unknown>;
    };
    if (!page) return res.status(400).json({ error: 'page is required' });

    const result = await bridgeRequest('POST', '/voice-guide/play', {
      page, dialogue_type, language, priority, context,
    });
    if (!result.ok) {
      log.error('[play] bridge error', { page, dialogue_type, status: result.status, data: result.data });
      return bridgeError(res, result);
    }
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[play] unhandled exception', { error: err.message, stack: err.stack });
    return res.status(503).json({
      success: false,
      error: IS_DEV ? err.message : 'Voice Guide unavailable',
    });
  }
});

// ── POST /api/voice-guide/replay ──────────────────────────────────────────────
router.post('/replay', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dialogue_id } = req.body as { dialogue_id?: string };
    const result = await bridgeRequest('POST', '/voice-guide/replay', { dialogue_id });
    if (!result.ok) {
      log.error('[replay] bridge error', { status: result.status, data: result.data });
      return bridgeError(res, result);
    }
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[replay] unhandled exception', { error: err.message, stack: err.stack });
    return res.status(503).json({
      success: false,
      error: IS_DEV ? err.message : 'Voice Guide unavailable',
    });
  }
});

// ── POST /api/voice-guide/language ────────────────────────────────────────────
router.post('/language', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { language } = req.body as { language: string };
    if (!language) return res.status(400).json({ error: 'language is required' });
    const result = await bridgeRequest('POST', '/voice-guide/language', { language });
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[language] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

// ── POST /api/voice-guide/online ──────────────────────────────────────────────
router.post('/online', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { online } = req.body as { online: boolean };
    const result = await bridgeRequest('POST', '/voice-guide/online', { online });
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[online] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

// ── GET /api/voice-guide/status ───────────────────────────────────────────────
router.get('/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bridgeRequest('GET', '/voice-guide/status');
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[status] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

// ── GET /api/voice-guide/dialogue/:page/:type ─────────────────────────────────
router.get('/dialogue/:page/:type', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, type } = req.params;
    const lang = (req.query.lang as string) || 'hi';
    const result = await bridgeRequest('GET', `/voice-guide/dialogue/${page}/${type}?lang=${lang}`);
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[dialogue] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

// ── GET /api/voice-guide/translation/:lang/:page ──────────────────────────────
router.get('/translation/:lang/:page', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lang, page } = req.params;
    const result = await bridgeRequest('GET', `/voice-guide/translation/${lang}/${page}`);
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[translation] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

// ── GET /api/voice-guide/avatar/config ────────────────────────────────────────
router.get('/avatar/config', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await bridgeRequest('GET', '/voice-guide/avatar/config');
    if (!result.ok) return bridgeError(res, result);
    return res.status(result.status).json(result.data);
  } catch (err: any) {
    log.error('[avatar/config] unhandled exception', { error: err.message });
    return res.status(503).json({ success: false, error: IS_DEV ? err.message : 'Voice Guide unavailable' });
  }
});

export default router;
