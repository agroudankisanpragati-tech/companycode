export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: Language[] = [
  { code: 'en',  name: 'English',    nativeName: 'English',      flag: '🇬🇧', dir: 'ltr' },
  { code: 'hi',  name: 'Hindi',      nativeName: 'हिन्दी',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'mr',  name: 'Marathi',    nativeName: 'मराठी',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'gu',  name: 'Gujarati',   nativeName: 'ગુજરાતી',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'pa',  name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'bn',  name: 'Bengali',    nativeName: 'বাংলা',           flag: '🇮🇳', dir: 'ltr' },
  { code: 'as',  name: 'Assamese',   nativeName: 'অসমীয়া',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'or',  name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',           flag: '🇮🇳', dir: 'ltr' },
  { code: 'te',  name: 'Telugu',     nativeName: 'తెలుగు',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'ta',  name: 'Tamil',      nativeName: 'தமிழ்',           flag: '🇮🇳', dir: 'ltr' },
  { code: 'kn',  name: 'Kannada',    nativeName: 'ಕನ್ನಡ',           flag: '🇮🇳', dir: 'ltr' },
  { code: 'ml',  name: 'Malayalam',  nativeName: 'മലയാളം',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'ur',  name: 'Urdu',       nativeName: 'اردو',           flag: '🇮🇳', dir: 'rtl' },
  { code: 'sa',  name: 'Sanskrit',   nativeName: 'संस्कृतम्',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'kok', name: 'Konkani',    nativeName: 'कोंकणी',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'ks',  name: 'Kashmiri',   nativeName: 'كٲشُر',          flag: '🇮🇳', dir: 'rtl' },
  { code: 'mni', name: 'Manipuri',   nativeName: 'মৈতৈলোন্',        flag: '🇮🇳', dir: 'ltr' },
  { code: 'brx', name: 'Bodo',       nativeName: "बर'",            flag: '🇮🇳', dir: 'ltr' },
  { code: 'doi', name: 'Dogri',      nativeName: 'डोगरी',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'sat', name: 'Santali',    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',       flag: '🇮🇳', dir: 'ltr' },
  { code: 'mai', name: 'Maithili',   nativeName: 'मैथिली',         flag: '🇮🇳', dir: 'ltr' },
  { code: 'ne',  name: 'Nepali',     nativeName: 'नेपाली',          flag: '🇮🇳', dir: 'ltr' },
  { code: 'sd',  name: 'Sindhi',     nativeName: 'سنڌي',          flag: '🇮🇳', dir: 'rtl' },
  { code: 'tcy', name: 'Tulu',       nativeName: 'ತುಳು',           flag: '🇮🇳', dir: 'ltr' },
  { code: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी',       flag: '🇮🇳', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

export function getLang(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
