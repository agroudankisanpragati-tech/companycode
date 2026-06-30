'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth, type UserRole } from '@/context/AuthContext';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam: UserRole = searchParams?.get('role') === 'shopkeeper' ? 'shopkeeper' : 'farmer';

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const googleLoginUrl = `/api/auth/google?role=${roleParam}`;

  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (rememberMe) localStorage.setItem('rememberedEmail', email.trim());
      else localStorage.removeItem('rememberedEmail');
      const user = await login(email, password, roleParam);
      router.push(`/dashboard/${user.role}`);
    } catch (err: any) {
      const msg = err?.message || '';
      setError(
        msg === 'Invalid credentials'
          ? "Incorrect email or password. Please register if you don't have an account."
          : msg || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_40px_rgba(16,185,129,0.10)] p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.png" alt="Logo" width={44} height={44} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Welcome back</h1>
            <p className="text-xs text-slate-500 capitalize">{roleParam} login</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="Email address"
            required
            aria-label="Email address"
            className="w-full h-11 px-4 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Password"
              required
              aria-label="Password"
              className="w-full h-11 px-4 pr-11 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <span className="text-sm text-slate-500">Remember me</span>
            </label>
            <Link href="/auth/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 text-white font-semibold text-sm shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 hover:-translate-y-0.5"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <a
          href={googleLoginUrl}
          className="w-full h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5"
        >
          <FcGoogle size={20} />
          Continue with Google
        </a>

        <p className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href={`/auth/register?role=${roleParam}`} className="text-emerald-600 hover:text-emerald-700 font-semibold">
            Create Account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          <Link href="/auth/role-select" className="hover:text-slate-600">
            Switch role (Farmer / Shopkeeper)
          </Link>
        </p>
      </div>
    </main>
  );
}
