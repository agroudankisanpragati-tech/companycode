"use client";

import Link from 'next/link';
import { FaRobot } from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';

function AiSuggestionsContent() {
  const suggestions = [
    'Apply nitrogen fertilizer to Block A next week.',
    'Sow short-duration millet variety for upcoming season.',
  ];

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center"><FaRobot /></div>
          <div>
            <h1 className="text-2xl font-semibold">AI Suggestions</h1>
            <p className="text-sm text-gray-500">Priority recommendations tailored for your farm</p>
          </div>
        </div>

        <div className="space-y-4">
          {suggestions.map((s, i) => (
            <div key={i} className="p-4 bg-white rounded-2xl shadow-sm border">
              <div className="text-sm text-gray-800">{s}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link href="/dashboard/farmer" className="text-sm text-emerald-600">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function AiSuggestionsPage() {
  return <ProtectedRoute><AiSuggestionsContent /></ProtectedRoute>;
}
