"use client";

import Link from 'next/link';
import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

function RewardsContent() {
  const [points, setPoints] = useState(1240);
  const [value, setValue] = useState(620);
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function redeem() {
    setRedeeming(true);
    setMessage(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${apiBase}/rewards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'demo-user', amount: 240 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Redeem failed');
      setPoints(data.points);
      setValue(Math.max(0, value - data.redeemedValue));
      setMessage(`Redeemed ₹ ${data.redeemedValue} successfully`);
    } catch (err: any) {
      setMessage(err?.message || 'Redeem failed');
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Reward Points</h1>
        <p className="text-sm text-gray-500 mb-4">Earned for sustainable practices</p>

        <div className="p-6 bg-white rounded-2xl border shadow-sm text-center">
          <div className="text-4xl font-bold text-amber-600">{points}</div>
          <div className="text-sm text-gray-500 mt-1">Redeemable ₹ {value}</div>
          <div className="mt-4">
            <button onClick={redeem} disabled={redeeming} className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
              {redeeming ? 'Redeeming…' : 'Redeem 240 points'}
            </button>
          </div>
          {message && <div className="mt-3 text-sm text-green-700">{message}</div>}
        </div>

        <div className="mt-6">
          <Link href="/dashboard/farmer" className="text-sm text-emerald-600">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function RewardsPage() {
  return <ProtectedRoute><RewardsContent /></ProtectedRoute>;
}
