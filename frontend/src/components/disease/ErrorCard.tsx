'use client';

import { FaWifi, FaRedo, FaImage, FaRobot, FaSearch } from 'react-icons/fa';

type ErrorType = 'error' | 'warning' | 'empty' | 'network' | 'ai' | 'invalid_image' | 'backend' | 'fastapi' | 'crop_verification' | 'voice_guide';

interface Props {
  message: string;
  onRetry?: () => void;
  type?: ErrorType;
}

const CONFIG: Record<ErrorType, {
  emoji: string;
  icon?: React.ReactNode;
  title: string;
  titleHindi: string;
  bg: string;
  border: string;
  titleCls: string;
  msgCls: string;
  btnCls: string;
}> = {
  network: {
    emoji: '📡',
    icon: <FaWifi size={20} />,
    title: 'Service Unavailable',
    titleHindi: 'सेवा उपलब्ध नहीं',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    titleCls: 'text-amber-800 dark:text-amber-300',
    msgCls: 'text-amber-700 dark:text-amber-400',
    btnCls: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600',
  },
  ai: {
    emoji: '🤖',
    icon: <FaRobot size={20} />,
    title: 'AI Analysis Failed',
    titleHindi: 'AI विश्लेषण विफल',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    titleCls: 'text-purple-800 dark:text-purple-300',
    msgCls: 'text-purple-700 dark:text-purple-400',
    btnCls: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600',
  },
  invalid_image: {
    emoji: '🖼️',
    icon: <FaImage size={20} />,
    title: 'Invalid Image',
    titleHindi: 'अमान्य छवि',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    titleCls: 'text-orange-800 dark:text-orange-300',
    msgCls: 'text-orange-700 dark:text-orange-400',
    btnCls: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600',
  },
  empty: {
    emoji: '🔍',
    icon: <FaSearch size={20} />,
    title: 'No Results Found',
    titleHindi: 'कोई परिणाम नहीं',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    titleCls: 'text-slate-700 dark:text-slate-300',
    msgCls: 'text-slate-500 dark:text-slate-400',
    btnCls: 'bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600',
  },
  backend: {
    emoji: '🖥️',
    title: 'Backend Server Unavailable',
    titleHindi: 'बैकएंड सर्वर उपलब्ध नहीं',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    titleCls: 'text-red-800 dark:text-red-300',
    msgCls: 'text-red-700 dark:text-red-400',
    btnCls: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  },
  fastapi: {
    emoji: '🤖',
    title: 'AI Server Not Running',
    titleHindi: 'AI सर्वर चालू नहीं',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    titleCls: 'text-purple-800 dark:text-purple-300',
    msgCls: 'text-purple-700 dark:text-purple-400',
    btnCls: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600',
  },
  crop_verification: {
    emoji: '🌾',
    title: 'Crop Verification Failed',
    titleHindi: 'फसल सत्यापन विफल',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    titleCls: 'text-orange-800 dark:text-orange-300',
    msgCls: 'text-orange-700 dark:text-orange-400',
    btnCls: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600',
  },
  voice_guide: {
    emoji: '🔇',
    title: 'Voice Guide Unavailable',
    titleHindi: 'वॉयस गाइड उपलब्ध नहीं',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    titleCls: 'text-slate-700 dark:text-slate-300',
    msgCls: 'text-slate-500 dark:text-slate-400',
    btnCls: 'bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600',
  },
  error: {
    emoji: '❌',
    title: 'Something Went Wrong',
    titleHindi: 'कुछ गलत हुआ',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    titleCls: 'text-red-800 dark:text-red-300',
    msgCls: 'text-red-700 dark:text-red-400',
    btnCls: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  },
  warning: {
    emoji: '⚠️',
    title: 'Notice',
    titleHindi: 'सूचना',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    titleCls: 'text-amber-800 dark:text-amber-300',
    msgCls: 'text-amber-700 dark:text-amber-400',
    btnCls: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600',
  },
};

// Auto-detect error type from message
function detectType(message: string, provided: ErrorType): ErrorType {
  if (provided !== 'error') return provided;
  const lower = message.toLowerCase();
  // Accurate backend/service error classification — never show "No Internet" for local service failures
  if (lower.includes('backend server') || lower.includes('node') || lower.includes('port 4000') || lower.includes('econnrefused')) return 'backend';
  if (lower.includes('fastapi') || lower.includes('yolo') || lower.includes('ai server') || lower.includes('port 8000')) return 'fastapi';
  if (lower.includes('crop verification') || lower.includes('uploaded image belongs') || lower.includes('verify crop')) return 'crop_verification';
  if (lower.includes('voice guide')) return 'voice_guide';
  // Only classify as network if the message explicitly says internet/offline — NOT for connection refused
  if (lower.includes('internet') || lower.includes('offline') || lower.includes('no network')) return 'network';
  if (lower.includes('invalid') && lower.includes('image')) return 'invalid_image';
  if (lower.includes('ai') || lower.includes('model') || lower.includes('prediction')) return 'ai';
  if (lower.includes('no result') || lower.includes('not found') || lower.includes('empty')) return 'empty';
  return 'error';
}

export default function ErrorCard({ message, onRetry, type = 'error' }: Props) {
  const resolvedType = detectType(message, type);
  const c = CONFIG[resolvedType];

  return (
    <div className={`rounded-2xl border p-6 text-center ${c.bg} ${c.border} animate-fadeIn`}>
      <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${c.bg} border ${c.border}`}>
        <span className="text-3xl">{c.emoji}</span>
      </div>
      <p className={`font-extrabold text-base mb-0.5 ${c.titleCls}`}>{c.title}</p>
      <p className={`text-xs font-medium mb-2 ${c.titleCls} opacity-70`}>{c.titleHindi}</p>
      <p className={`text-sm leading-relaxed ${c.msgCls}`}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`mt-4 flex items-center gap-2 mx-auto rounded-xl px-6 py-2.5 text-sm font-bold text-white transition ${c.btnCls}`}
        >
          <FaRedo size={11} /> Try Again
        </button>
      )}
    </div>
  );
}
