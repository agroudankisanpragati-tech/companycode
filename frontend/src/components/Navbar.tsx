'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FaBars, FaTimes, FaArrowRight, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/ai-assistant', label: 'AI Assistant' },
  { href: '/crop-advisory', label: 'Crop Advisory' },
  { href: '/disease-detection', label: 'Disease Detection' },
  { href: '/mandi-prices', label: 'Mandi Prices' },
  { href: '/farmer-stories', label: 'Farmer Stories' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <nav
      aria-label="Main navigation"
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(16,185,129,0.10)]'
          : 'bg-white/90 backdrop-blur-sm shadow-[0_1px_0_rgba(16,185,129,0.08)]'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            aria-label="Agrodan Kisan Pragati home"
            className="group flex items-center gap-2.5 flex-shrink-0"
          >
            <div className="overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-white p-1 shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5">
              <Image src="/logo.png" alt="Agrodan Kisan Pragati Logo" width={52} height={52} className="rounded-lg" />
            </div>

          </Link>

          {/* Desktop Nav */}
          <div className="hidden xl:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200/50'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <LanguageSelector variant="compact" />

            {!isLoading && isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/farmer/profile"
                  title={user?.name}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white font-bold">
                    {initials}
                  </span>
                  <span className="max-w-[90px] truncate">{user?.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100"
                >
                  <FaSignOutAlt size={12} />
                  Logout
                </button>
              </>
            ) : !isLoading ? (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50"
                >
                  Login
                </Link>
                <Link
                  href="/auth/role-select"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-500/40"
                >
                  Get Started
                  <FaArrowRight size={11} />
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="xl:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`xl:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mx-4 mb-4 rounded-2xl bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(16,185,129,0.12)] p-3">
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <span>{link.label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-emerald-400'}`} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 grid grid-cols-2 gap-2 pt-3" style={{ borderTop: 'none' }}>
            <div className="col-span-2">
              <LanguageSelector variant="compact" />
            </div>

            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/farmer/profile"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <FaUserCircle size={14} />
                  {user?.name?.split(' ')[0] ?? 'Profile'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                >
                  <FaSignOutAlt size={12} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Login
                </Link>
                <Link
                  href="/auth/role-select"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:shadow-lg"
                >
                  Get Started
                  <FaArrowRight size={11} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
