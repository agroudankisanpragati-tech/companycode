/**
 * Structured Logger — Phase 7
 *
 * Single logger used by every backend service and route.
 * Outputs JSON in production, human-readable in development.
 * Never throws — logging failures are silently swallowed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  service: string;
  msg: string;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === 'production';
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (IS_PROD ? 'info' : 'debug');

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function write(level: LogLevel, service: string, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  try {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      service,
      msg,
      ...meta,
    };
    if (IS_PROD) {
      // JSON for log aggregators (CloudWatch, Datadog, etc.)
      const out = level === 'error' ? process.stderr : process.stdout;
      out.write(JSON.stringify(entry) + '\n');
    } else {
      // Human-readable for local dev
      const color = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' }[level];
      const reset = '\x1b[0m';
      const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      const line = `${color}[${level.toUpperCase()}]${reset} [${service}] ${msg}${metaStr}`;
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
    }
  } catch { /* never throw from logger */ }
}

export function createLogger(service: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => write('debug', service, msg, meta),
    info:  (msg: string, meta?: Record<string, unknown>) => write('info',  service, msg, meta),
    warn:  (msg: string, meta?: Record<string, unknown>) => write('warn',  service, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => write('error', service, msg, meta),
  };
}

export const logger = createLogger('app');
