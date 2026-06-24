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
    const { requestEmailOtp, verifyEmailOtp, register, isLoading } = useAuth();

    const roleParam: UserRole = searchParams?.get('role') === 'shopkeeper' ? 'shopkeeper' : 'farmer';
    const isShopkeeper = roleParam === 'shopkeeper';
    const accentClass = isShopkeeper ? 'from-blue-600 to-cyan-700' : 'from-green-600 to-emerald-700';
    const ringClass = isShopkeeper ? 'focus:ring-blue-400' : 'focus:ring-green-400';

    // Google OAuth - uses /api proxy, works on localhost + production
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
            setOtpSent(true);
            setOtpVerified(false);
            setSuccess('OTP sent to your email. Enter the code to continue.');
            setDevOtp(data?.devOtp || '');
        } catch (err: any) {
            setError(err?.message || 'Failed to send OTP');
        } finally {
            setSendingOtp(false);
        }
    };

    const verifyOtp = async () => {
        if (!otp.trim()) { setError('Please enter the OTP'); return; }
        setVerifyingOtp(true); setError(''); setSuccess('');
        try {
            await verifyEmailOtp(email.trim(), otp.trim());
            setOtpVerified(true);
            setSuccess('Email verified! You can now create your account.');
        } catch (err: any) {
            setError(err?.message || 'Invalid OTP');
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpVerified) { setError('Please verify your email OTP before registering'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        if (isShopkeeper && !shopName.trim()) { setError('Please enter your shop name'); return; }

        setSubmitting(true); setError('');
        try {
            const user = await register({
                name: name.trim(),
                email: email.trim(),
                password,
                role: roleParam,
                shopName: isShopkeeper ? shopName.trim() : undefined,
                companyName: isShopkeeper ? shopName.trim() : undefined,
            }, roleParam);
            router.push(`/dashboard/${user.role}`);
        } catch (err: any) {
            setError(err?.message || 'Registration failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[url('/background%20img.jpg')] bg-cover bg-center flex items-center justify-center px-4 py-6">
            <div className="fixed inset-0 bg-black/50" />

            <div className="relative z-10 w-full max-w-sm">
                <div className="rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md p-6 shadow-2xl">

                    {/* Logo + Title */}
                    <div className="flex items-center gap-3 mb-5">
                        <Image src="/logo.png" alt="Kisan Unnati" width={44} height={44} className="rounded-xl ring-2 ring-white/40" />
                        <div>
                            <p className="text-[11px] tracking-widest uppercase text-green-300">Kisan Unnati</p>
                            <h1 className="text-white font-bold text-lg leading-tight">
                                {isShopkeeper ? 'Shopkeeper Registration' : 'Farmer Registration'}
                            </h1>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="mb-3 rounded-lg bg-red-500/20 border border-red-400/30 px-3 py-2 text-sm text-red-100">{error}</div>
                    )}
                    {success && (
                        <div className="mb-3 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-100">{success}</div>
                    )}
                    {devOtp && (
                        <div className="mb-3 rounded-lg bg-amber-500/20 border border-amber-400/30 px-3 py-2 text-sm text-amber-100">
                            Dev OTP: <strong>{devOtp}</strong>
                        </div>
                    )}

                    {/* Email Registration Form */}
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder={isShopkeeper ? 'Your full name' : 'Farmer name'}
                            className={`w-full h-10 px-3 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                            required
                        />

                        {isShopkeeper && (
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => { setShopName(e.target.value); setError(''); }}
                                placeholder="Shop name"
                                className={`w-full h-10 px-3 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                                required
                            />
                        )}

                        {/* Email + OTP Send */}
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); setOtpSent(false); setOtpVerified(false); }}
                                placeholder="Email address"
                                className={`flex-1 h-10 px-3 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                                required
                            />
                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={sendingOtp || isLoading}
                                className={`h-10 px-3 rounded-lg bg-gradient-to-r ${accentClass} text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60`}
                            >
                                {sendingOtp ? 'Sending...' : 'Send OTP'}
                            </button>
                        </div>

                        {/* OTP + Verify */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => { setOtp(e.target.value); setError(''); }}
                                placeholder="Enter OTP"
                                className={`flex-1 h-10 px-3 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                            />
                            <button
                                type="button"
                                onClick={verifyOtp}
                                disabled={verifyingOtp || !otpSent || otpVerified || isLoading}
                                className={`h-10 px-3 rounded-lg border text-sm font-semibold whitespace-nowrap transition
                                    ${otpVerified
                                        ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                                        : 'border-white/25 bg-white/10 text-white disabled:opacity-50'}`}
                            >
                                {verifyingOtp ? '...' : otpVerified ? '✓ Verified' : 'Verify'}
                            </button>
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="Password (min 6 characters)"
                                className={`w-full h-10 px-3 pr-10 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                            >
                                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || isLoading || !otpVerified}
                            className={`w-full h-10 rounded-lg bg-gradient-to-r ${accentClass} text-white font-semibold text-sm disabled:opacity-60 transition`}
                        >
                            {submitting || isLoading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 border-t border-white/20" />
                        <span className="text-xs text-white/50">or</span>
                        <div className="flex-1 border-t border-white/20" />
                    </div>

                    {/* Google Register */}
                    <a
                        href={googleRegisterUrl}
                        className="w-full h-10 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
                    >
                        <FcGoogle size={20} />
                        Continue with Google
                    </a>

                    {/* Links */}
                    <div className="mt-5 text-center space-y-2">
                        <p className="text-sm text-white/60">
                            Already have an account?{' '}
                            <Link href={`/auth/login?role=${roleParam}`} className="text-green-300 hover:text-green-200 font-semibold">
                                Sign In
                            </Link>
                        </p>
                        <p className="text-xs text-white/40">
                            <Link href="/auth/role-select" className="hover:text-white/60">
                                Switch role (Farmer / Shopkeeper)
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
