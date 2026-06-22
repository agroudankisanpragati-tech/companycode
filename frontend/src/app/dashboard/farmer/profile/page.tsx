"use client";

import FarmerProfile from '@/components/farmer/FarmerProfile';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function ProfileContent() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <FarmerProfile user={user} />
      </div>
    </div>
  );
}

export default function Page() {
  return <ProtectedRoute><ProfileContent /></ProtectedRoute>;
}
