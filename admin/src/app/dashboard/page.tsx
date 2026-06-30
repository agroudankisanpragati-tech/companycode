'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaDatabase, FaLeaf, FaRobot, FaUsers, FaWarehouse, FaPhotoVideo, FaStore, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard } from '@/components/admin/AdminUi';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function AdminDashboardPage() {
  const { overview } = useAdmin();
  const [shopStats, setShopStats] = useState<any>({});

  useEffect(() => {
    const tok = localStorage.getItem('authToken');
    fetch(`${API}/admin/shopkeeper/shop-stats`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(d => setShopStats(d))
      .catch(() => {});
  }, []);

  const cards = [
    { href: '/users', title: 'Users', value: overview?.totals?.users ?? 0, icon: FaUsers, accent: 'from-cyan-500 to-blue-500' },
    { href: '/settings', title: 'Admins', value: overview?.totals?.admins ?? 0, icon: FaDatabase, accent: 'from-emerald-500 to-teal-500' },
    { href: '/ai-analytics', title: 'AI Analytics', value: overview?.totals?.cropRecommendations ?? 0, icon: FaRobot, accent: 'from-purple-500 to-violet-500' },
    { href: '/listings', title: 'Listings', value: overview?.totals?.marketplaceListings ?? 0, icon: FaWarehouse, accent: 'from-fuchsia-500 to-pink-500' },
    { href: '/registered-shops', title: 'Total Shops', value: shopStats.total ?? 0, icon: FaStore, accent: 'from-amber-500 to-orange-500' },
    { href: '/shopkeeper-verification', title: 'Pending Verification', value: shopStats.pending ?? 0, icon: FaClock, accent: 'from-yellow-500 to-amber-500' },
    { href: '/registered-shops', title: 'Verified Shops', value: shopStats.verified ?? 0, icon: FaCheckCircle, accent: 'from-green-500 to-emerald-500' },
    { href: '/registered-shops', title: 'Total Products', value: shopStats.totalProducts ?? 0, icon: FaLeaf, accent: 'from-sky-500 to-cyan-500' },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="block h-full transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard title={card.title} value={card.value} icon={card.icon} accent={card.accent} />
          </Link>
        ))}
      </section>
    </div>
  );
}
