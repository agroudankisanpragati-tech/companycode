"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bilingualErrorHandler = bilingualErrorHandler;
exports.requestTimeout = requestTimeout;
const BILINGUAL_ERRORS = {
    400: { en: 'Bad request. Please check your input.', hi: 'अनुरोध अमान्य है। कृपया अपना इनपुट जाँचें।' },
    401: { en: 'Unauthorized. Please login.', hi: 'अनधिकृत। कृपया लॉगिन करें।' },
    403: { en: 'Access denied.', hi: 'पहुँच अस्वीकृत।' },
    404: { en: 'Resource not found.', hi: 'संसाधन नहीं मिला।' },
    408: { en: 'Request timed out. Please try again.', hi: 'अनुरोध का समय समाप्त हो गया। कृपया पुनः प्रयास करें।' },
    413: { en: 'File too large. Maximum size is 10MB.', hi: 'फ़ाइल बहुत बड़ी है। अधिकतम आकार 10MB है।' },
    422: { en: 'Could not process the image. Please use a clearer photo.', hi: 'छवि प्रोसेस नहीं हो सकी। कृपया स्पष्ट फ़ोटो उपयोग करें।' },
    429: { en: 'Too many requests. Please wait a moment.', hi: 'बहुत अधिक अनुरोध। कृपया थोड़ी देर प्रतीक्षा करें।' },
    500: { en: 'Something went wrong. Please try again.', hi: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।' },
    502: { en: 'AI service temporarily unavailable. Please try again.', hi: 'AI सेवा अस्थायी रूप से अनुपलब्ध है। कृपया पुनः प्रयास करें।' },
    503: { en: 'Service unavailable. Please try again later.', hi: 'सेवा अनुपलब्ध है। कृपया बाद में पुनः प्रयास करें।' },
};
const NAMED_ERRORS = {
    MongoNetworkError: { status: 503, en: 'Database connection error. Please try again.', hi: 'डेटाबेस कनेक्शन त्रुटि। कृपया पुनः प्रयास करें।' },
    MongoTimeoutError: { status: 503, en: 'Database timeout. Please try again.', hi: 'डेटाबेस समय सीमा समाप्त। कृपया पुनः प्रयास करें।' },
    ValidationError: { status: 400, en: 'Validation failed. Please check your input.', hi: 'सत्यापन विफल। कृपया अपना इनपुट जाँचें।' },
    JsonWebTokenError: { status: 401, en: 'Invalid token. Please login again.', hi: 'अमान्य टोकन। कृपया पुनः लॉगिन करें।' },
    TokenExpiredError: { status: 401, en: 'Session expired. Please login again.', hi: 'सत्र समाप्त। कृपया पुनः लॉगिन करें।' },
    MulterError: { status: 413, en: 'File upload failed. Max size is 10MB.', hi: 'फ़ाइल अपलोड विफल। अधिकतम आकार 10MB है।' },
};
function bilingualErrorHandler(err, req, res, _next) {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message || err);
    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: BILINGUAL_ERRORS[413].en,
            hindi: BILINGUAL_ERRORS[413].hi,
        });
    }
    // Named error types
    const namedErr = NAMED_ERRORS[err.name];
    if (namedErr) {
        return res.status(namedErr.status).json({
            error: namedErr.en,
            hindi: namedErr.hi,
        });
    }
    // MongoDB duplicate key
    if (err.code === 11000) {
        return res.status(409).json({
            error: 'Duplicate entry. This record already exists.',
            hindi: 'डुप्लीकेट प्रविष्टि। यह रिकॉर्ड पहले से मौजूद है।',
        });
    }
    // Use provided status or 500
    const status = typeof err.status === 'number' ? err.status : 500;
    const bilingual = BILINGUAL_ERRORS[status] || BILINGUAL_ERRORS[500];
    res.status(status).json({
        error: err.message || bilingual.en,
        hindi: bilingual.hi,
    });
}
/** Timeout middleware — wraps route with a request timeout */
function requestTimeout(ms = 30000) {
    return (req, res, next) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: BILINGUAL_ERRORS[408].en,
                    hindi: BILINGUAL_ERRORS[408].hi,
                });
            }
        }, ms);
        res.on('finish', () => clearTimeout(timer));
        res.on('close', () => clearTimeout(timer));
        next();
    };
}
//# sourceMappingURL=errorHandler.js.map