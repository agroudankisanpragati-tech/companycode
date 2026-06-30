'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ShopkeeperSidebar from '@/components/shopkeeper/ShopkeeperSidebar';
import ShopTypeModal from '@/components/shopkeeper/ShopTypeModal';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function ShopkeeperLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.role !== 'shopkeeper') return;
    checkProfile();
  }, [isAuthenticated, isLoading, user, pathname]);

  const checkProfile = async () => {
    try {
      const tok = localStorage.getItem('authToken');
      const r = await fetch(`${API}/shopkeeper/profile`, { headers: { Authorization: `Bearer ${tok}` } });
      const d = await r.json();
      const profile = d.profile;

      if (!profile || !profile.shopType) {
        setShowTypeModal(true);
        setProfileChecked(true);
        return;
      }

      // redirect to complete-profile if not completed and not already there
      if (!profile.profileCompleted && !pathname?.includes('complete-profile')) {
        router.replace('/dashboard/shopkeeper/complete-profile');
        setProfileChecked(true);
        return;
      }

      setShowTypeModal(false);
      setProfileChecked(true);
    } catch {
      setProfileChecked(true);
    }
  };

  const handleTypeSelected = (shopType: 'fertilizer' | 'nursery') => {
    setShowTypeModal(false);
    router.push('/dashboard/shopkeeper/complete-profile');
  };

  if (isLoading || !profileChecked) return null;

  return (
    <div className="flex h-screen bg-gray-50/80 overflow-hidden">
      {showTypeModal && <ShopTypeModal onComplete={handleTypeSelected} />}
      <ShopkeeperSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 text-sm">Shopkeeper</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
