'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FaChartLine,
  FaCog,
  FaLeaf,
  FaLock,
  FaPhotoVideo,
  FaSignOutAlt,
  FaSyncAlt,
  FaTrash,
  FaUserShield,
  FaUsers,
  FaWarehouse,
  FaRobot,
  FaDatabase,
  FaMicroscope,
  FaFilm,
  FaNewspaper,
} from 'react-icons/fa';
import {
  API_BASE,
  loadAdminWorkspace,
  restoreSessionFromToken,
  requestJson,
  fetchWithTimeout,
  TOKEN_KEY,
} from './admin-api';
import type { AdminUser, Listing, Overview, Recommendation, SessionUser, UserSummary } from './admin-types';

type AdminContextValue = {
  session: SessionUser | null;
  token: string | null;
  loading: boolean;
  authError: string;
  error: string;
  success: string;
  pendingAction: string;
  overview: Overview | null;
  users: AdminUser[];
  userSummary: UserSummary | null;
  recommendations: Recommendation[];
  listings: Listing[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAll: () => Promise<void>;
  updateUserRole: (userId: string, role: AdminUser['role']) => Promise<void>;
  toggleVerification: (userId: string, verified: boolean) => Promise<void>;
  disableUser: (userId: string, isActive: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  deleteRecommendation: (recommendationId: string) => Promise<void>;
  updateListingStatus: (listingId: string, status: Listing['status']) => Promise<void>;
  deleteListing: (listingId: string) => Promise<void>;
  clearMessages: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

const navItems = [
  { href: '/blogs', label: 'Blogs', icon: FaNewspaper },
  { href: '/dashboard', label: 'Dashboard', icon: FaChartLine },
  { href: '/crop-knowledge-base', label: 'Crop Knowledge Base', icon: FaDatabase },
  { href: '/disease-knowledge-base', label: 'Disease Knowledge Base', icon: FaMicroscope },
  { href: '/create-scheme', label: 'Govt Schemes', icon: FaLeaf },
  { href: '/create-gallery', label: 'Gallery', icon: FaPhotoVideo },
  { href: '/users', label: 'Users', icon: FaUsers },
  { href: '/ai-analytics', label: 'AI Analytics', icon: FaRobot },
  { href: '/farmer-stories', label: 'Farmer Stories', icon: FaFilm },
  { href: '/shopkeeper-verification', label: 'Verification Center', icon: FaUserShield },
  { href: '/registered-shops', label: 'Registered Shops', icon: FaWarehouse },
  { href: '/settings', label: 'Settings', icon: FaCog },
];

const statCards = [
  { key: 'users', label: 'Users', icon: FaUsers, accent: 'from-cyan-500 to-blue-500' },
  { key: 'admins', label: 'Admins', icon: FaUserShield, accent: 'from-emerald-500 to-teal-500' },
  { key: 'cropRecommendations', label: 'Recommendations', icon: FaLeaf, accent: 'from-amber-400 to-orange-500' },
  { key: 'marketplaceListings', label: 'Listings', icon: FaWarehouse, accent: 'from-fuchsia-500 to-pink-500' },
] as const;

export const useAdmin = () => {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error('useAdmin must be used inside AdminProvider');
  }

  return context;
};

function LoadingScreen() {
  return (
    <div className="admin-shell flex min-h-screen items-center justify-center">
      <div className="glass-panel rounded-3xl px-6 py-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Loading admin workspace</p>
      </div>
    </div>
  );
}

function LoginView({
  onLogin,
  authError,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  authError: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="admin-shell min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-white/10 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-base font-semibold tracking-wide text-white">Kisan Unnati Admin</p>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-7xl items-center px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
          <h1 className="text-2xl font-semibold text-white">Login</h1>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              try {
                await onLogin(email, password);
              } catch {
                // Error state is already handled by the provider.
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <input
              className="admin-input"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="admin-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {authError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {authError}
              </div>
            ) : null}

            <button type="submit" className="admin-button-primary w-full py-3" disabled={submitting}>
              <FaLock />
              {submitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-sm text-slate-400 md:px-8">
        <p>© {new Date().getFullYear()} Kisan Unnati Admin</p>
      </footer>
    </div>
  );
}

function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdmin();

  useMemo(() => navItems.find((item) => pathname === item.href) || navItems[0], [pathname]);

  return (
    <div className="admin-shell min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-base font-semibold tracking-wide text-white">Kisan Unnati Admin</p>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  pathname === item.href
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={12} />
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 md:px-8">
        {children}
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-sm text-slate-400 md:px-8">
        <p>© {new Date().getFullYear()} Kisan Unnati Admin</p>
      </footer>
    </div>
  );
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [pendingAction, setPendingAction] = useState('');

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setAuthError('');
  };

  const refreshAll = async () => {
    if (!token) return;

    setError('');
    try {
      const workspace = await loadAdminWorkspace(token);
      setOverview(workspace.overview);
      setUsers(workspace.users);
      setUserSummary(workspace.userSummary ?? null);
      setRecommendations(workspace.recommendations);
      setListings(workspace.listings);
      setSuccess('Admin data refreshed');
    } catch (requestError) {
      const msg = requestError instanceof Error ? requestError.message : 'Unable to refresh data';
      setError(msg);

      // If token is invalid or expired, clear session and token so admin is prompted to login again
      if (/unauthorized|invalid|expired/i.test(msg)) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setSession(null);
      }
    }
  };

  const authenticate = async (authToken: string) => {
    const response = await restoreSessionFromToken(authToken);

    if (response.data.role !== 'admin') {
      throw new Error('Admin access required');
    }

    setSession(response.data);
    setToken(authToken);

    const workspace = await loadAdminWorkspace(authToken);
    setOverview(workspace.overview);
    setUsers(workspace.users);
    setUserSummary(workspace.userSummary ?? null);
    setRecommendations(workspace.recommendations);
    setListings(workspace.listings);
  };

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY);

    if (!savedToken) {
      setLoading(false);
      return;
    }

    // Safety net: if everything hangs for >15 seconds, stop loading and show login
    const safetyTimer = setTimeout(() => {
      console.warn('[AdminProvider] Safety timeout hit — clearing loading state');
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setSession(null);
      setError('Session load timed out. Please log in again.');
      setLoading(false);
    }, 15000);

    void (async () => {
      try {
        await authenticate(savedToken);
      } catch (requestError) {
        const msg = requestError instanceof Error ? requestError.message : 'Session expired';
        console.error('[AdminProvider] Session restore failed:', msg);
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setSession(null);
        setError(msg);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    clearMessages();
    setLoading(true);

    try {
      const response = await fetchWithTimeout(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, 10000).catch((networkErr: Error) => {
        console.error('[Admin Login] Network error:', networkErr);
        throw new Error(
          networkErr.name === 'AbortError'
            ? 'Login request timed out. Check if the backend is running on port 4000.'
            : 'Cannot reach the backend server. Make sure it is running on port 4000.'
        );
      });

      let payload: any = {};
      try {
        payload = await response.json();
      } catch {
        console.error('[Admin Login] Response is not JSON — status:', response.status);
        throw new Error(`Unexpected server response (HTTP ${response.status}). Check the backend logs.`);
      }

      if (!response.ok) {
        console.error('[Admin Login] HTTP error:', response.status, payload);
        throw new Error(payload.error || `Login failed (HTTP ${response.status})`);
      }

      if (payload.user?.role !== 'admin') {
        throw new Error('Only admin accounts can access this panel');
      }

      // Store token immediately so UI can proceed even if workspace load is slow
      const authToken: string = payload.token;
      window.localStorage.setItem(TOKEN_KEY, authToken);

      // Verify token and load workspace — errors here should NOT block the login
      try {
        await authenticate(authToken);
        setSuccess('Welcome back to the admin panel');
        console.log('[Admin Login] Success — workspace loaded');
      } catch (workspaceErr) {
        // Token is valid but workspace data failed — set session manually from login payload
        console.warn('[Admin Login] Workspace load failed, using login payload:', workspaceErr);
        setSession({
          id: payload.user?.id || payload.user?._id || '',
          name: payload.user?.name || '',
          email: payload.user?.email || '',
          role: payload.user?.role || 'admin',
          verified: payload.user?.verified ?? true,
        });
        setToken(authToken);
        setError('Dashboard data could not be loaded. Click Refresh to retry.');
      }
    } catch (requestError) {
      const msg = requestError instanceof Error ? requestError.message : 'Unable to login';
      console.error('[Admin Login] Final error:', msg);
      setAuthError(msg);
      throw requestError;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
    setOverview(null);
    setUsers([]);
    setUserSummary(null);
    setRecommendations([]);
    setListings([]);
    clearMessages();
  };

  const updateUserRole = async (userId: string, role: AdminUser['role']) => {
    if (!token) return;

    setPendingAction(`role-${userId}`);
    try {
      await requestJson('/admin/users/' + userId + '/role', token, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await refreshAll();
      setSuccess('User role updated');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update role');
    } finally {
      setPendingAction('');
    }
  };

  const toggleVerification = async (userId: string, verified: boolean) => {
    if (!token) return;

    setPendingAction(`verify-${userId}`);
    try {
      await requestJson('/admin/users/' + userId + '/verify', token, {
        method: 'PATCH',
        body: JSON.stringify({ verified }),
      });
      await refreshAll();
      setSuccess(verified ? 'User verified' : 'User unverified');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update verification');
    } finally {
      setPendingAction('');
    }
  };

  const disableUser = async (userId: string, isActive: boolean) => {
    if (!token) return;
    setPendingAction(`disable-${userId}`);
    try {
      await requestJson('/admin/users/' + userId + '/disable', token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await refreshAll();
      setSuccess(isActive ? 'User enabled' : 'User disabled');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update user status');
    } finally {
      setPendingAction('');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!token || !window.confirm('Delete this user permanently?')) return;

    setPendingAction(`delete-user-${userId}`);
    try {
      await requestJson('/admin/users/' + userId, token, { method: 'DELETE' });
      await refreshAll();
      setSuccess('User deleted');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete user');
    } finally {
      setPendingAction('');
    }
  };

  const deleteRecommendation = async (recommendationId: string) => {
    if (!token || !window.confirm('Delete this crop recommendation?')) return;

    setPendingAction(`delete-rec-${recommendationId}`);
    try {
      await requestJson('/admin/recommendations/' + recommendationId, token, { method: 'DELETE' });
      await refreshAll();
      setSuccess('Recommendation deleted');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete recommendation');
    } finally {
      setPendingAction('');
    }
  };

  const updateListingStatus = async (listingId: string, status: Listing['status']) => {
    if (!token) return;

    setPendingAction(`listing-${listingId}`);
    try {
      await requestJson('/admin/listings/' + listingId + '/status', token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refreshAll();
      setSuccess('Listing status updated');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update listing');
    } finally {
      setPendingAction('');
    }
  };

  const deleteListing = async (listingId: string) => {
    if (!token || !window.confirm('Delete this listing permanently?')) return;

    setPendingAction(`delete-listing-${listingId}`);
    try {
      await requestJson('/admin/listings/' + listingId, token, { method: 'DELETE' });
      await refreshAll();
      setSuccess('Listing deleted');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete listing');
    } finally {
      setPendingAction('');
    }
  };

  const contextValue: AdminContextValue = {
    session,
    token,
    loading,
    authError,
    error,
    success,
    pendingAction,
    overview,
    users,
    userSummary,
    recommendations,
    listings,
    login,
    logout,
    refreshAll,
    updateUserRole,
    toggleVerification,
    disableUser,
    deleteUser,
    deleteRecommendation,
    updateListingStatus,
    deleteListing,
    clearMessages,
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginView onLogin={login} authError={authError} />;
  }

  return (
    <AdminContext.Provider value={contextValue}>
      <AdminChrome>{children}</AdminChrome>
    </AdminContext.Provider>
  );
}
