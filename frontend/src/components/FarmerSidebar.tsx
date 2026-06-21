'use client';
import Link from 'next/link';
import { FaLeaf, FaCloudSun, FaShoppingCart, FaChartLine, FaUser, FaTachometerAlt, FaRobot, FaSeedling, FaMicroscope, FaTags, FaGavel, FaUsers, FaBookOpen, FaGift, FaWallet, FaBell, FaCog, FaMapMarkerAlt } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { useAIAssistant } from '@/context/AIAssistantContext';

export default function FarmerSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user } = useAuth();
  const { toggleAssistant } = useAIAssistant();

  return (
    <aside className="w-80 flex-shrink-0">
      <div className="relative min-h-full flex flex-col justify-between bg-[linear-gradient(180deg,rgba(20,83,45,0.98)_0%,rgba(22,101,52,0.95)_38%,rgba(101,163,13,0.9)_78%,rgba(220,252,231,0.92)_100%)] border-r border-emerald-950/20 p-4 shadow-[0_24px_70px_rgba(22,101,52,0.3)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(132,204,22,0.16),transparent_30%)]" />
        <div>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 via-emerald-500 to-green-800 text-white shadow-[0_8px_20px_rgba(20,83,45,0.22)]">
              <FaLeaf className="text-lg" />
            </div>
            <div className="text-lg font-extrabold leading-tight text-white">Agroudan Kisan Pragati</div>
          </div>


          <div className="mb-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white/6 border border-white/10 p-4 shadow-sm text-center">
              <div className="flex-shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <img src="/FARMER%20DESK%20IMH/default%20farmer.png" alt="Farmer" className="h-20 w-20 rounded-full object-cover" />
                )}
              </div>
              <div className="mt-1">
                <div className="text-sm font-semibold text-white">{user?.name ?? 'Farmer'}</div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-emerald-100/80">
                <FaMapMarkerAlt className="text-sm text-lime-200" />
                <span>{(user as any)?.location?.state || (user as any)?.location || 'Location unknown'}</span>
              </div>
            </div>
          </div>

          {/* Feature links (now below profile) */}
          <div className="mt-2 mb-4 pt-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/75">Features</div>
            <div className="space-y-2">
              {[
                { title: 'Dashboard', href: '/dashboard/farmer', icon: <FaTachometerAlt />, action: null },
                { title: 'AI Assistant', href: null, icon: <FaRobot />, action: toggleAssistant },
                { title: 'AI Crop Advisor', href: '/crop-recommendation', icon: <FaLeaf />, action: null },
                { title: 'My Crops', href: '/dashboard/farmer/my-crops', icon: <FaSeedling />, action: null },
                { title: 'Disease Scan', href: '/disease-detection', icon: <FaMicroscope />, action: null },
                { title: 'Weather', href: '/weather', icon: <FaCloudSun />, action: null },
                { title: 'Market Price', href: '/dashboard/farmer/market', icon: <FaTags />, action: null },
                { title: 'Marketplace', href: '/marketplace', icon: <FaShoppingCart />, action: null },
                { title: 'Soil Health', href: '/dashboard/farmer/soil-health', icon: <FaLeaf />, action: null },
                { title: 'Government Scheme', href: '/schemes', icon: <FaGavel />, action: null },
                { title: 'Community', href: '/schemes', icon: <FaUsers />, action: null },
                { title: 'Learning Center', href: '/blog', icon: <FaBookOpen />, action: null },
                { title: 'Notifications', href: '/dashboard/farmer/activities', icon: <FaBell />, action: null },
                { title: 'Profile', href: '/dashboard/farmer/profile', icon: <FaUser />, action: null },
                { title: 'Settings', href: '/settings', icon: <FaCog />, action: null },
              ].map((f) => (
                f.action ? (
                  <button
                    key={f.title}
                    onClick={f.action}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-emerald-50/95 hover:bg-white/12 transition-colors text-left"
                  >
                    <span className="text-2xl text-lime-100">{f.icon}</span>
                    <span className="flex-1">{f.title}</span>
                    <span className="text-xs text-white/60">›</span>
                  </button>
                ) : (
                  <Link
                    key={f.title}
                    href={f.href!}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-emerald-50/95 hover:bg-white/12 transition-colors"
                  >
                    <span className="text-2xl text-lime-100">{f.icon}</span>
                    <span className="flex-1">{f.title}</span>
                    <span className="text-xs text-white/60">›</span>
                  </Link>
                )
              ))}
            </div>
          </div>

        </div>

        <div className="mt-6 rounded-2xl border border-white/15 bg-emerald-950/20 px-4 py-3 text-xs text-white shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50/90">Need help?</div>
              <a href="mailto:agroudankisanpragati@gmail.com" className="text-sm font-medium text-white hover:text-lime-100 hover:underline">Contact us</a>
            </div>
          </div>
        </div>

        {/* signed-in footer removed per user request */}
      </div>

                  
    </aside>
  );
}
