'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FaBars, FaTimes, FaArrowRight, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const baseLinks = [
    { href: '/', label: 'Home' },
    { href: '/crop-recommendation', label: '🌾 AI Crop Advisor' },
    { href: '/weather', label: 'Weather Forecast' },
    { href: '/mandi-prices', label: 'Market Prices' },
    { href: '/disease-detection', label: 'Disease Detection' },
  ];

  const authLinks = isAuthenticated
    ? [{ href: '/dashboard/farmer', label: 'Farmer Dashboard' }]
    : [];

  const navLinks = [
    ...baseLinks,
    ...authLinks,
    { href: '/contact', label: 'Contact Us' },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    router.push('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-100 bg-white/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(16,185,129,0.08)] w-full">
      <div className="section-container">
        <div className="flex items-center justify-between gap-3 py-3 md:py-4">
          <Link href="/" aria-label="Agroudan Kisan Pragati home" className="group flex items-center flex-shrink-0">
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-1.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5">
              <Image
                src="/logo.png"
                alt="Agroudan Kisan Pragati Logo"
                width={44}
                height={44}
                className="rounded-xl"
              />
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden xl:flex flex-1 items-center justify-center">
            <div className="inline-flex max-w-full flex-nowrap items-center justify-center gap-1 rounded-full border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/70 p-1.5 shadow-sm overflow-x-auto">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                        : 'text-slate-700 hover:bg-white hover:text-emerald-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Desktop auth actions */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <LanguageSelector variant="compact" />

            {!isLoading && isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/farmer/profile"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
                  title={user?.name}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white font-bold">
                    {initials}
                  </span>
                  <span className="max-w-[100px] truncate">{user?.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50"
                >
                  <FaSignOutAlt size={13} />
                  Logout
                </button>
              </>
            ) : !isLoading ? (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/role-select"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Get Started
                  <FaArrowRight size={12} />
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="lg:hidden pb-4">
            <div className="rounded-3xl border border-emerald-100 bg-white p-3 shadow-[0_18px_50px_rgba(16,185,129,0.08)] animate-slideDown">
              <div className="grid gap-2">
                {navLinks.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                        active
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-emerald-50/60 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <span>{link.label}</span>
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-emerald-400'}`} />
                    </Link>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard/farmer/profile"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <FaUserCircle size={15} />
                      {user?.name?.split(' ')[0] ?? 'Profile'}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <FaSignOutAlt size={13} />
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                      onClick={() => setIsOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/role-select"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:shadow-lg"
                      onClick={() => setIsOpen(false)}
                    >
                      Get Started
                      <FaArrowRight size={12} />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
