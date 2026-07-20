'use client';

import { FaCheck, FaTimes } from 'react-icons/fa';

interface ToastProps {
  msg: string;
  type: 'success' | 'error';
}

export function Toast({ msg, type }: ToastProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
        type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
      }`}
      style={{ animation: 'slideUp 0.3s ease' }}
    >
      {type === 'success' ? <FaCheck size={13} /> : <FaTimes size={13} />}
      {msg}
    </div>
  );
}
