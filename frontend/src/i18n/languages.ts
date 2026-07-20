export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag used for Web Speech API */
  bcp47: string;
  /** For dialects that have no dedicated BCP-47, fall back to this code for TTS/STT */
  voiceFallback?: string;
  /** True for regional dialects (not ISO 639 standard languages) */
  isDialect?: boolean;
  region?: string;
}

export const LANGUAGES: Language[] = [
  // ── National / Official Languages ──────────────────────────────────────────
  { code: 'en',  name: 'English',    nativeName: 'English',       flag: '🇬🇧', dir: 'ltr', bcp47: 'en-IN' },
  { code: 'hi',  name: 'Hindi',      nativeName: 'हिन्दी',          flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN' },
  { code: 'mr',  name: 'Marathi',    nativeName: 'मराठी',           flag: '🇮🇳', dir: 'ltr', bcp47: 'mr-IN' },
  { code: 'gu',  name: 'Gujarati',   nativeName: 'ગુજરાતી',          flag: '🇮🇳', dir: 'ltr', bcp47: 'gu-IN' },
  { code: 'pa',  name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',           flag: '🇮🇳', dir: 'ltr', bcp47: 'pa-IN' },
  { code: 'bn',  name: 'Bengali',    nativeName: 'বাংলা',            flag: '🇮🇳', dir: 'ltr', bcp47: 'bn-IN' },
  { code: 'as',  name: 'Assamese',   nativeName: 'অসমীয়া',          flag: '🇮🇳', dir: 'ltr', bcp47: 'as-IN' },
  { code: 'or',  name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',            flag: '🇮🇳', dir: 'ltr', bcp47: 'or-IN' },
  { code: 'te',  name: 'Telugu',     nativeName: 'తెలుగు',           flag: '🇮🇳', dir: 'ltr', bcp47: 'te-IN' },
  { code: 'ta',  name: 'Tamil',      nativeName: 'தமிழ்',            flag: '🇮🇳', dir: 'ltr', bcp47: 'ta-IN' },
  { code: 'kn',  name: 'Kannada',    nativeName: 'ಕನ್ನಡ',            flag: '🇮🇳', dir: 'ltr', bcp47: 'kn-IN' },
  { code: 'ml',  name: 'Malayalam',  nativeName: 'മലയാളം',          flag: '🇮🇳', dir: 'ltr', bcp47: 'ml-IN' },
  { code: 'ur',  name: 'Urdu',       nativeName: 'اردو',            flag: '🇮🇳', dir: 'rtl', bcp47: 'ur-PK', voiceFallback: 'hi-IN' },
  { code: 'sa',  name: 'Sanskrit',   nativeName: 'संस्कृतम्',          flag: '🇮🇳', dir: 'ltr', bcp47: 'sa-IN', voiceFallback: 'hi-IN' },
  { code: 'kok', name: 'Konkani',    nativeName: 'कोंकणी',           flag: '🇮🇳', dir: 'ltr', bcp47: 'kok-IN', voiceFallback: 'mr-IN' },
  { code: 'ks',  name: 'Kashmiri',   nativeName: 'كٲشُر',           flag: '🇮🇳', dir: 'rtl', bcp47: 'ks-IN', voiceFallback: 'hi-IN' },
  { code: 'mni', name: 'Manipuri',   nativeName: 'মৈতৈলোন্',         flag: '🇮🇳', dir: 'ltr', bcp47: 'mni-IN', voiceFallback: 'bn-IN' },
  { code: 'brx', name: 'Bodo',       nativeName: "बर'",             flag: '🇮🇳', dir: 'ltr', bcp47: 'brx-IN', voiceFallback: 'hi-IN' },
  { code: 'doi', name: 'Dogri',      nativeName: 'डोगरी',           flag: '🇮🇳', dir: 'ltr', bcp47: 'doi-IN', voiceFallback: 'hi-IN' },
  { code: 'sat', name: 'Santali',    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',        flag: '🇮🇳', dir: 'ltr', bcp47: 'sat-IN', voiceFallback: 'hi-IN' },
  { code: 'mai', name: 'Maithili',   nativeName: 'मैथिली',          flag: '🇮🇳', dir: 'ltr', bcp47: 'mai-IN', voiceFallback: 'hi-IN' },
  { code: 'ne',  name: 'Nepali',     nativeName: 'नेपाली',           flag: '🇮🇳', dir: 'ltr', bcp47: 'ne-IN', voiceFallback: 'hi-IN' },
  { code: 'sd',  name: 'Sindhi',     nativeName: 'سنڌي',           flag: '🇮🇳', dir: 'rtl', bcp47: 'sd-IN', voiceFallback: 'hi-IN' },
  { code: 'tcy', name: 'Tulu',       nativeName: 'ತುಳು',            flag: '🇮🇳', dir: 'ltr', bcp47: 'tcy-IN', voiceFallback: 'kn-IN' },

  // ── Rajasthan Dialects (High Priority) ─────────────────────────────────────
  {
    code: 'raj', name: 'Rajasthani (Generic)', nativeName: 'राजस्थानी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan',
  },
  {
    code: 'mwr', name: 'Marwari', nativeName: 'मारवाड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Jodhpur / Barmer / Jaisalmer)',
  },
  {
    code: 'mew', name: 'Mewari', nativeName: 'मेवाड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Udaipur / Chittorgarh)',
  },
  {
    code: 'dhu', name: 'Dhundhari (Jaipuri)', nativeName: 'ढूंढाड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Jaipur / Dausa)',
  },
  {
    code: 'hao', name: 'Hadoti (Harauti)', nativeName: 'हाड़ौती',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Kota / Bundi / Baran)',
  },
  {
    code: 'shk', name: 'Shekhawati', nativeName: 'शेखावाटी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Sikar / Jhunjhunu / Churu)',
  },
  {
    code: 'bag', name: 'Bagri', nativeName: 'बागड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Hanumangarh / Ganganagar)',
  },
  {
    code: 'wag', name: 'Wagdi (Vagdi)', nativeName: 'वागड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Dungarpur / Banswara)',
  },
  {
    code: 'mti', name: 'Mewati', nativeName: 'मेवाती',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Alwar / Bharatpur)',
  },
  {
    code: 'gdw', name: 'Godwari', nativeName: 'गोड़वाड़ी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Pali / Sirohi)',
  },
  {
    code: 'ahi', name: 'Ahirwati', nativeName: 'अहीरवाटी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan (Rewari / Mahendragarh)',
  },
  {
    code: 'mlv', name: 'Malvi (Rajasthan)', nativeName: 'मालवी',
    flag: '🇮🇳', dir: 'ltr', bcp47: 'hi-IN', voiceFallback: 'hi-IN',
    isDialect: true, region: 'Rajasthan / Madhya Pradesh border',
  },
];

export const DEFAULT_LANGUAGE = 'en';

export function getLang(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Returns the BCP-47 tag to use for Web Speech API (TTS/STT) */
export function getVoiceBcp47(code: string): string {
  const lang = getLang(code);
  return lang.voiceFallback || lang.bcp47;
}

/** Returns true if the language code is non-English */
export function isNonEnglish(code: string): boolean {
  return code !== 'en';
}

/** Returns true if the code is a Rajasthan dialect */
export function isRajasthanDialect(code: string): boolean {
  return !!getLang(code).isDialect;
}
