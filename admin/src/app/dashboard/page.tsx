'use client';

import Link from 'next/link';
import { FaDatabase, FaLeaf, FaRobot, FaUsers, FaWarehouse, FaPhotoVideo } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard } from '@/components/admin/AdminUi';

export default function AdminDashboardPage() {
  const { overview } = useAdmin();

  const cards = [
    {
      href: '/users',
      title: 'Users',
      value: overview?.totals?.users ?? 0,
      icon: FaUsers,
      accent: 'from-cyan-500 to-blue-500',
    },
    {
      href: '/settings',
      title: 'Admins',
      value: overview?.totals?.admins ?? 0,
      icon: FaDatabase,
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      href: '/ai-analytics',
      title: 'AI Analytics',
      value: overview?.totals?.cropRecommendations ?? 0,
      icon: FaRobot,
      accent: 'from-purple-500 to-violet-500',
    },
    {
      href: '/listings',
      title: 'Listings',
      value: overview?.totals?.marketplaceListings ?? 0,
      icon: FaWarehouse,
      accent: 'from-fuchsia-500 to-pink-500',
    },
    {
      href: '/create-scheme',
      title: 'Govt Schemes',
      value: overview?.totals?.govtSchemes ?? 0,
      icon: FaLeaf,
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      href: '/create-gallery',
      title: 'Gallery',
      value: overview?.recentListings ? overview.recentListings.length : 0,
      icon: FaPhotoVideo,
      accent: 'from-violet-500 to-indigo-500',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="block h-full transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard title={card.title} value={card.value} icon={card.icon} accent={card.accent} />
          </Link>
        ))}
      </section>
    </div>
  );
}
