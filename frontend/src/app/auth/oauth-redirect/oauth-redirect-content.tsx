"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const normalizeRole = (value: string | null) =>
    value === 'vendor' || value === 'shopkeeper' ? 'shopkeeper' : 'farmer';

export default function OAuthRedirectContent() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        async function finish() {
            if (!params) {
                router.replace('/auth/role-select');
                return;
            }

            const token = params.get('token');
            const role = normalizeRole(params.get('role'));

            if (!token) {
                router.replace(`/auth/login?role=${role}`);
                return;
            }

            try {
                localStorage.setItem('authToken', token);

                // Use Next.js proxy /api - works on both local and production
                const res = await fetch('/api/auth/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    localStorage.removeItem('authToken');
                    router.replace(`/auth/login?role=${role}`);
                    return;
                }

                const data = await res.json();
                if (data?.data) {
                    const freshRole = normalizeRole(data.data.role);
                    const user = {
                        id: data.data._id || data.data.id,
                        email: data.data.email,
                        name: data.data.name,
                        role: freshRole,
                        phone: data.data.phone,
                        avatar: data.data.avatar,
                        profileImage: data.data.profileImage,
                    };
                    localStorage.setItem('user', JSON.stringify(user));
                    window.dispatchEvent(new Event('auth-session-changed'));
                    router.replace(`/dashboard/${freshRole}`);
                } else {
                    router.replace(`/dashboard/${role}`);
                }
            } catch (err) {
                console.error('OAuth redirect error:', err);
                router.replace(`/auth/login?role=${role}`);
            }
        }

        finish();
    }, [params, router]);

    return (
        <main className="min-h-screen bg-[url('/background%20img.jpg')] bg-cover bg-center flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" />
            <div className="relative z-10 text-center">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent mb-4" />
                <p className="text-white text-lg font-semibold">Google se login ho raha hai...</p>
            </div>
        </main>
    );
}
