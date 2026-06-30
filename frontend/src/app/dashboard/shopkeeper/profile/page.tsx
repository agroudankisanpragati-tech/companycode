'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';
import { Store, Camera, MapPin, Clock, Phone, Globe, Save, ArrowLeft, Plus, X, ChevronRight, Mail, MessageCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const CATEGORIES = ['Agriculture', 'Seeds & Fertilizers', 'Farm Equipment', 'Pesticides', 'Organic Products', 'Dairy', 'General Store', 'Other'];

export default function ShopProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [shopId, setShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopExists, setShopExists] = useState(false);
  const [imageInput, setImageInput] = useState('');
  const [form, setForm] = useState({
    name: '', category: 'Agriculture', phone: '', whatsapp: '', email: '',
    website: '', address: '', state: '', district: '', description: '',
    images: [] as string[], openHours: 'Mon-Sat: 9:00 AM - 6:00 PM',
  });

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    const sid = localStorage.getItem('myShopId');
    setShopId(sid);
    if (sid) loadShop(sid); else setLoading(false);
  }, [isAuthenticated]);

  const loadShop = async (sid: string) => {
    if (sid.startsWith('local-shop-')) {
      const raw = localStorage.getItem(`shopProfile_${sid}`);
      if (raw) {
        const s = JSON.parse(raw);
        setForm(f => ({ ...f, name: s.name || '', phone: s.phone || '', address: s.address || '', openHours: s.openHours || '', description: s.description || '', images: s.images || [], state: s.location?.state || '', district: s.location?.district || '' }));
        setShopExists(true);
      }
    } else {
      try {
        const r = await fetch(`${API}/shops/${sid}`);
        const d = await r.json();
        if (d.shop) {
          const s = d.shop;
          setForm(f => ({ ...f, name: s.name || '', phone: s.phone || '', address: s.address || '', openHours: s.openHours || '', description: s.description || '', images: s.images || [], state: s.location?.state || '', district: s.location?.district || '' }));
          setShopExists(true);
        }
      } catch { toast('Failed to load shop', 'error'); }
    }
    setLoading(false);
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const token = localStorage.getItem('authToken');
    const payload = { name: form.name, phone: form.phone, address: form.address, openHours: form.openHours, description: form.description, images: form.images, location: { state: form.state, district: form.district } };
    const isLocal = !token || token.split('.').length !== 3 || shopId?.startsWith('local-shop-');

    if (isLocal) {
      const id = shopExists && shopId ? shopId : `local-shop-${Date.now()}`;
      if (!shopExists) { localStorage.setItem('myShopId', id); localStorage.setItem(`shopProducts_${id}`, '[]'); setShopId(id); setShopExists(true); }
      localStorage.setItem(`shopProfile_${id}`, JSON.stringify({ _id: id, ...payload }));
      toast(shopExists ? 'Shop updated!' : 'Shop created!', 'success');
      setSaving(false); return;
    }
    try {
      const method = shopExists ? 'PUT' : 'POST';
      const url = shopExists && shopId ? `${API}/shops/${shopId}` : `${API}/shops`;
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Failed', 'error'); setSaving(false); return; }
      if (!shopExists) { localStorage.setItem('myShopId', d.shop._id); setShopId(d.shop._id); setShopExists(true); }
      toast(shopExists ? 'Shop updated!' : 'Shop created!', 'success');
    } catch { toast('Network error', 'error'); }
    setSaving(false);
  };

  const addImg = () => { if (imageInput.trim()) { setForm(p => ({ ...p, images: [...p.images, imageInput.trim()] })); setImageInput(''); } };

  if (loading) return <div className="p-8 space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>;

  return (
    <>
      <ToastContainer />
      <div className="p-4 md:p-6 xl:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors mt-0.5"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
          <div className="flex-1">
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <Link href="/dashboard/shopkeeper" className="hover:text-gray-600 transition-colors">Dashboard</Link>
              <ChevronRight className="w-3 h-3" /><span className="text-gray-700 font-medium">Shop Profile</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">{shopExists ? 'Edit Shop Profile' : 'Create Your Shop'}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{shopExists ? 'Update your shop details and settings' : 'Set up your shop to start selling to farmers'}</p>
          </div>
          {shopId && <Link href={`/shop/${shopId}`} target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"><Globe className="w-4 h-4" />View Shop</Link>}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Cover Banner */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="h-40 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 relative">
              <button type="button" className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white text-xs rounded-lg backdrop-blur-sm transition-colors">
                <Camera className="w-3.5 h-3.5" />Change Cover
              </button>
            </div>
            <div className="px-6 pb-5 flex items-end gap-4 -mt-8">
              <div className="h-20 w-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative group cursor-pointer">
                {form.images[0] ? <img src={form.images[0]} alt="" className="h-full w-full object-cover" /> : <Store className="w-7 h-7 text-gray-300" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity"><Camera className="w-4 h-4 text-white" /></div>
              </div>
              <div className="pb-1">
                <p className="font-bold text-gray-900 text-lg">{form.name || 'Your Shop Name'}</p>
                <p className="text-gray-500 text-sm">{form.category}</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <Section icon={<Store className="w-4 h-4 text-emerald-600" />} title="Basic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business Name *"><input value={form.name} onChange={f('name')} required placeholder="e.g. Ram Kisan Agro Store" className={inp} /></Field>
              <Field label="Owner Name"><input value={user?.name || ''} disabled className={`${inp} bg-gray-50 text-gray-400 cursor-not-allowed`} /></Field>
              <Field label="Category">
                <select value={form.category} onChange={f('category')} className={`${inp} bg-white`}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Opening Hours"><input value={form.openHours} onChange={f('openHours')} placeholder="Mon-Sat: 9 AM - 6 PM" className={inp} /></Field>
            </div>
            <Field label="Description">
              <textarea value={form.description} onChange={f('description')} rows={3} placeholder="Describe your shop, products, speciality…" className={`${inp} resize-none`} />
            </Field>
          </Section>

          {/* Contact */}
          <Section icon={<Phone className="w-4 h-4 text-emerald-600" />} title="Contact Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone Number"><input value={form.phone} onChange={f('phone')} placeholder="+91 XXXXX XXXXX" className={inp} /></Field>
              <Field label="WhatsApp"><input value={form.whatsapp} onChange={f('whatsapp')} placeholder="+91 XXXXX XXXXX" className={inp} /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={f('email')} placeholder="shop@email.com" className={inp} /></Field>
              <Field label="Website"><input value={form.website} onChange={f('website')} placeholder="https://yourshop.com" className={inp} /></Field>
            </div>
          </Section>

          {/* Address */}
          <Section icon={<MapPin className="w-4 h-4 text-emerald-600" />} title="Address & Location">
            <Field label="Full Address">
              <textarea value={form.address} onChange={f('address')} rows={2} placeholder="Shop no., street, area, pincode" className={`${inp} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State"><input value={form.state} onChange={f('state')} placeholder="State" className={inp} /></Field>
              <Field label="District"><input value={form.district} onChange={f('district')} placeholder="District" className={inp} /></Field>
            </div>
            <div className="h-36 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200 mt-1">
              <div className="text-center text-gray-400"><MapPin className="w-7 h-7 mx-auto mb-1 opacity-30" /><p className="text-sm">Map preview will appear here</p></div>
            </div>
          </Section>

          {/* Gallery */}
          <Section title="Shop Photos">
            <div className="flex gap-2">
              <input value={imageInput} onChange={e => setImageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImg(); } }} placeholder="Paste image URL…" className={`${inp} flex-1`} />
              <button type="button" onClick={addImg} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 flex-shrink-0"><Plus className="w-4 h-4" />Add</button>
            </div>
            {form.images.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {form.images.map((img, i) => (
                  <div key={i} className="relative group h-20 w-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={img} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl"><X className="w-4 h-4 text-white" /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Footer Bar */}
          <div className="sticky bottom-4 bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg px-6 py-4 flex items-center justify-between">
            <button type="button" onClick={() => router.back()} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 text-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm shadow-emerald-200">
              {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />{shopExists ? 'Save Changes' : 'Create Shop'}</>}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const inp = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow';

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">{icon}{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
