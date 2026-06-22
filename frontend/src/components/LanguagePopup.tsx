'use client';

import { useState, useCallback } from 'react';
import { FaTimes, FaSearch, FaCheck, FaLeaf } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';

export default function LanguagePopup() {
  const { languages, langCode, setLanguage, dismissPopup, t } = useLanguage();
  const [selected, setSelected] = useState(langCode);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(query.toLowerCase()),
  );

  const handleContinue = useCallback(async () => {
    setSaving(true);
    await setLanguage(selected, true);
    dismissPopup();
    setSaving(false);
  }, [selected, setLanguage, dismissPopup]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 p-8 text-white text-center flex-shrink-0">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <FaLeaf className="text-3xl text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {t('language', 'welcomeTitle', 'Welcome to Kisan Pragati')}
          </h2>
          <p className="text-emerald-50/90 text-sm">
            {t('language', 'welcomeSubtitle', 'Choose your preferred language to get started')}
          </p>
          {/* Dismiss X */}
          <button
            onClick={dismissPopup}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <FaTimes className="text-white text-sm" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-5 pb-3 flex-shrink-0">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder={t('language', 'searchPlaceholder', 'Search language...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
            />
          </div>
        </div>

        {/* Language grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((lang) => {
              const active = selected === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelected(lang.code)}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{lang.flag}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{lang.nativeName}</div>
                    <div className="text-[10px] text-gray-500 truncate">{lang.name}</div>
                  </div>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <FaCheck className="text-white text-[8px]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No languages found</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            onClick={dismissPopup}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors font-medium"
          >
            {t('language', 'skipBtn', 'Skip')}
          </button>
          <button
            onClick={handleContinue}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
          >
            {saving ? '...' : t('language', 'continueBtn', 'Continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
