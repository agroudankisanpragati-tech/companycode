'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: string; message: string; type: ToastType; }

let _add: ((m: string, t: ToastType) => void) | null = null;
export function toast(message: string, type: ToastType = 'success') { _add?.(message, type); }

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    _add = (message, type) => {
      const id = `${Date.now()}-${Math.random()}`;
      setItems(p => [...p, { id, message, type }]);
      setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 4000);
    };
    return () => { _add = null; };
  }, []);

  const remove = useCallback((id: string) => setItems(p => p.filter(x => x.id !== id)), []);
  const cfg = {
    success: { icon: CheckCircle, cls: 'bg-white border-emerald-200 text-gray-900', iconCls: 'text-emerald-500', bar: 'bg-emerald-500' },
    error:   { icon: XCircle,     cls: 'bg-white border-red-200 text-gray-900',     iconCls: 'text-red-500',     bar: 'bg-red-500' },
    info:    { icon: Info,         cls: 'bg-white border-blue-200 text-gray-900',    iconCls: 'text-blue-500',    bar: 'bg-blue-500' },
  };

  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      {items.map(item => {
        const { icon: Icon, cls, iconCls, bar } = cfg[item.type];
        return (
          <div key={item.id} className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl pointer-events-auto ${cls} animate-in slide-in-from-right-4 fade-in duration-300`}>
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconCls}`} />
            <span className="text-sm font-medium flex-1 leading-relaxed">{item.message}</span>
            <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
