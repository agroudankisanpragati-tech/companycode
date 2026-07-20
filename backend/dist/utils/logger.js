"use strict";
/**
 * Structured Logger — Phase 7
 *
 * Single logger used by every backend service and route.
 * Outputs JSON in production, human-readable in development.
 * Never throws — logging failures are silently swallowed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const IS_PROD = process.env.NODE_ENV === 'production';
const MIN_LEVEL = process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug');
const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
function shouldLog(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}
function write(level, service, msg, meta) {
    if (!shouldLog(level))
        return;
    try {
        const entry = {
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
        }
        else {
            // Human-readable for local dev
            const color = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' }[level];
            const reset = '\x1b[0m';
            const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            const line = `${color}[${level.toUpperCase()}]${reset} [${service}] ${msg}${metaStr}`;
            if (level === 'error')
                console.error(line);
            else if (level === 'warn')
                console.warn(line);
            else
                console.log(line);
        }
    }
    catch { /* never throw from logger */ }
}
function createLogger(service) {
    return {
        debug: (msg, meta) => write('debug', service, msg, meta),
        info: (msg, meta) => write('info', service, msg, meta),
        warn: (msg, meta) => write('warn', service, msg, meta),
        error: (msg, meta) => write('error', service, msg, meta),
    };
}
exports.logger = createLogger('app');
//# sourceMappingURL=logger.js.map