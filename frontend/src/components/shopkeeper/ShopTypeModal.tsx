'use client';
import { useState } from 'react';
import { Sprout, Leaf } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Props {
  onComplete: (shopType: 'fertilizer' | 'nursery') => void;
}

export default function ShopTypeModal({ onComplete }: Props) {
  const [selected, setSelected] = useState<'fertilizer' | 'nursery' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API}/shopkeeper/select-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shopType: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onComplete(selected);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const options = [
    {
      type: 'fertilizer' as const,
      label: 'Fertilizer & Agricultural Input Shop',
      desc: 'Sell fertilizers, pesticides, seeds, and agricultural inputs',
      icon: Sprout,
      color: 'emerald',
    },
    {
      type: 'nursery' as const,
      label: 'Nursery & Plant Shop',
      desc: 'Sell plants, saplings, seeds, and gardening products',
      icon: Leaf,
      color: 'green',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="h-14 w-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Select Your Shop Category</h2>
          <p className="text-gray-500 text-sm mt-2">Choose the type of shop you operate. This cannot be changed later.</p>
        </div>

        <div className="space-y-3 mb-6">
          {options.map(opt => {
            const Icon = opt.icon;
            const active = selected === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => setSelected(opt.type)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${active ? 'text-emerald-700' : 'text-gray-800'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
                <div className={`ml-auto h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${active ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                  {active && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-emerald-200"
        >
          {loading ? 'Saving…' : 'Confirm Selection'}
        </button>
      </div>
    </div>
  );
}
