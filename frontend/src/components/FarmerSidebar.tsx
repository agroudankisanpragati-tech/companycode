'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  FaLeaf, FaCloudSun, FaShoppingCart, FaTags, FaUser, FaTachometerAlt,
  FaRobot, FaSeedling, FaMicroscope, FaGavel, FaUsers, FaBookOpen,
  FaGift, FaBell, FaCog, FaMapMarkerAlt, FaChevronRight, FaTimes, FaGlobe,
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { useAIAssistant } from '@/context/AIAssistantContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

export default function FarmerSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user } = useAuth();
  const { toggleAssistant } = useAIAssistant();
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { key: 'dashboard',    href: '/dashboard/farmer',                icon: FaTachometerAlt },
    { key: 'myCrops',      href: '/dashboard/farmer/my-crops',       icon: FaSeedling },
    { key: 'aiAdvisor',    href: '/crop-recommendation',             icon: FaLeaf },
    { key: 'diseaseScan',  href: '/disease-detection',               icon: FaMicroscope },
    { key: 'weather',      href: '/weather',                         icon: FaCloudSun },
    { key: 'marketPrice',  href: '/dashboard/farmer/market',         icon: FaTags },
    { key: 'marketplace',  href: '/marketplace',                     icon: FaShoppingCart },
    { key: 'soilHealth',   href: '/dashboard/farmer/soil-health',    icon: FaLeaf },
    { key: 'govtSchemes',  href: '/schemes',                         icon: FaGavel },
    { key: 'community',    href: '/schemes',                         icon: FaUsers },
    { key: 'learning',     href: '/blog',                            icon: FaBookOpen },
    { key: 'rewards',      href: '/dashboard/farmer/rewards',        icon: FaGift },
    { key: 'notifications',href: '/dashboard/farmer/activities',     icon: FaBell },
    { key: 'profile',      href: '/dashboard/farmer/profile',        icon: FaUser },
    { key: 'settings',     href: '/settings',                        icon: FaCog },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (expanded && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const avatarSrc = user?.profileImage
    ? (user.profileImage.startsWith('/uploads') ? `${API_BASE}${user.profileImage}` : user.profileImage)
    : (user?.avatar || null);

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'KP';

  return (
    <>
      {/* Mobile overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 z-40 h-full flex flex-col
          bg-[linear-gradient(180deg,rgba(20,83,45,0.98)_0%,rgba(22,101,52,0.95)_50%,rgba(101,163,13,0.9)_100%)]
          border-r border-emerald-950/20 shadow-[0_24px_70px_rgba(22,101,52,0.3)] backdrop-blur-md
          md:relative md:flex-shrink-0
          ${expanded ? 'w-72' : 'w-16'}
        `}
        style={{
          transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.16),transparent_30%)]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 px-3 py-4 border-b border-white/10">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 via-emerald-500 to-green-800 text-white shadow-lg hover:scale-105 transition-transform"
            aria-label="Toggle sidebar"
          >
            <FaLeaf className="text-base" />
          </button>
          <span
            className="text-sm font-extrabold text-white leading-tight whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transition: 'opacity 250ms ease 100ms',
              pointerEvents: expanded ? 'auto' : 'none',
            }}
          >
            Kisan Pragati
          </span>
          {expanded && (
            <button onClick={() => setExpanded(false)} className="ml-auto text-white/60 hover:text-white md:hidden">
              <FaTimes />
            </button>
          )}
        </div>

        {/* Avatar / Profile section — fully clickable → profile page */}
        <div
          className="relative flex items-center gap-3 px-3 py-3 border-b border-white/10 cursor-pointer group"
          onClick={() => router.push('/dashboard/farmer/profile')}
          title={t('sidebar', 'profile', 'Profile')}
        >
          <div
            className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-emerald-700 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/30 group-hover:ring-lime-300/60 transition-all duration-300"
          >
            {avatarSrc
              ? <img src={avatarSrc} alt={user?.name || 'Farmer'} className="h-full w-full object-cover" />
              : <span>{initials}</span>
            }
          </div>
          <div
            className="min-w-0"
            style={{
              opacity: expanded ? 1 : 0,
              transition: 'opacity 250ms ease 100ms',
              pointerEvents: expanded ? 'auto' : 'none',
            }}
          >
            <div className="text-sm font-semibold text-white truncate group-hover:text-lime-200 transition-colors">{user?.name ?? 'Farmer'}</div>
            <div className="flex items-center gap-1 text-xs text-emerald-100/70 truncate">
              <FaMapMarkerAlt className="text-lime-300 flex-shrink-0" />
              <span>{(user as any)?.location?.state || t('profile', 'unknownLocation', 'Location unknown')}</span>
            </div>
          </div>
          {/* Subtle arrow hint when expanded */}
          {expanded && (
            <FaChevronRight className="ml-auto text-xs text-white/30 group-hover:text-white/60 transition-colors" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {/* AI Assistant button */}
          <button
            onClick={toggleAssistant}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-emerald-50/90 hover:bg-white/10 active:bg-white/20 transition-colors duration-200 rounded-none"
          >
            <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lime-200">
              <FaRobot className="text-sm" />
            </span>
            <span
              className="text-sm whitespace-nowrap"
              style={{
                opacity: expanded ? 1 : 0,
                transition: 'opacity 200ms ease 80ms',
                pointerEvents: expanded ? 'auto' : 'none',
              }}
            >
              {t('sidebar', 'aiAssistant', 'AI Assistant')}
            </span>
            {expanded && <FaChevronRight className="ml-auto text-xs text-white/40" />}
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard/farmer' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 ${
                  active
                    ? 'bg-white/15 text-white font-semibold border-r-2 border-lime-300'
                    : 'text-emerald-50/85 hover:bg-white/10 active:bg-white/20'
                }`}
              >
                <span className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 ${active ? 'bg-white/20 shadow-sm' : 'bg-white/10'} text-lime-200`}>
                  <Icon className="text-sm" />
                </span>
                <span
                  className="text-sm whitespace-nowrap"
                  style={{
                    opacity: expanded ? 1 : 0,
                    transition: 'opacity 200ms ease 80ms',
                    pointerEvents: expanded ? 'auto' : 'none',
                  }}
                >
                  {t('sidebar', item.key, item.key)}
                </span>
                {expanded && active && <FaChevronRight className="ml-auto text-xs text-white/60" />}
              </Link>
            );
          })}

          {/* Language selector in sidebar */}
          {expanded && (
            <div className="px-3 py-1.5 mt-1 border-t border-white/10">
              <LanguageSelector variant="sidebar" />
            </div>
          )}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center px-3 py-2.5 text-emerald-50/90 hover:bg-white/10 transition-colors"
              title={t('settings', 'language', 'Language')}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-lime-200">
                <FaGlobe className="text-sm" />
              </span>
            </button>
          )}
        </nav>

        {/* Footer */}
        <div
          className="relative px-3 py-3 border-t border-white/10"
          style={{
            opacity: expanded ? 1 : 0,
            transition: 'opacity 200ms ease',
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-100/60 mb-1">
            {t('sidebar', 'needHelp', 'Need help?')}
          </div>
          <a href="mailto:agroudankisanpragati@gmail.com" className="text-xs text-white hover:text-lime-200 hover:underline transition-colors">
            {t('sidebar', 'contactUs', 'Contact us')}
          </a>
        </div>
      </aside>
    </>
  );
}
