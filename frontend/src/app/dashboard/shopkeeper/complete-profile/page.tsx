'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LocationPickerModal from '@/components/shopkeeper/LocationPickerModal';
import { Store, MapPin, Shield, Upload, CheckCircle, AlertCircle, Navigation, ChevronRight, X } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const Input = ({ label, field, type = 'text', required = false, span2 = false, profile, onChange }: any) => (
  <div className={span2 ? 'sm:col-span-2' : ''}>
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    <input
      type={type}
      value={profile[field] || ''}
      onChange={e => onChange(field, e.target.value)}
      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  </div>
);

const FileInput = ({ label, name, optional = false, existingUrl = '' }: any) => {
  const [preview, setPreview] = useState<string>(existingUrl || '');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  };

  const handleClear = () => {
    setFileName('');
    setPreview(existingUrl || '');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}{!optional ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      {preview ? (
        <div className="relative w-full">
          <img src={preview} alt={label} className="w-full h-32 object-cover rounded-xl border border-gray-200" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5 shadow border border-gray-200 hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
          <Upload className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500 truncate">{fileName || 'Choose file'}</span>
          <input ref={inputRef} id={`file-${name}`} type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </label>
      )}
    </div>
  );
};

export default function CompleteProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [doVerify, setDoVerify] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    if (user?.role !== 'shopkeeper') { router.replace('/'); return; }
    (async () => {
      const tok = localStorage.getItem('authToken');
      const r = await fetch(`${API}/shopkeeper/profile`, { headers: { Authorization: `Bearer ${tok}` } });
      const d = await r.json();
      if (d.profile) setProfile(d.profile);
    })();
  }, [isAuthenticated, user]);

  const tok = () => localStorage.getItem('authToken') || '';
  const set = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }));

  const handleSave = async (withVerification = false) => {
    setSaving(true); setError(''); setMsg('');
    try {
      const fd = new FormData();
      ['shopName','ownerName','mobileNumber','email','address','village','tehsil','district','state','pincode',
       'gstNumber','shopLicenseNumber','nurseryName','nurseryDescription','registrationDate'].forEach(f => {
        if (profile[f] !== undefined) fd.append(f, String(profile[f]));
      });
      fd.append('latitude', String(profile.latitude || 0));
      fd.append('longitude', String(profile.longitude || 0));

      ['profileImage','coverImage','gstCertificate','shopRegistrationImage','nurseryPhoto','nurseryRegistrationCertificate'].forEach(f => {
        const el = document.getElementById(`file-${f}`) as HTMLInputElement;
        if (el?.files?.[0]) fd.append(f, el.files[0]);
      });

      const r = await fetch(`${API}/shopkeeper/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tok()}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setProfile(d.profile);

      if (withVerification) {
        const vr = await fetch(`${API}/shopkeeper/submit-verification`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok()}` },
        });
        const vd = await vr.json();
        if (!vr.ok) throw new Error(vd.error || 'Verification submit failed');
        setMsg('Profile saved & verification request submitted!');
      } else {
        setMsg('Profile saved successfully!');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isFertilizer = profile.shopType === 'fertilizer';
  const isNursery = profile.shopType === 'nursery';
  const hasLocation = profile.latitude && profile.longitude;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {showLocation && (
        <LocationPickerModal
          onClose={() => setShowLocation(false)}
          onSelect={loc => {
            setProfile((p: any) => ({ ...p, ...loc }));
            setShowLocation(false);
          }}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Shop Profile</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in all required details. Your dashboard is accessible while verification is pending.</p>
        </div>

        {profile.shopType && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl w-fit">
            <Store className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              {isFertilizer ? 'Fertilizer & Agricultural Input Shop' : 'Nursery & Plant Shop'}
            </span>
          </div>
        )}

        {/* Basic Info */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Store className="w-4 h-4 text-gray-400" />Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Shop Name" field="shopName" required profile={profile} onChange={set} />
            <Input label="Owner Name" field="ownerName" required profile={profile} onChange={set} />
            <Input label="Mobile Number" field="mobileNumber" type="tel" required profile={profile} onChange={set} />
            <Input label="Email" field="email" type="email" profile={profile} onChange={set} />
            <Input label="Registration Date" field="registrationDate" type="date" profile={profile} onChange={set} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileInput label="Shop Profile Image" name="profileImage" existingUrl={profile.profileImage} />
            <FileInput label="Shop Cover Image" name="coverImage" optional existingUrl={profile.coverImage} />
          </div>
        </section>

        {/* Location */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />Location</h2>
            <button
              onClick={() => setShowLocation(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />{hasLocation ? 'Update Location' : 'Detect Location'}
            </button>
          </div>
          {hasLocation && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
              <CheckCircle className="w-3.5 h-3.5" />
              GPS: {Number(profile.latitude).toFixed(6)}, {Number(profile.longitude).toFixed(6)}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Address" field="address" required span2 profile={profile} onChange={set} />
            <Input label="Village" field="village" profile={profile} onChange={set} />
            <Input label="Tehsil" field="tehsil" profile={profile} onChange={set} />
            <Input label="District" field="district" required profile={profile} onChange={set} />
            <Input label="State" field="state" required profile={profile} onChange={set} />
            <Input label="Pincode" field="pincode" profile={profile} onChange={set} />
          </div>
        </section>

        {/* Verification Documents */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Shield className="w-4 h-4 text-gray-400" />Verification Documents</h2>
          <p className="text-xs text-gray-500">Documents will be reviewed by admin. Shop remains functional while pending.</p>

          {isFertilizer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="GST Number" field="gstNumber" required profile={profile} onChange={set} />
              <Input label="Shop License Number" field="shopLicenseNumber" profile={profile} onChange={set} />
              <FileInput label="GST Certificate" name="gstCertificate" optional existingUrl={profile.gstCertificate} />
              <FileInput label="Shop Registration Image" name="shopRegistrationImage" optional existingUrl={profile.shopRegistrationImage} />
            </div>
          )}

          {isNursery && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nursery Name" field="nurseryName" required profile={profile} onChange={set} />
              <FileInput label="Nursery Photo" name="nurseryPhoto" existingUrl={profile.nurseryPhoto} />
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nursery Description <span className="text-red-500">*</span></label>
                <textarea
                  value={profile.nurseryDescription || ''}
                  onChange={e => set('nurseryDescription', e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <Input label="GST Number" field="gstNumber" profile={profile} onChange={set} />
              <FileInput label="Nursery Registration Certificate" name="nurseryRegistrationCertificate" optional existingUrl={profile.nurseryRegistrationCertificate} />
            </div>
          )}
        </section>

        {msg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4" />{msg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 py-3.5 border-2 border-emerald-600 text-emerald-600 rounded-2xl font-semibold text-sm hover:bg-emerald-50 disabled:opacity-50 transition-colors"
          >
            Save Profile
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-200"
          >
            {saving ? 'Saving…' : 'Save & Submit for Verification'}
          </button>
        </div>

        {profile.profileCompleted && (
          <button
            onClick={() => router.push('/dashboard/shopkeeper')}
            className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center justify-center gap-1"
          >
            Go to Dashboard <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
