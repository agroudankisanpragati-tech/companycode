/**
 * Voice Guide Bridge Manager
 *
 * Automatically spawns Ai/voice_guide_ai/api_bridge.py when the backend
 * starts, if the bridge is not already running.
 *
 * Responsibilities:
 *  - Detect whether the bridge is already healthy (GET /health).
 *  - If not, spawn api_bridge.py via child_process.spawn().
 *  - Poll /health every 1 s, up to 20 s, waiting for HTTP 200.
 *  - Register shutdown hooks so the child process is always cleaned up.
 *  - Never crash the backend — all failures are logged and swallowed.
 *  - Never spawn more than one bridge process.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { createLogger } from '../utils/logger';

const log = createLogger('VoiceGuide');

const BRIDGE_URL   = process.env.VOICE_GUIDE_BRIDGE_URL || 'http://localhost:8002';
const HEALTH_PATH  = '/health';
const POLL_INTERVAL_MS  = 1_000;
const MAX_WAIT_MS       = 20_000;

// Resolve the working directory for the Python bridge relative to this file.
// __dirname  → …/backend/src/services
// We need  → …/Ai/voice_guide_ai
const BRIDGE_CWD = path.resolve(__dirname, '..', '..', '..', 'Ai', 'voice_guide_ai');
const BRIDGE_SCRIPT = 'api_bridge.py';

// Pick the right Python executable for the current platform.
// On Windows "python" resolves via PATH; on Unix "python3" is preferred.
const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3';

let bridgeProcess: ChildProcess | null = null;
let shutdownRegistered = false;

// ── Health probe ──────────────────────────────────────────────────────────────

async function isBridgeHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const res = await fetch(`${BRIDGE_URL}${HEALTH_PATH}`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Poll until healthy or timeout ─────────────────────────────────────────────

function waitForBridge(): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tick = async () => {
      if (await isBridgeHealthy()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= MAX_WAIT_MS) {
        resolve(false);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
  });
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function terminateBridge(): void {
  if (!bridgeProcess) return;
  log.info('[VoiceGuide] Bridge terminated.');
  try {
    bridgeProcess.kill('SIGTERM');
  } catch {
    // process may already be gone
  }
  bridgeProcess = null;
}

function registerShutdownHooks(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const handler = () => terminateBridge();

  process.on('exit',             handler);
  process.on('SIGINT',           handler);
  process.on('SIGTERM',          handler);
  process.on('uncaughtException', (err) => {
    log.error('[VoiceGuide] Uncaught exception — terminating bridge', { error: err.message });
    terminateBridge();
  });
}

// ── Spawn ─────────────────────────────────────────────────────────────────────

function spawnBridge(): void {
  log.info('[VoiceGuide] Starting Python bridge...', { cwd: BRIDGE_CWD, bin: PYTHON_BIN });

  try {
    bridgeProcess = spawn(PYTHON_BIN, [BRIDGE_SCRIPT], {
      cwd: BRIDGE_CWD,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    bridgeProcess.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) log.debug(`[bridge] ${line}`);
    });

    bridgeProcess.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) log.warn(`[bridge:stderr] ${line}`);
    });

    bridgeProcess.on('error', (err) => {
      log.error('[VoiceGuide] Bridge process error', { error: err.message });
      bridgeProcess = null;
    });

    bridgeProcess.on('exit', (code, signal) => {
      if (code !== null || signal !== null) {
        log.warn('[VoiceGuide] Bridge process exited unexpectedly', { code, signal });
      }
      bridgeProcess = null;
    });

    registerShutdownHooks();
  } catch (err: any) {
    log.error('[VoiceGuide] Bridge startup failed — could not spawn process', { error: err.message });
    bridgeProcess = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const bridgeManager = {
  /**
   * Called once during backend startup.
   * - If bridge is already healthy → do nothing.
   * - If not → spawn it and wait up to 20 s for /health to return 200.
   * - Never throws; backend continues regardless of bridge state.
   */
  async ensureBridgeRunning(): Promise<void> {
    log.info('[VoiceGuide] Checking bridge...');

    if (await isBridgeHealthy()) {
      log.info('[VoiceGuide] Bridge already running.');
      return;
    }

    // Guard against duplicate spawns (e.g. hot-reload calling this twice)
    if (bridgeProcess) {
      log.info('[VoiceGuide] Bridge process already spawned — waiting for health...');
    } else {
      spawnBridge();
    }

    log.info('[VoiceGuide] Waiting for bridge...', { maxWaitMs: MAX_WAIT_MS });
    const healthy = await waitForBridge();

    if (healthy) {
      log.info('[VoiceGuide] Bridge healthy.');
    } else {
      log.warn('[VoiceGuide] Bridge startup failed — Voice Guide routes will return 503 until bridge is available.', {
        bridgeUrl: BRIDGE_URL,
      });
    }
  },
};
