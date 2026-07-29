'use client';

import Link from 'next/link';
import { FaSignOutAlt, FaUserCircle, FaTachometerAlt, FaCog, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import FarmerProfileModal from './FarmerProfileModal';
import LanguageSelector from './LanguageSelector';

export default function FarmerHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [openProfile, setOpenProfile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push('/auth/role-select');
  };

  const initials = (user?.name || 'F').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className="bg-white/75 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 flex items-center justify-between" style={{ height: '76px' }}>
          <div className="flex items-center gap-4">
            <div className="flex-none">
              <div className="w-28 h-full overflow-visible bg-white/0 flex items-center justify-center">
                <img src="/logo.png" alt="logo" className="h-12 md:h-16 w-auto object-contain" />
              </div>
            </div>

            <div className="flex-1">
              <div>
                <h1 className="text-lg md:text-2xl font-extrabold text-gray-900">Farmer Dashboard</h1>
                <p className="text-sm md:text-sm text-gray-600">Welcome back, <span className="font-semibold">{user?.name ?? 'Farmer'}</span></p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language selector — syncs with global LanguageContext */}
            <LanguageSelector variant="compact" />

            {/* User menu dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                title={user?.name}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-green-200 to-green-400 px-3 py-2 text-white hover:from-green-300 hover:to-green-500 shadow transition-all"
              >
                {(user as any)?.avatar || (user as any)?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(user as any).avatar || (user as any).photo} alt={user?.name || 'avatar'} className="w-6 h-6 rounded-full object-cover border-2 border-white" />
                ) : (
                  <span className="font-semibold text-sm">{initials}</span>
                )}
                <FaChevronDown className={`text-[10px] text-white/80 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <button
                    onClick={() => { setUserMenuOpen(false); setOpenProfile(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <FaUserCircle size={14} className="text-emerald-500" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard/farmer'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <FaTachometerAlt size={14} className="text-emerald-500" />
                    Go to Dashboard
                  </button>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <FaCog size={14} className="text-emerald-500" />
                    Settings
                  </Link>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <FarmerProfileModal open={openProfile} onClose={() => setOpenProfile(false)} />
    </>
  );
}
