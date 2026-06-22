'use client';

import { useState, useRef, useEffect } from 'react';
import { FaGlobe, FaCheck, FaChevronDown } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'navbar' | 'sidebar' | 'settings' | 'compact';
  className?: string;
}

export default function LanguageSelector({ variant = 'navbar', className = '' }: LanguageSelectorProps) {
  const { lang, languages, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = async (code: string) => {
    await setLanguage(code, true);
    setOpen(false);
    setQuery('');
  };

  if (variant === 'compact') {
    return (
      <div ref={ref} className={`relative ${className}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          aria-label="Select language"
        >
          <span className="text-base">{lang.flag}</span>
          <span className="hidden sm:inline text-xs">{lang.code.toUpperCase()}</span>
          <FaChevronDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <DropdownPanel filtered={filtered} langCode={lang.code} query={query} setQuery={setQuery} onSelect={handleSelect} t={t} />}
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div ref={ref} className={`relative ${className}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-emerald-50/90 hover:bg-white/10 transition-colors rounded-lg"
        >
          <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <FaGlobe className="text-sm text-lime-200" />
          </span>
          <span className="text-sm whitespace-nowrap flex-1 text-left">
            {t('settings', 'language', 'Language')}
          </span>
          <span className="text-xs text-emerald-200/70">{lang.nativeName.slice(0, 6)}</span>
        </button>
        {open && (
          <div className="absolute left-14 bottom-0 z-50 w-72">
            <DropdownPanel filtered={filtered} langCode={lang.code} query={query} setQuery={setQuery} onSelect={handleSelect} t={t} />
          </div>
        )}
      </div>
    );
  }

  // navbar / settings variant (default)
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-emerald-100 bg-white hover:bg-emerald-50 text-sm font-medium text-emerald-700 transition-all"
        aria-label="Select language"
      >
        <FaGlobe className="text-emerald-500 text-base" />
        <span className="hidden sm:inline">{lang.nativeName}</span>
        <span className="text-base">{lang.flag}</span>
        <FaChevronDown className={`text-[10px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <DropdownPanel filtered={filtered} langCode={lang.code} query={query} setQuery={setQuery} onSelect={handleSelect} t={t} />}
    </div>
  );
}

// ─── Shared dropdown panel ────────────────────────────────────────────────────

function DropdownPanel({
  filtered, langCode, query, setQuery, onSelect, t,
}: {
  filtered: { code: string; name: string; nativeName: string; flag: string }[];
  langCode: string;
  query: string;
  setQuery: (q: string) => void;
  onSelect: (code: string) => void;
  t: (s: string, k: string, fb?: string) => string;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-slideDown">
      {/* search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <input
            autoFocus
            type="text"
            placeholder={t('language', 'searchPlaceholder', 'Search language...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
        </div>
      </div>
      {/* list */}
      <div className="max-h-60 overflow-y-auto">
        {filtered.map((l) => (
          <button
            key={l.code}
            onClick={() => onSelect(l.code)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-emerald-50 transition-colors ${langCode === l.code ? 'bg-emerald-50' : ''}`}
          >
            <span className="text-lg flex-shrink-0">{l.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{l.nativeName}</div>
              <div className="text-xs text-gray-500 truncate">{l.name}</div>
            </div>
            {langCode === l.code && <FaCheck className="text-emerald-500 text-xs flex-shrink-0" />}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">No results</p>
        )}
      </div>
    </div>
  );
}
