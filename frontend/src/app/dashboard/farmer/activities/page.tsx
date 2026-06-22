"use client";

import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';

function ActivitiesContent() {
  const activities = [
    { text: 'Sold 200 kg wheat at mandi', time: '3h ago' },
    { text: 'New recommendation available', time: '6h ago' },
    { text: 'Weather alert: Heavy rain', time: '1d ago' },
  ];

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Recent Activities</h1>
        <p className="text-sm text-gray-500 mb-4">All recent events and alerts</p>

        <div className="space-y-3">
          {activities.map((a, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
              <div>{a.text}</div>
              <div className="text-xs text-gray-400">{a.time}</div>
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

export default function ActivitiesPage() {
  return <ProtectedRoute><ActivitiesContent /></ProtectedRoute>;
}
