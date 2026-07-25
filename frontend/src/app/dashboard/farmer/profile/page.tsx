'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import FarmerSidebar from '@/components/FarmerSidebar';
import FarmerFooter from '@/components/FarmerFooter';
import FarmerProfilePage from '@/components/farmer/FarmerProfilePage';
import { useVoiceGuide } from '@/hooks/useVoiceGuide';

function ProfileContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  useVoiceGuide('profile');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/auth/login');
    else if (user?.role !== 'farmer') router.replace('/auth/role-select');
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FarmerSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1">
          <FarmerProfilePage />
        </main>
        <FarmerFooter />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
