'use client';
import { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 transition-colors p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
