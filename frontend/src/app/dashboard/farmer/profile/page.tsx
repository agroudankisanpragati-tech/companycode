"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import FarmerProfileModal from '@/components/farmer/FarmerProfileModal';

function ProfilePageContent() {
  const router = useRouter();

  // If someone lands directly on /dashboard/farmer/profile, redirect back
  // to dashboard and let the dashboard handle the modal
  // We render the modal here as an overlay over whatever is behind
  return (
    <FarmerProfileModal
      open={true}
      onClose={() => router.push('/dashboard/farmer')}
    />
  );
}

export default function Page() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}
