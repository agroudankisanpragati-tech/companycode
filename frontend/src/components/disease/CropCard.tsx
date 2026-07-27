'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaMicrophone, FaStop, FaGlobe, FaChevronDown, FaCheck, FaTimes } from 'react-icons/fa';
import { LANGUAGES, getVoiceBcp47 } from '@/i18n/languages';

// Languages shown in the picker — national + all Rajasthan dialects
const DISPLAY_LANGS = LANGUAGES.filter(l =>
  [
    'en', 'hi', 'mr', 'gu', 'pa', 'ta', 'te', 'bn', 'kn', 'ml', 'or', 'as', 'ur',
    // Rajasthan dialects
    'raj', 'mwr', 'mew', 'dhu', 'hao', 'shk', 'bag', 'wag', 'mti', 'gdw', 'ahi', 'mlv',
    // Other
    'mai', 'doi',
  ].includes(l.code)
);

// ─── Comprehensive crop name dictionary ───────────────────────────────────────
// Covers Hindi, Marwari, Mewari, Dhundhari, Hadoti, Shekhawati, Bagri, Wagdi,
// Mewati, Godwari, Ahirwati, Malvi + all national languages (typed/spoken).
const CROP_TRANSLATIONS: Record<string, string> = {
  // =========================================================
  // YOLO Supported Crops (Exact Dataset Folder Names)
  // =========================================================

  // ---------- Black Gram ----------
  'black gram': 'Black_gram',
  'blackgram': 'Black_gram',
  'black_gram': 'Black_gram',
  'urad': 'Black_gram',
  'urd': 'Black_gram',
  'udad': 'Black_gram',
  'urad dal': 'Black_gram',
  'उड़द': 'Black_gram',
  'उरद': 'Black_gram',

  // ---------- Green Gram ----------
  'green gram': 'green_gram',
  'greengram': 'green_gram',
  'green_gram': 'green_gram',
  'mung': 'green_gram',
  'mung bean': 'green_gram',
  'moong': 'green_gram',
  'moong dal': 'green_gram',
  'मूंग': 'green_gram',
  'मूंग दाल': 'green_gram',

  // ---------- Corn / Maize ----------
  'corn': 'corn_maize',
  'maize': 'corn_maize',
  'corn maize': 'corn_maize',
  'corn_maize': 'corn_maize',
  'makka': 'corn_maize',
  'makai': 'corn_maize',
  'मक्का': 'corn_maize',
  'मकई': 'corn_maize',
  'मक्की': 'corn_maize',

  // ---------- Tomato ----------
  'tomato': 'Tomato',
  'tamatar': 'Tomato',
  'टमाटर': 'Tomato',

  // ---------- Pearl Millet / Bajra ----------
  'pearl millet': 'Pearl_Millet _Bajra',
  'pearlmillet': 'Pearl_Millet _Bajra',
  'pearl_millet': 'Pearl_Millet _Bajra',
  'pearl_millet_bajra': 'Pearl_Millet _Bajra',
  'pearl_millet _bajra': 'Pearl_Millet _Bajra',
  'millet': 'Pearl_Millet _Bajra',
  'bajra': 'Pearl_Millet _Bajra',
  'bajri': 'Pearl_Millet _Bajra',
  'bajara': 'Pearl_Millet _Bajra',
  'बाजरा': 'Pearl_Millet _Bajra',
  'बाजरो': 'Pearl_Millet _Bajra',
  'बाजरी': 'Pearl_Millet _Bajra',

  // ---------- Wheat ----------
  'wheat': 'wheat',
  'gehu': 'wheat',
  'gehun': 'wheat',
  'gehum': 'wheat',
  'gahu': 'wheat',
  'गेहूं': 'wheat',
  'गेहूँ': 'wheat',
  'गेंहू': 'wheat',
  'गूँ': 'wheat',
  'गूं': 'wheat',

  // =========================================================
  // Other Supported Crops (Non-YOLO)
  // =========================================================

  'rice': 'rice',
  'धान': 'rice',
  'चावल': 'rice',

  'potato': 'potato',
  'आलू': 'potato',

  'onion': 'onion',
  'प्याज': 'onion',

  'mustard': 'mustard',
  'सरसों': 'mustard',
  'राई': 'mustard',
  'तोरिया': 'mustard',

  'cotton': 'cotton',
  'कपास': 'cotton',
  'नरमो': 'cotton',

  'soybean': 'soybean',
  'सोयाबीन': 'soybean',

  'groundnut': 'groundnut',
  'peanut': 'groundnut',
  'मूंगफली': 'groundnut',
  'मूंगफल': 'groundnut',

  'sorghum': 'sorghum',
  'ज्वार': 'sorghum',
  'जुवार': 'sorghum',
  'जुआर': 'sorghum',

  'chickpea': 'chickpea',
  'चना': 'chickpea',
  'चणा': 'chickpea',
  'चणो': 'chickpea',

  'pea': 'pea',
  'मटर': 'pea',

  'brinjal': 'brinjal',
  'eggplant': 'brinjal',
  'बैंगन': 'brinjal',

  'chilli': 'chilli',
  'pepper': 'chilli',
  'मिर्च': 'chilli',
  'मिरची': 'chilli',
  'मिरच': 'chilli',

  'sugarcane': 'sugarcane',
  'गन्ना': 'sugarcane',

  'ginger': 'ginger',
  'अदरक': 'ginger',

  'turmeric': 'turmeric',
  'हल्दी': 'turmeric',

  'garlic': 'garlic',
  'लहसुन': 'garlic',
  'लसण': 'garlic',

  'spinach': 'spinach',
  'पालक': 'spinach',

  'cauliflower': 'cauliflower',
  'गोभी': 'cauliflower',

  'cabbage': 'cabbage',
  'पत्तागोभी': 'cabbage',

  'cucumber': 'cucumber',
  'ककड़ी': 'cucumber',

  'bottle gourd': 'bottle gourd',
  'लौकी': 'bottle gourd',

  'bitter gourd': 'bitter gourd',
  'करेला': 'bitter gourd',

  'okra': 'okra',
  'भिंडी': 'okra',

  'grape': 'grape',
  'अंगूर': 'grape',

  'mango': 'mango',
  'आम': 'mango',

  'banana': 'banana',
  'केला': 'banana',
  'केलो': 'banana',

  'papaya': 'papaya',
  'पपीता': 'papaya',

  'moth bean': 'moth bean',
  'मोठ': 'moth bean',

  'cluster bean': 'cluster bean',
  'ग्वार': 'cluster bean',

  'sesame': 'sesame',
  'तिल': 'sesame',

  'cumin': 'cumin',
  'जीरा': 'cumin',
  'जीरो': 'cumin',

  'coriander': 'coriander',
  'धनिया': 'coriander',
  'धाणो': 'coriander',

  'fenugreek': 'fenugreek',
  'मेथी': 'fenugreek',
  'मेथो': 'fenugreek',

  'carom': 'carom',
  'अजवाइन': 'carom',

  'psyllium': 'psyllium',
  'इसबगोल': 'psyllium',

  'lentil': 'lentil',
  'मसूर': 'lentil',

  'pigeon pea': 'pigeon pea',
  'अरहर': 'pigeon pea',
  'तुअर': 'pigeon pea',

  'sunflower': 'sunflower',
  'सूरजमुखी': 'sunflower',

  'castor': 'castor',
  'अरंडी': 'castor',

  'jute': 'jute',
  'जूट': 'jute',

  'flax': 'flax',

  'barley': 'barley',
  'जौ': 'barley',

  'oat': 'oat',
  'जई': 'oat'
};
/**
 * Convert any typed/spoken crop name (in any supported language/dialect)
 * to its English equivalent for the backend.
 */
