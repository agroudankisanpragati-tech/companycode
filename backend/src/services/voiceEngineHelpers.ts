/**
 * Voice Engine Helpers — Phase 6
 *
 * Backend-side BCP-47 resolution.
 * Mirrors the frontend getVoiceBcp47() from languages.ts
 * so the backend can resolve voice codes without importing frontend code.
 */

const LANG_BCP47: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN',
  bn: 'bn-IN', as: 'as-IN', or: 'or-IN', te: 'te-IN', ta: 'ta-IN',
  kn: 'kn-IN', ml: 'ml-IN', ur: 'hi-IN', sa: 'hi-IN', kok: 'mr-IN',
  ks: 'hi-IN', mni: 'bn-IN', brx: 'hi-IN', doi: 'hi-IN', sat: 'hi-IN',
  mai: 'hi-IN', ne: 'hi-IN', sd: 'hi-IN', tcy: 'kn-IN',
  // Rajasthan dialects → hi-IN fallback
  raj: 'hi-IN', mwr: 'hi-IN', mew: 'hi-IN', dhu: 'hi-IN', hao: 'hi-IN',
  shk: 'hi-IN', bag: 'hi-IN', wag: 'hi-IN', mti: 'hi-IN', gdw: 'hi-IN',
  ahi: 'hi-IN', mlv: 'hi-IN',
};

export function getVoiceBcp47ForCode(langCode: string): string {
  if (!langCode) return 'hi-IN';
  if (langCode.includes('-')) return langCode; // already BCP-47
  return LANG_BCP47[langCode] || 'hi-IN';
}
