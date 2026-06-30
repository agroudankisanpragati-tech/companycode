"use strict";
/**
 * Reusable AI Translation Service
 * Translates any structured AI response into the requested Indian language.
 * Used by Disease Detection, Soil Health, AI Crop Advisor, AI Farm Manager, and all future AI modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_LANGUAGES = void 0;
exports.translateObject = translateObject;
exports.translateNestedObject = translateNestedObject;
const LANGUAGE_NAMES = {
    hi: 'Hindi (हिन्दी)',
    mr: 'Marathi (मराठी)',
    gu: 'Gujarati (ગુજરાતી)',
    pa: 'Punjabi (ਪੰਜਾਬੀ)',
    bn: 'Bengali (বাংলা)',
    as: 'Assamese (অসমীয়া)',
    or: 'Odia (ଓଡ଼ିଆ)',
    te: 'Telugu (తెలుగు)',
    ta: 'Tamil (தமிழ்)',
    kn: 'Kannada (ಕನ್ನಡ)',
    ml: 'Malayalam (മലയാളം)',
    ur: 'Urdu (اردو)',
    sa: 'Sanskrit (संस्कृतम्)',
    kok: 'Konkani (कोंकणी)',
    ks: 'Kashmiri (كٲشُر)',
    mni: 'Manipuri (মৈতৈলোন্)',
    brx: 'Bodo (बर\')',
    doi: 'Dogri (डोगरी)',
    mai: 'Maithili (मैथिली)',
    ne: 'Nepali (नेपाली)',
    sd: 'Sindhi (سنڌي)',
    raj: 'Rajasthani (राजस्थानी)',
    tcy: 'Tulu (ತುಳು)',
};
function getApiUrl() {
    return `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
}
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Kisan Pragati',
    };
}
/**
 * Translate a flat key-value object of string fields into the target language.
 * Numeric / non-string fields are passed through unchanged.
 * Returns the same shape as the input with all string values translated.
 */
async function translateObject(data, targetLang) {
    const langName = LANGUAGE_NAMES[targetLang];
    if (!langName)
        throw new Error(`Unsupported language code: ${targetLang}`);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY not configured');
    // Only translate non-empty string fields
    const fieldsToTranslate = {};
    const passthrough = {};
    for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'string' && val.trim()) {
            fieldsToTranslate[key] = val;
        }
        else {
            passthrough[key] = val;
        }
    }
    if (Object.keys(fieldsToTranslate).length === 0)
        return data;
    const prompt = `You are an expert agricultural translator for Indian farmers.

Translate ALL the following field values into ${langName}.
- Keep field keys exactly the same.
- Preserve numbered lists, line breaks, and formatting.
- Use simple, farmer-friendly language.
- Keep crop names, chemical names, and product names in their original form (do not translate proper nouns like "DAP", "Urea", "NPK").
- Return ONLY a valid JSON object with the same keys and translated values.

Fields to translate:
${JSON.stringify(fieldsToTranslate, null, 2)}`;
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        }),
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Translation API error: ${errText}`);
    }
    const resp = await response.json();
    const content = resp.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Empty translation response');
    const translated = JSON.parse(content);
    return { ...passthrough, ...translated };
}
/**
 * Translate a nested object (e.g. SoilReport with nested arrays/objects).
 * Flattens translatable leaf strings, translates them, then reassembles.
 */
async function translateNestedObject(data, targetLang) {
    const langName = LANGUAGE_NAMES[targetLang];
    if (!langName)
        throw new Error(`Unsupported language code: ${targetLang}`);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY not configured');
    const prompt = `You are an expert agricultural translator for Indian farmers.

Translate ALL human-readable string values in the following JSON into ${langName}.
Rules:
- Keep all JSON keys exactly the same.
- Translate only the values (strings), not keys.
- Preserve arrays — translate each string element individually.
- Keep numbers, booleans, and nulls unchanged.
- Keep crop names, chemical names, product names as-is (e.g. DAP, Urea, NPK, pH).
- Use simple, farmer-friendly language.
- Return ONLY a valid JSON object.

JSON to translate:
${JSON.stringify(data, null, 2)}`;
    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 6000,
            response_format: { type: 'json_object' },
        }),
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Translation API error: ${errText}`);
    }
    const resp = await response.json();
    const content = resp.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Empty translation response');
    return JSON.parse(content);
}
exports.SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_NAMES);
//# sourceMappingURL=translationService.js.map