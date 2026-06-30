'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { Upload, ArrowLeft, AlertCircle, X } from 'lucide-react';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';

const SEASONS = ['Spring','Summer','Monsoon','Autumn','Winter','All Season'];
const MAINTENANCE = ['low','medium','high'];

const Input = ({ label, field, type = 'text', required = false, form, onChange }: any) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    <input type={type} value={form[field] || ''} onChange={e => onChange(field, e.target.value)}
      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
  </div>
);

export default function CreateNurseryProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<any>({
    plantName:'', variety:'', price:'', description:'', availableQuantity:'',
    plantAge:'', plantHeight:'', sunlightRequirement:'', waterRequirement:'',
    suitableSeason:[], growthDuration:'', maintenanceLevel:'medium',
    organicCertified: false, stockStatus:'in_stock',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 8 - images.length);
    setImages(p => [...p, ...arr]);
    setPreviews(p => [...p, ...arr.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (i: number) => {
    setImages(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const toggleSeason = (s: string) => {
    const cur: string[] = form.suitableSeason || [];
    set('suitableSeason', cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]);
  };

  const handleSubmit = async () => {
    if (!form.plantName) { setError('Plant name is required'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'suitableSeason') fd.append(k, JSON.stringify(v));
        else fd.append(k, String(v));
      });
      images.forEach(img => fd.append('productImages', img));
      const d = await shopkeeperApi.createNurseryProduct(fd);
      if (d.product) { toast('Plant added!', 'success'); setTimeout(() => router.push('/dashboard/shopkeeper/products/nursery'), 800); }
      else throw new Error(d.error || 'Failed');
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <>
      <ToastContainer />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/shopkeeper/products/nursery" className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft className="w-4 h-4 text-gray-600" /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Plant / Nursery Product</h1>
            <p className="text-xs text-gray-400">List a plant or sapling</p>
          </div>
        </div>

        {/* Images */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Product Images</h2>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 h-5 w-5 bg-black/60 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white" /></button>
              </div>
            ))}
            {previews.length < 8 && (
              <label className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-400">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImages(e.target.files)} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400">Up to 8 images</p>
        </section>

        {/* Details */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Plant Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Plant Name" field="plantName" required form={form} onChange={set} />
            <Input label="Variety" field="variety" form={form} onChange={set} />
            <Input label="Price (₹)" field="price" type="number" required form={form} onChange={set} />
            <Input label="Available Quantity" field="availableQuantity" type="number" form={form} onChange={set} />
            <Input label="Plant Age" field="plantAge" form={form} onChange={set} />
            <Input label="Plant Height" field="plantHeight" form={form} onChange={set} />
            <Input label="Sunlight Requirement" field="sunlightRequirement" form={form} onChange={set} />
            <Input label="Water Requirement" field="waterRequirement" form={form} onChange={set} />
            <Input label="Growth Duration" field="growthDuration" form={form} onChange={set} />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Maintenance Level</label>
              <select value={form.maintenanceLevel} onChange={e => set('maintenanceLevel', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {MAINTENANCE.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Stock Status</label>
              <select value={form.stockStatus} onChange={e => set('stockStatus', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Suitable Seasons</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map(s => (
                <button key={s} onClick={() => toggleSeason(s)} type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${form.suitableSeason?.includes(s) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:border-emerald-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => set('organicCertified', !form.organicCertified)} type="button"
              className={`h-6 w-11 rounded-full transition-colors ${form.organicCertified ? 'bg-emerald-500' : 'bg-gray-200'} relative`}>
              <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform ${form.organicCertified ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <label className="text-sm text-gray-700">Organically Grown / Certified</label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </section>

        {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

        <div className="flex gap-3 pb-8">
          <Link href="/dashboard/shopkeeper/products/nursery" className="flex-1 py-3.5 text-center border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-200">
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </>
  );
}
