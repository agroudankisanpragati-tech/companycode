'use client';

import Link from 'next/link';
import { FaBlog, FaDatabase, FaLeaf, FaNewspaper, FaRobot, FaSyncAlt, FaUsers, FaWarehouse, FaPhotoVideo } from 'react-icons/fa';
import { useAdmin } from '@/components/admin/AdminProvider';
import { StatCard, TableShell } from '@/components/admin/AdminUi';

export default function AdminDashboardPage() {
  const { overview } = useAdmin();

  const cards = [
    {
      href: '/users',
      title: 'Users',
      value: 1,
      icon: FaUsers,
      accent: 'from-cyan-500 to-blue-500',
    },
    {
      href: '/settings',
      title: 'Admins',
      value: 1,
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
      value: 0,
      icon: FaWarehouse,
      accent: 'from-fuchsia-500 to-pink-500',
    },
    {
      href: '/create-scheme',
      title: 'Schemes',
      value: 0,
      icon: FaNewspaper,
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      href: '/create-blog',
      title: 'Blogs',
      value: 3,
      icon: FaBlog,
      accent: 'from-rose-500 to-orange-500',
    },
    {
      href: '/create-gallery',
      title: 'Gallery',
      value: overview?.recentListings ? overview.recentListings.length : 0,
      icon: FaPhotoVideo,
      accent: 'from-violet-500 to-indigo-500',
    },
    {
      href: '/banner-video',
      title: 'Banner Video',
      value: 0,
      icon: FaSyncAlt,
      accent: 'from-yellow-400 to-amber-500',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="block h-full transition-transform duration-200 hover:-translate-y-0.5">
            <StatCard title={card.title} value={card.value} icon={card.icon} accent={card.accent} />
          </Link>
        ))}
      </section>
      <div className="flex justify-end">
        <Link href="/blogs" className="admin-button-primary">View All Blogs</Link>
      </div>
    </div>
  );
}
