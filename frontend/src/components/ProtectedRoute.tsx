'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait until session restore is complete before making any redirect decision
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  // Show spinner while session is being restored
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-emerald-700 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
