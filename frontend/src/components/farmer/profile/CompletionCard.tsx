'use client';

import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import type { FullProfile } from './types';
import { completionFields } from './types';

export default function CompletionCard({ profile }: { profile: FullProfile }) {
  const fields = completionFields(profile);
  const done = fields.filter(f => f.done).length;
  const pct = Math.round((done / fields.length) * 100);
  const missing = fields.filter(f => !f.done);

  const color =
    pct < 40 ? 'bg-red-500' : pct < 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor =
    pct < 40 ? 'text-red-600' : pct < 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-700">Profile Completion</span>
        <span className={`text-sm font-extrabold ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <FaCheckCircle size={11} /> Profile is complete!
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {missing.map(m => (
            <span
              key={m.label}
              className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5"
            >
              <FaExclamationCircle size={8} /> {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
