/**
 * Structured Logger — Phase 7
 *
 * Single logger used by every backend service and route.
 * Outputs JSON in production, human-readable in development.
 * Never throws — logging failures are silently swallowed.
 */
export declare function createLogger(service: string): {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
};
export declare const logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
};
//# sourceMappingURL=logger.d.ts.map