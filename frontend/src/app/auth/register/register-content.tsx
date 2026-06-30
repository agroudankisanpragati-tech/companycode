'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useAuth, type UserRole } from '@/context/AuthContext';

export default function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { requestEmailOtp, verifyEmailOtp, register } = useAuth();

  const roleParam: UserRole = searchParams?.get('role') === 'shopkeeper' ? 'shopkeeper' : 'farmer';
  const isShopkeeper = roleParam === 'shopkeeper';
  const googleRegisterUrl = `/api/auth/google?role=${roleParam}`;

  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const sendOtp = async () => {
    if (!email.trim()) { setError('Please enter your email first'); return; }
    setSendingOtp(true); setError(''); setSuccess('');
    try {
      const data = await requestEmailOtp(email.trim());
      setOtpSent(true); setOtpVerified(false);
      setSuccess('OTP sent! Check your email.');
      setDevOtp(data?.devOtp || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP');
    } finally { setSendingOtp(false); }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { setError('Please enter the OTP'); return; }
    setVerifyingOtp(true); setError(''); setSuccess('');
    try {
      await verifyEmailOtp(email.trim(), otp.trim());
      setOtpVerified(true);
      setSuccess('Email verified!');
    } catch (err: any) {
      setError(err?.message || 'Invalid OTP');
    } finally { setVerifyingOtp(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) { setError('Please verify your email OTP first'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (isShopkeeper && !shopName.trim()) { setError('Please enter your shop name'); return; }
    setSubmitting(true); setError('');
    try {
      const user = await register({
        name: name.trim(), email: email.trim(), password, role: roleParam,
        shopName: isShopkeeper ? shopName.trim() : undefined,
        companyName: isShopkeeper ? shopName.trim() : undefined,
      }, roleParam);
      router.push(`/dashboard/${user.role}`);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_40px_rgba(16,185,129,0.10)] p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.png" alt="Logo" width={44} height={44} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Create Account</h1>
            <p className="text-xs text-slate-500 capitalize">{roleParam} registration</p>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
        {success && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        {devOtp && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Dev OTP: <strong>{devOtp}</strong></div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder={isShopkeeper ? 'Your full name' : 'Farmer name'}
            required
            aria-label="Full name"
            className="w-full h-11 px-4 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
          />

          {isShopkeeper && (
            <input
              type="text"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); setError(''); }}
              placeholder="Shop name"
              required
              aria-label="Shop name"
              className="w-full h-11 px-4 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
            />
          )}

          {/* Email + Send OTP */}
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setOtpSent(false); setOtpVerified(false); }}
              placeholder="Email address"
              required
              aria-label="Email address"
              className="flex-1 h-11 px-4 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
            />
            <button
              type="button"
              onClick={sendOtp}
              disabled={sendingOtp}
              className="h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60 hover:bg-emerald-700 transition-colors"
            >
              {sendingOtp ? '…' : 'Send OTP'}
            </button>
          </div>

          {/* OTP + Verify */}
          <div className="flex gap-2">
            <input
              type="text"
              value={otp}
              onChange={(e) => { setOtp(e.target.value); setError(''); }}
              placeholder="Enter OTP"
              aria-label="OTP code"
              className="flex-1 h-11 px-4 rounded-xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-sm"
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={verifyingOtp || !otpSent || otpVerified}
              className={`h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                otpVerified
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50'
              }`}
            >
              {verifyingOtp ? '…' : otpVerified ? '✓ Done' : 'Verify'}
            </button>
          </div>

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Password (min 6 characters)"
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

          <button
            type="submit"
            disabled={submitting || !otpVerified}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 text-white font-semibold text-sm shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 hover:-translate-y-0.5"
          >
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <a
          href={googleRegisterUrl}
          className="w-full h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5"
        >
          <FcGoogle size={20} />
          Continue with Google
        </a>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href={`/auth/login?role=${roleParam}`} className="text-emerald-600 hover:text-emerald-700 font-semibold">
            Login
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
