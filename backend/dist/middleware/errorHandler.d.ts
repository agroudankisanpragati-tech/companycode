import { Request, Response, NextFunction } from 'express';
export declare function bilingualErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>> | undefined;
/** Timeout middleware — wraps route with a request timeout */
export declare function requestTimeout(ms?: number): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map