export function toEnglishCropName(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  // Exact match first
  if (CROP_TRANSLATIONS[trimmed]) return CROP_TRANSLATIONS[trimmed];
  if (CROP_TRANSLATIONS[lower]) return CROP_TRANSLATIONS[lower];
  // Substring match
  for (const [key, val] of Object.entries(CROP_TRANSLATIONS)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return trimmed;
}

interface Props {
  value: string;
  onChange: (displayValue: string, englishValue: string) => void;
  selectedLangCode: string;
  onLangChange: (code: string) => void;
}

export default function CropCard({ value, onChange, selectedLangCode, onLangChange }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim]     = useState('');
  const [error, setError]         = useState('');
  const [langOpen, setLangOpen]   = useState(false);
  const recognitionRef = useRef<any>(null);
  const langRef        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const startListening = useCallback(() => {
    const win = window as any;
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) { setError('Voice not supported. Please use Chrome or Edge.'); return; }

    setError('');
    setInterim('');
    const rec = new SR();
    recognitionRef.current = rec;
    // Use getVoiceBcp47 so all dialects resolve correctly
    rec.lang = getVoiceBcp47(selectedLangCode);
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let final = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else inter += t;
      }
      setInterim(inter);
      if (final) {
        const display = final.trim();
        const english = toEnglishCropName(display);
        onChange(display, english);
        setInterim('');
      }
    };
    rec.onerror = (e: any) => {
      setError(e.error === 'not-allowed' ? 'Microphone access denied.' : 'Could not hear. Try again.');
      setListening(false);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.start();
  }, [selectedLangCode, onChange]);

  useEffect(() => () => stopListening(), [stopListening]);

  const selectedLang = DISPLAY_LANGS.find(l => l.code === selectedLangCode) || DISPLAY_LANGS[0];

  return (
    <div className="space-y-3">
      {/* Language Selector */}
      <div ref={langRef} className="relative">
        <button
          type="button"
          onClick={() => setLangOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-4 py-3 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60">
              <FaGlobe className="text-emerald-600 dark:text-emerald-400" size={13} aria-hidden="true" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Language / भाषा</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {selectedLang.flag} {selectedLang.nativeName} — {selectedLang.name}
                {selectedLang.isDialect && (
                  <span className="ml-1.5 text-[10px] font-normal text-emerald-500 dark:text-emerald-400">
                    ({selectedLang.region})
                  </span>
                )}
              </p>
            </div>
          </div>
          <FaChevronDown size={11} className={`text-emerald-500 transition-transform ${langOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {langOpen && (
          <div
            role="listbox"
            aria-label="Select language"
            className="absolute z-40 mt-1 w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slideDown"
          >
            <div className="max-h-64 overflow-y-auto">
              {/* National languages group */}
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">National Languages</p>
              {DISPLAY_LANGS.filter(l => !l.isDialect).map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={selectedLangCode === lang.code}
                  onClick={() => { onLangChange(lang.code); setLangOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition ${selectedLangCode === lang.code ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base">{lang.flag}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{lang.nativeName}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">{lang.name}</span>
                    </span>
                  </span>
                  {selectedLangCode === lang.code && <FaCheck className="text-emerald-500" size={11} aria-hidden="true" />}
                </button>
              ))}

              {/* Rajasthan dialects group */}
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-orange-500 uppercase tracking-widest border-t border-gray-100 dark:border-slate-700 mt-1">
                🏜️ Rajasthan Dialects
              </p>
              {DISPLAY_LANGS.filter(l => l.isDialect).map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={selectedLangCode === lang.code}
                  onClick={() => { onLangChange(lang.code); setLangOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20 transition ${selectedLangCode === lang.code ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base">{lang.flag}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{lang.nativeName}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">{lang.name}</span>
                      {lang.region && (
                        <span className="block text-[10px] text-orange-500 dark:text-orange-400">{lang.region}</span>
                      )}
                    </span>
                  </span>
                  {selectedLangCode === lang.code && <FaCheck className="text-orange-500" size={11} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Crop Name Input + Voice */}
      <div>
        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
          🌾 Crop Name <span className="text-red-500">*</span>
          <span className="ml-1 font-normal text-slate-400 dark:text-slate-500 text-xs">(Required)</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value, toEnglishCropName(e.target.value))}
              placeholder="Type or speak crop name..."
              aria-label="Crop name"
              className="w-full rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-400 dark:focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/30 transition-all"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange('', '')}
                aria-label="Clear crop name"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <FaTimes size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop listening' : `Speak crop name in ${selectedLang.nativeName}`}
            aria-pressed={listening}
            title={listening ? 'Stop listening' : 'Speak crop name'}
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              listening
                ? 'border-red-300 bg-red-500 text-white animate-pulse shadow-lg shadow-red-200 dark:shadow-red-900/40'
                : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:border-rose-400'
            }`}
          >
            {listening ? <FaStop size={14} aria-hidden="true" /> : <FaMicrophone size={16} aria-hidden="true" />}
          </button>
        </div>

        {interim && (
          <p className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-300 animate-pulse" aria-live="polite">
            🎤 {interim}
          </p>
        )}
        {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400" role="alert">{error}</p>}
        {listening && (
          <p className="mt-2 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium" aria-live="polite">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
            Listening in {selectedLang.nativeName}
            {selectedLang.isDialect && ` (${selectedLang.region})`}...
          </p>
        )}
        {value && !listening && (
          <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Sending to AI as: <span className="font-bold">{toEnglishCropName(value)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
