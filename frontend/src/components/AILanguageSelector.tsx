'use client';

import { useState, useCallback } from 'react';
import { LANGUAGES } from '@/i18n/languages';
import { FaGlobe, FaSpinner, FaCheck } from 'react-icons/fa';

interface Props {
  recordId: string;
  module: 'disease' | 'soil' | 'crop-recommendation' | 'ai-fos';
  /** English source data — used as fallback and as payload for crop module */
  englishData?: Record<string, any>;
  /** Called with the translated data when a language is selected */
  onTranslated: (lang: string, data: Record<string, any>) => void;
  className?: string;
}

const MODULE_ENDPOINTS: Record<string, string> = {
  disease: '/api/disease/translate',
  soil: '/api/soil/translate',
  'crop-recommendation': '/api/crop-recommendation/translate',
  'ai-fos': '/api/ai-fos/translate',
};

const MODULE_ID_KEY: Record<string, string> = {
  disease: 'recordId',
  soil: 'recordId',
  'crop-recommendation': 'requestId',
  'ai-fos': 'activeCropId',
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Only show the 15 primary Indian languages + English
const DISPLAY_LANGS = ['en', 'hi', 'mr', 'gu', 'pa', 'ta', 'te', 'bn', 'kn', 'ml', 'or', 'as', 'ur', 'raj', 'sa', 'doi', 'mai'];
const LANG_LIST = LANGUAGES.filter((l) => DISPLAY_LANGS.includes(l.code));

export default function AILanguageSelector({ recordId, module: mod, englishData, onTranslated, className = '' }: Props) {
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState<Set<string>>(new Set(['en']));

  const handleSelect = useCallback(async (langCode: string) => {
    setSelectedLang(langCode);
    setError('');

    if (langCode === 'en') {
      if (englishData) onTranslated('en', englishData);
      return;
    }

    setLoading(true);
    try {
      const idKey = MODULE_ID_KEY[mod] || 'recordId';
      const body: Record<string, any> = { [idKey]: recordId, language: langCode };
      if (mod === 'crop-recommendation' && englishData?.recommendations) {
        body.recommendations = englishData.recommendations;
      }

      const res = await fetch(MODULE_ENDPOINTS[mod], {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Translation failed');

      setTranslated((prev) => new Set([...prev, langCode]));
      onTranslated(langCode, json.data);
    } catch (e: any) {
      setError(e.message || 'Translation failed. Please try again.');
      setSelectedLang('en');
    } finally {
      setLoading(false);
    }
  }, [recordId, mod, englishData, onTranslated]);

  return (
    <div className={`rounded-2xl border border-blue-100 bg-blue-50 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <FaGlobe className="text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Read in Your Language</span>
        {loading && <FaSpinner className="animate-spin text-blue-600 ml-1" />}
      </div>

      <div className="flex flex-wrap gap-2">
        {LANG_LIST.map((lang) => {
          const isSelected = selectedLang === lang.code;
          const isCached = translated.has(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              disabled={loading}
              title={lang.name}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow'
                  : 'border border-blue-200 bg-white text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.nativeName}</span>
              {isCached && lang.code !== 'en' && !isSelected && (
                <FaCheck className="text-emerald-500" size={9} />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {loading && (
        <p className="mt-2 text-xs text-blue-600 animate-pulse">
          Generating translation... Please wait.
        </p>
      )}
    </div>
  );
}
