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
import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            langCode?: string;
            pageContext?: string;
        }
    }
}
export declare function languageContextMiddleware(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=languageContext.d.ts.map