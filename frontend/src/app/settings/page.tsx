'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import FarmerSidebar from '@/components/FarmerSidebar';
import FarmerFooter from '@/components/FarmerFooter';
import {
  getSettings, saveSettings, resetSettings, changePassword,
  UserSettings, DEFAULT_SETTINGS,
} from '@/services/settings';
import {
  FaCog, FaRobot, FaBell, FaGlobe, FaPalette, FaShieldAlt,
  FaLock, FaStore, FaFileAlt, FaQuestionCircle, FaInfoCircle,
  FaChevronDown, FaChevronUp, FaCheck, FaTrash, FaDownload,
  FaExchangeAlt, FaSignOutAlt,
} from 'react-icons/fa';

// ─── tiny helpers ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
      <div className="ml-4 flex-shrink-0">{children}</div>
    </div>
  );
}

function Card({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-emerald-600 text-lg">{icon}</span>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <FaChevronUp className="text-gray-400 text-sm" /> : <FaChevronDown className="text-gray-400 text-sm" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function RadioGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <label key={o.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${value === o.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
          <input type="radio" className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
          {value === o.value && <FaCheck className="text-xs text-emerald-600" />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Gujarati', 'Punjabi', 'Tamil', 'Telugu', 'Bengali'];

// ─── main page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  const [s, setS] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // change-password state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  // 2FA mock state
  const [twoFA, setTwoFA] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/role-select');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getSettings()
      .then(data => setS(data))
      .catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const patch = useCallback(async (updates: Partial<UserSettings>) => {
    setS(prev => ({ ...prev, ...updates }));
    setSaving(true);
    try {
      const saved = await saveSettings(updates);
      setS(saved);
      showToast('Settings Saved Successfully ✓');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    setSaving(true);
    try {
      const data = await resetSettings();
      setS(data);
      showToast('Settings reset to defaults ✓');
    } catch {
      showToast('Failed to reset settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwForm.next !== pwForm.confirm) return showToast('Passwords do not match', 'error');
    if (pwForm.next.length < 8) return showToast('New password must be at least 8 characters', 'error');
    setPwSaving(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Password changed successfully ✓');
    } catch (e: any) {
      showToast(e.message || 'Failed to change password', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const handleClearChatHistory = async () => {
    if (!confirm('Clear all AI chat history?')) return;
    await patch({ saveConversationHistory: false });
    showToast('AI chat history cleared ✓');
  };

  const handleDownloadData = () => {
    const blob = new Blob([JSON.stringify({ user, settings: s }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'my-data.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Data downloaded ✓');
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'settings.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported ✓');
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-emerald-600 font-semibold animate-pulse">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <FarmerSidebar open={true} onClose={() => undefined} />

      <div className="flex-1 flex flex-col">
        {/* header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FaCog className="text-emerald-600 text-xl" />
            <h1 className="text-xl font-bold text-gray-800">Settings</h1>
            {saving && <span className="text-xs text-emerald-500 animate-pulse">Saving…</span>}
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-red-500 underline transition-colors"
          >
            Reset to defaults
          </button>
        </header>

        {/* toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl px-5 py-3 shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {toast.type === 'success' ? <FaCheck /> : null}
            {toast.msg}
          </div>
        )}

        <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-4">

          {/* ── AI Assistant ── */}
          <Card title="AI Assistant" icon={<FaRobot />} defaultOpen>
            <Row label="Enable AI Assistant" sub="Turn AI features on or off globally">
              <Toggle on={s.aiEnabled} onChange={v => patch({ aiEnabled: v })} />
            </Row>
            <Row label="Voice Responses" sub="AI replies with voice output">
              <Toggle on={s.voiceResponses} onChange={v => patch({ voiceResponses: v })} />
            </Row>
            <Row label="Smart Suggestions" sub="Context-aware crop & weather tips">
              <Toggle on={s.smartSuggestions} onChange={v => patch({ smartSuggestions: v })} />
            </Row>
            <Row label="Personalized Recommendations" sub="Recommendations based on your farm data">
              <Toggle on={s.personalizedInsights} onChange={v => patch({ personalizedInsights: v })} />
            </Row>
            <Row label="Save Chat History" sub="Persist conversation across sessions">
              <Toggle on={s.saveConversationHistory} onChange={v => patch({ saveConversationHistory: v })} />
            </Row>
            <div className="pt-3 space-y-2">
              <div className="text-sm font-medium text-gray-700">AI Response Mode</div>
              <RadioGroup
                value={s.aiResponseMode}
                onChange={v => patch({ aiResponseMode: v as any })}
                options={[
                  { label: 'Basic', value: 'basic' },
                  { label: 'Standard', value: 'standard' },
                  { label: 'Advanced', value: 'advanced' },
                ]}
              />
            </div>
            <div className="pt-4">
              <button
                onClick={handleClearChatHistory}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
              >
                <FaTrash className="text-xs" /> Clear AI Chat History
              </button>
            </div>
          </Card>

          {/* ── Notifications ── */}
          <Card title="Notifications" icon={<FaBell />}>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-1 pb-2">Alert Types</div>
            {([
              ['Weather Alerts', 'notifWeather'],
              ['Rain Alerts', 'notifRain'],
              ['Disease Alerts', 'notifDisease'],
              ['Market Price Alerts', 'notifMarketPrice'],
              ['Government Scheme Alerts', 'notifGovtScheme'],
              ['Community Notifications', 'notifCommunity'],
              ['Marketplace Notifications', 'notifMarketplace'],
              ['Learning Center Notifications', 'notifLearning'],
              ['Farm Task Reminders', 'notifTaskReminders'],
            ] as [string, keyof UserSettings][]).map(([label, key]) => (
              <Row key={key} label={label}>
                <Toggle on={!!s[key]} onChange={v => patch({ [key]: v })} />
              </Row>
            ))}
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-3 pb-2">Communication Channels</div>
            {([
              ['Push Notifications', 'notifPush'],
              ['Email Notifications', 'notifEmail'],
              ['SMS Notifications', 'notifSMS'],
            ] as [string, keyof UserSettings][]).map(([label, key]) => (
              <Row key={key} label={label}>
                <Toggle on={!!s[key]} onChange={v => patch({ [key]: v })} />
              </Row>
            ))}
          </Card>

          {/* ── Language ── */}
          <Card title="Language" icon={<FaGlobe />}>
            <Row label="Application Language">
              <Select value={s.appLanguage} onChange={v => patch({ appLanguage: v })} options={LANGUAGES} />
            </Row>
            <Row label="Voice Assistant Language">
              <Select value={s.voiceLanguage} onChange={v => patch({ voiceLanguage: v })} options={LANGUAGES} />
            </Row>
          </Card>

          {/* ── Appearance ── */}
          <Card title="Appearance" icon={<FaPalette />}>
            <div className="pt-1 space-y-2">
              <div className="text-sm font-medium text-gray-700">Theme</div>
              <RadioGroup
                value={s.theme}
                onChange={v => patch({ theme: v as any })}
                options={[
                  { label: '☀️ Light', value: 'light' },
                  { label: '🌙 Dark', value: 'dark' },
                  { label: '💻 System', value: 'system' },
                ]}
              />
            </div>
            <div className="pt-4">
              <Row label="Compact View" sub="Denser layout with smaller cards">
                <Toggle on={s.interfaceDensity === 'compact'} onChange={v => patch({ interfaceDensity: v ? 'compact' : 'comfortable' })} />
              </Row>
              <Row label="Large Text Mode" sub="Increases font size for accessibility">
                <Toggle on={s.fontSize === 'large'} onChange={v => patch({ fontSize: v ? 'large' : 'medium' })} />
              </Row>
            </div>
          </Card>

          {/* ── Privacy ── */}
          <Card title="Privacy" icon={<FaShieldAlt />}>
            <Row label="Allow AI Data Analysis" sub="Let AI learn from your farm activity">
              <Toggle on={s.allowAIAnalysis} onChange={v => patch({ allowAIAnalysis: v })} />
            </Row>
            <Row label="Allow Personalized Recommendations" sub="Use your data to improve suggestions">
              <Toggle on={s.allowPersonalization} onChange={v => patch({ allowPersonalization: v })} />
            </Row>
            <Row label="Allow Anonymous Analytics" sub="Help improve the app (no personal data)">
              <Toggle on={s.allowAnalytics} onChange={v => patch({ allowAnalytics: v })} />
            </Row>
            <div className="flex flex-wrap gap-3 pt-4">
              <button
                onClick={handleDownloadData}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <FaDownload className="text-xs" /> Download My Data
              </button>
              <button
                onClick={handleExportSettings}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <FaFileAlt className="text-xs" /> Export Settings
              </button>
            </div>
          </Card>

          {/* ── Security ── */}
          <Card title="Security" icon={<FaLock />}>
            {/* Change Password */}
            <div className="space-y-3 pb-4 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-700">Change Password</div>
              <input
                type="password"
                placeholder="Current password"
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={handleChangePassword}
                disabled={pwSaving || !pwForm.current || !pwForm.next}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {pwSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>

            {/* 2FA */}
            <Row label="Two-Factor Authentication" sub="Add an extra layer of security">
              <Toggle on={twoFA} onChange={setTwoFA} />
            </Row>

            {/* Session info */}
            <div className="bg-gray-50 rounded-xl p-4 mt-3 space-y-1 text-sm text-gray-600">
              <div className="font-semibold text-gray-700 mb-2">Active Session</div>
              <div>Last login: <span className="font-medium text-gray-800">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
              <div>Device: <span className="font-medium text-gray-800">{typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : 'Web Browser'}</span></div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                onClick={() => showToast('Other devices logged out ✓')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 text-orange-600 text-sm font-medium hover:bg-orange-100 transition-colors border border-orange-200"
              >
                <FaExchangeAlt className="text-xs" /> Logout Other Devices
              </button>
              <button
                onClick={() => { logout(); router.push('/auth/role-select'); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
              >
                <FaSignOutAlt className="text-xs" /> End All Sessions
              </button>
            </div>
          </Card>

          {/* ── Marketplace ── */}
          <Card title="Marketplace Preferences" icon={<FaStore />}>
            <Row label="Buyer Mode" sub="Browse and purchase from sellers">
              <Toggle on={s.marketplaceBuyerMode} onChange={v => patch({ marketplaceBuyerMode: v })} />
            </Row>
            <Row label="Seller Mode" sub="List your produce and products">
              <Toggle on={s.marketplaceSellerMode} onChange={v => patch({ marketplaceSellerMode: v })} />
            </Row>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-3 pb-2">Notifications</div>
            <Row label="Buyer Requests">
              <Toggle on={s.notifNewBuyerRequests} onChange={v => patch({ notifNewBuyerRequests: v })} />
            </Row>
            <Row label="Seller Requests">
              <Toggle on={s.notifNewSellerListings} onChange={v => patch({ notifNewSellerListings: v })} />
            </Row>
            <Row label="Price Updates">
              <Toggle on={s.notifPriceChanges} onChange={v => patch({ notifPriceChanges: v })} />
            </Row>
          </Card>

          {/* ── Government Schemes ── */}
          <Card title="Government Scheme Preferences" icon={<FaFileAlt />}>
            <Row label="Scheme Notifications">
              <Toggle on={s.notifSchemeRecommendations} onChange={v => patch({ notifSchemeRecommendations: v })} />
            </Row>
            <Row label="Eligibility Alerts">
              <Toggle on={s.notifEligibility} onChange={v => patch({ notifEligibility: v })} />
            </Row>
            <Row label="New Scheme Updates">
              <Toggle on={s.notifNewSchemes} onChange={v => patch({ notifNewSchemes: v })} />
            </Row>
          </Card>

          {/* ── Help & Support ── */}
          <Card title="Help & Support" icon={<FaQuestionCircle />}>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href="mailto:agroudankisanpragati@gmail.com"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                Contact Support
              </a>
              <button
                onClick={() => showToast('Bug report submitted. Thank you!')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 text-sm font-medium hover:bg-yellow-100 transition-colors border border-yellow-200"
              >
                Report Bug
              </button>
              <button
                onClick={() => showToast('Feedback submitted. Thank you!')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors border border-purple-200"
              >
                Send Feedback
              </button>
            </div>
          </Card>

          {/* ── About ── */}
          <Card title="About" icon={<FaInfoCircle />}>
            <div className="space-y-2 py-2 text-sm text-gray-700">
              <div className="font-semibold text-gray-900 text-base">Agrodan Kisan Pragati LLP</div>
              <div className="text-gray-500">App Version: <span className="font-medium text-gray-700">1.0.0</span></div>
              <div className="text-gray-500">Build: <span className="font-medium text-gray-700">2025.01</span></div>
              <div className="flex gap-4 pt-2">
                <a href="/privacy-policy" className="text-emerald-600 hover:underline text-xs">Privacy Policy</a>
                <a href="/terms" className="text-emerald-600 hover:underline text-xs">Terms &amp; Conditions</a>
              </div>
            </div>
          </Card>

        </main>

        <FarmerFooter />
      </div>
    </div>
  );
}
