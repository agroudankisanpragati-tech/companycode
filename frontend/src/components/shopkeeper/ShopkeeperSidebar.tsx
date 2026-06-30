'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Store, Package, Star, ShoppingBag, BarChart3, Settings, LogOut, ChevronRight, X, Leaf, Shield, MapPin } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

export default function ShopkeeperSidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [shopType, setShopType] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = hovered || !!mobileOpen;

  useEffect(() => {
    const tok = localStorage.getItem('authToken');
    if (!tok) return;
    fetch(`${API}/shopkeeper/profile`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setShopType(d.profile.shopType);
          setVerificationStatus(d.profile.verificationStatus);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (hovered && ref.current && !ref.current.contains(e.target as Node)) setHovered(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [hovered]);

  const productHref = shopType === 'nursery'
    ? '/dashboard/shopkeeper/products/nursery'
    : '/dashboard/shopkeeper/products/fertilizer';

  const NAV = [
    { label: 'Dashboard', href: '/dashboard/shopkeeper', icon: LayoutDashboard },
    { label: 'Shop Profile', href: '/dashboard/shopkeeper/complete-profile', icon: Store },
    { label: 'My Products', href: productHref, icon: Package },
    { label: 'Orders', href: '/dashboard/shopkeeper/orders', icon: ShoppingBag },
    { label: 'Reviews', href: '/dashboard/shopkeeper/reviews', icon: Star },
    { label: 'Analytics', href: '/dashboard/shopkeeper/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/shopkeeper/settings', icon: Settings },
  ];

  const avatarSrc = user?.profileImage
    ? (user.profileImage.startsWith('/uploads') ? `${API_BASE}${user.profileImage}` : user.profileImage)
    : user?.avatar || null;
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'SK';

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => { setHovered(false); onClose?.(); }} />}
      <aside
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed top-0 left-0 z-40 h-full flex flex-col md:relative md:flex-shrink-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 border-r border-white/5 shadow-2xl"
        style={{ width: isOpen ? 256 : 64, transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(52,211,153,0.12),transparent)]" />

        <div className="flex items-center gap-3 px-3 py-4 border-b border-white/8">
          <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden" style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 180ms ease', whiteSpace: 'nowrap' }}>
            <p className="text-white font-bold text-sm leading-tight">Kisan Pragati</p>
            <p className="text-emerald-400 text-[11px]">
              {shopType === 'nursery' ? 'Nursery Shop' : shopType === 'fertilizer' ? 'Fertilizer Shop' : 'Shopkeeper Panel'}
            </p>
          </div>
          {mobileOpen && isOpen && (
            <button onClick={() => { setHovered(false); onClose?.(); }} className="ml-auto text-white/40 hover:text-white md:hidden p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => router.push('/dashboard/shopkeeper/complete-profile')}
          className="flex items-center gap-3 px-3 py-3 border-b border-white/8 hover:bg-white/5 transition-colors group text-left w-full"
        >
          <div className="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden bg-emerald-800 ring-2 ring-white/15 group-hover:ring-emerald-400/40 transition-all flex items-center justify-center">
            {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-white text-xs font-bold">{initials}</span>}
          </div>
          <div className="overflow-hidden flex-1" style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 180ms ease', whiteSpace: 'nowrap' }}>
            <p className="text-white text-sm font-medium truncate group-hover:text-emerald-300 transition-colors">{user?.name || 'Shopkeeper'}</p>
            <div className="flex items-center gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${verificationStatus === 'verified' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <p className="text-gray-400 text-[10px]">{verificationStatus === 'verified' ? 'Verified' : 'Unverified'}</p>
            </div>
          </div>
          {isOpen && <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 flex-shrink-0" />}
        </button>

        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard/shopkeeper' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 mx-1.5 rounded-xl my-0.5 transition-all duration-150 group ${active ? 'bg-emerald-500/15 text-emerald-300 shadow-sm' : 'text-gray-400 hover:bg-white/6 hover:text-gray-200'}`}
              >
                <span className={`flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-sm font-medium overflow-hidden" style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 160ms ease', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                {active && isOpen && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-1.5 py-3 border-t border-white/8">
          <button
            onClick={() => { logout(); router.push('/auth/login'); }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors group"
          >
            <span className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 group-hover:bg-red-500/10 transition-colors">
              <LogOut className="w-4 h-4" />
            </span>
            <span className="text-sm font-medium overflow-hidden" style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 160ms ease', whiteSpace: 'nowrap' }}>
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
