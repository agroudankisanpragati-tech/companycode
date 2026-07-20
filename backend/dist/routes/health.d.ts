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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=health.d.ts.map