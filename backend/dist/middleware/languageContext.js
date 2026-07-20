"use strict";
/**
 * Language Engine Middleware
 *
 * Automatically attaches language context to every authenticated request.
 * Every route handler can read req.langContext without any extra code.
 *
 * Reads language from (priority order):
 *   1. X-App-Language header (sent by frontend on every request)
 *   2. UserSettings.appLanguage (from MongoDB)
 *   3. Default: 'hi'
 *
 * Attaches to req:
 *   req.langCode      — active language code ('en', 'hi', 'mwr', …)
 *   req.pageContext   — page context from X-Page-Context header
 *
 * This middleware is non-blocking — failures never stop the request.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.languageContextMiddleware = languageContextMiddleware;
const UserSettings_1 = require("../models/UserSettings");
const logger_1 = require("../utils/logger");
const log = (0, logger_1.createLogger)('langMiddleware');
const SUPPORTED_LANGS = new Set([
    'en', 'hi', 'mr', 'gu', 'pa', 'bn', 'as', 'or', 'te', 'ta', 'kn', 'ml',
    'ur', 'sa', 'kok', 'ks', 'mni', 'brx', 'doi', 'sat', 'mai', 'ne', 'sd',
    'raj', 'mwr', 'mew', 'dhu', 'hao', 'shk', 'bag', 'wag', 'mti', 'gdw', 'ahi', 'mlv',
]);
const VALID_CONTEXTS = new Set([
    'disease', 'soil', 'government', 'weather', 'market', 'crop', 'shop', 'ui',
]);
function languageContextMiddleware(req, _res, next) {
    // Read from header first (fastest path — no DB call)
    const headerLang = req.headers['x-app-language'];
    const headerCtx = req.headers['x-page-context'];
    req.langCode = (headerLang && SUPPORTED_LANGS.has(headerLang)) ? headerLang : 'hi';
    req.pageContext = (headerCtx && VALID_CONTEXTS.has(headerCtx)) ? headerCtx : undefined;
    // If no header lang and user is authenticated, try to load from UserSettings (async, non-blocking)
    if (!headerLang && req.user?.userId) {
        UserSettings_1.UserSettings.findOne({ userId: req.user.userId })
            .select('appLanguage')
            .lean()
            .then((settings) => {
            if (settings?.appLanguage && SUPPORTED_LANGS.has(settings.appLanguage)) {
                req.langCode = settings.appLanguage;
            }
        })
            .catch((err) => {
            log.debug('UserSettings lang lookup failed (non-fatal)', { error: err?.message });
        });
    }
    next();
}
//# sourceMappingURL=languageContext.js.map