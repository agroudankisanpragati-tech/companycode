'use client';

import dynamic from 'next/dynamic';

const VoicePlayer = dynamic(() => import('./VoicePlayer'), { ssr: false });

export interface BilingualContent {
  english: string;
  hindi: string;
  timestamp?: string;
  source?: string;
}

interface BilingualCardProps {
  content: BilingualContent;
  /** 'en' | 'hi' | 'both' */
  display?: 'en' | 'hi' | 'both';
  showToggle?: boolean;
  showTTS?: boolean;
  className?: string;
}

export default function BilingualCard({
  content,
  display = 'both',
  showToggle = true,
  showTTS = true,
  className = '',
}: BilingualCardProps) {
  const showEn = display === 'en' || display === 'both';
  const showHi = display === 'hi' || display === 'both';

  return (
    <div className={`space-y-3 ${className}`}>
      {showEn && content.english && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">English</span>
            {showTTS && <VoicePlayer text={content.english} lang="en-IN" autoDetect={false} label="Listen" />}
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{content.english}</p>
        </div>
      )}

      {showHi && content.hindi && (
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">हिंदी</span>
            {showTTS && <VoicePlayer text={content.hindi} lang="hi-IN" autoDetect={false} label="सुनें" />}
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{content.hindi}</p>
        </div>
      )}
    </div>
  );
}
