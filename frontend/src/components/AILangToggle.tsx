'use client';

import { useLanguage } from '@/context/LanguageContext';

export default function AILangToggle({ className = '' }: { className?: string }) {
  const { aiDisplayMode, setAiDisplayMode } = useLanguage();

  const options: { value: 'en' | 'hi' | 'both'; label: string }[] = [
    { value: 'en', label: 'EN' },
    { value: 'hi', label: 'हिं' },
    { value: 'both', label: 'EN+हिं' },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-full border border-emerald-200 bg-white overflow-hidden ${className}`}
      role="group"
      aria-label="AI response language display"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setAiDisplayMode(opt.value)}
          aria-pressed={aiDisplayMode === opt.value}
          className={`px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 ${
            aiDisplayMode === opt.value
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-emerald-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
