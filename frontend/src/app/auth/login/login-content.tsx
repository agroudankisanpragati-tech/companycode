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

    const { login, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isShopkeeper = roleParam === 'shopkeeper';
    const accentClass = isShopkeeper ? 'from-blue-600 to-cyan-700' : 'from-green-600 to-emerald-700';
    const ringClass = isShopkeeper ? 'focus:ring-blue-400' : 'focus:ring-green-400';

    // Google OAuth - uses /api proxy, works on localhost + production
    const googleLoginUrl = `/api/auth/google?role=${roleParam}`;

    // Restore remembered email
    useEffect(() => {
        const saved = localStorage.getItem('rememberedEmail');
        if (saved) {
            setEmail(saved);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email.trim());
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            const user = await login(email, password, roleParam);
            router.push(`/dashboard/${user.role}`);
        } catch (err: any) {
            const msg = err?.message || '';
            setError(
                msg === 'Invalid credentials'
                    ? 'Incorrect email or password. Please register first if you don\'t have an account.'
                    : msg || 'Login failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[url('/background%20img.jpg')] bg-cover bg-center flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-black/50" />

            <div className="relative z-10 w-full max-w-sm">
                <div className="rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md p-6 shadow-2xl">

                    {/* Logo + Title */}
                    <div className="flex items-center gap-3 mb-6">
                        <Image src="/logo.png" alt="Kisan Unnati" width={44} height={44} className="rounded-xl ring-2 ring-white/40" />
                        <div>
                            <p className="text-[11px] tracking-widest uppercase text-green-300">Kisan Unnati</p>
                            <h1 className="text-white font-bold text-lg leading-tight">
                                {isShopkeeper ? 'Shopkeeper Login' : 'Farmer Login'}
                            </h1>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/30 px-3 py-2 text-sm text-red-100">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/80 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                placeholder="your@email.com"
                                className={`w-full h-10 px-3 rounded-lg border border-white/25 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-white/80 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                    placeholder="Enter your password"
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
                        </div>

                        {/* Remember Me */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded accent-green-500"
                            />
                            <span className="text-sm text-white/70">Remember me</span>
                        </label>

                        <button
                            type="submit"
                            disabled={loading || isLoading}
                            className={`w-full h-10 rounded-lg bg-gradient-to-r ${accentClass} text-white font-semibold text-sm disabled:opacity-60 transition`}
                        >
                            {loading || isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 border-t border-white/20" />
                        <span className="text-xs text-white/50">or</span>
                        <div className="flex-1 border-t border-white/20" />
                    </div>

                    {/* Google Login */}
                    <a
                        href={googleLoginUrl}
                        className="w-full h-10 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
                    >
                        <FcGoogle size={20} />
                        Continue with Google
                    </a>

                    {/* Links */}
                    <div className="mt-5 text-center space-y-2">
                        <p className="text-sm text-white/60">
                            Don't have an account?{' '}
                            <Link href={`/auth/register?role=${roleParam}`} className="text-green-300 hover:text-green-200 font-semibold">
                                Create Account
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
