/**
 * Pragati AI Routes
 *
 * Unified AI endpoint that accepts text, voice, and image requests
 * from the website. Automatically detects request type, enriches
 * context with farmer/farm/crop profiles, routes through the
 * Pragati AI Controller, persists results to MongoDB, and returns
 * structured responses.
 *
 * Routes:
 *   POST /api/pragati-ai/text          — text query
 *   POST /api/pragati-ai/voice         — voice upload
 *   POST /api/pragati-ai/image         — image upload (disease detection)
 *   GET  /api/pragati-ai/history       — conversation history
 *   GET  /api/pragati-ai/health        — AI module health
 *   GET  /api/pragati-ai/status        — AI module status (admin)
 *   DELETE /api/pragati-ai/session/:id — end session
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=pragatiAI.d.ts.map