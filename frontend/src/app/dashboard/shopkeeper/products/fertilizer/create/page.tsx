'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { Upload, Camera, ArrowLeft, CheckCircle, AlertCircle, Scan, X } from 'lucide-react';
import ToastContainer, { toast } from '@/components/shopkeeper/Toast';

const CATEGORIES = ['Fertilizer','Pesticide','Herbicide','Fungicide','Seed','Micro-nutrient','Growth Regulator','Other'];
const UNITS = ['kg','g','L','mL','packet','bag','bottle','box'];

const Input = ({ label, field, type = 'text', required = false, form, onChange }: any) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    <input type={type} value={form[field] || ''} onChange={e => onChange(field, e.target.value)}
      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
  </div>
);

export default function CreateFertilizerProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<any>({
    productName:'', brandName:'', category:'Fertilizer', quantity:'', unit:'kg',
    mrp:'', sellingPrice:'', description:'', usageInstructions:'', dosage:'',
    cropSuitability:[], nutrientComposition:'', manufacturingCompany:'',
    manufacturingDate:'', expiryDate:'', stockStatus:'in_stock',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [cropInput, setCropInput] = useState('');

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setImages(prev => [...prev, ...arr].slice(0, 5));
    const urls = arr.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...urls].slice(0, 5));
  };

  const removeImage = (i: number) => {
    setImages(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const addCrop = () => {
    if (!cropInput.trim()) return;
    set('cropSuitability', [...(form.cropSuitability || []), cropInput.trim()]);
    setCropInput('');
  };

  const removeCrop = (i: number) => set('cropSuitability', form.cropSuitability.filter((_: any, idx: number) => idx !== i));

  // AI Scan mock (calls backend OCR/AI if configured)
  const handleAiScan = async () => {
    const input = document.getElementById('scan-image') as HTMLInputElement;
    if (!input?.files?.[0]) { toast('Please select an image to scan', 'error'); return; }
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append('image', input.files[0]);
      const tok = localStorage.getItem('authToken');
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/shopkeeper/scan-product`, {
        method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd,
      });
      const d = await r.json();
      if (r.ok && d.data) {
        setForm((f: any) => ({ ...f, ...d.data }));
        toast('Product info extracted! Please review before saving.', 'success');
      } else {
        toast('Could not extract info. Please fill manually.', 'error');
      }
    } catch {
      toast('AI scan unavailable. Please fill manually.', 'error');
    }
    setScanning(false);
  };

  const handleSubmit = async () => {
    if (!form.productName) { setError('Product name is required'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'cropSuitability') fd.append(k, JSON.stringify(v));
        else fd.append(k, String(v));
      });
      images.forEach(img => fd.append('productImages', img));
      const d = await shopkeeperApi.createFertilizerProduct(fd);
      if (d.product) { toast('Product added!', 'success'); setTimeout(() => router.push('/dashboard/shopkeeper/products/fertilizer'), 800); }
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
          <Link href="/dashboard/shopkeeper/products/fertilizer" className="p-2 rounded-xl hover:bg-gray-100"><ArrowLeft className="w-4 h-4 text-gray-600" /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add Fertilizer Product</h1>
            <p className="text-xs text-gray-400">Fill in product details or use AI scan</p>
          </div>
        </div>

        {/* AI Scan section */}
        <section className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-violet-600" />
            <h2 className="font-semibold text-violet-800 text-sm">AI Product Scan</h2>
            <span className="ml-auto text-[10px] px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full font-semibold">AI-Powered</span>
          </div>
          <p className="text-xs text-violet-600">Take a photo of the product packaging. AI will extract details automatically.</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-violet-200 rounded-xl cursor-pointer hover:bg-violet-50 text-sm text-violet-700 font-medium">
              <Camera className="w-4 h-4" />Select Image
              <input id="scan-image" type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
            <button onClick={handleAiScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors">
              <Scan className="w-4 h-4" />{scanning ? 'Scanning…' : 'Scan & Auto-fill'}
            </button>
          </div>
        </section>

        {/* Images */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Product Images</h2>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 h-5 w-5 bg-black/60 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {previews.length < 5 && (
              <label className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-400">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImages(e.target.files)} />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400">Up to 5 images</p>
        </section>

        {/* Details */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Product Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Product Name" field="productName" required form={form} onChange={set} />
            <Input label="Brand Name" field="brandName" form={form} onChange={set} />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Input label="Manufacturing Company" field="manufacturingCompany" form={form} onChange={set} />
            <Input label="Quantity" field="quantity" type="number" form={form} onChange={set} />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <Input label="MRP (₹)" field="mrp" type="number" required form={form} onChange={set} />
            <Input label="Selling Price (₹)" field="sellingPrice" type="number" required form={form} onChange={set} />
            <Input label="Manufacturing Date" field="manufacturingDate" type="date" form={form} onChange={set} />
            <Input label="Expiry Date" field="expiryDate" type="date" form={form} onChange={set} />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Stock Status</label>
              <select value={form.stockStatus} onChange={e => set('stockStatus', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </section>

        {/* Agronomic Details */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Agronomic Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nutrient Composition" field="nutrientComposition" form={form} onChange={set} />
            <Input label="Dosage" field="dosage" form={form} onChange={set} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Crop Suitability</label>
            <div className="flex gap-2 mb-2">
              <input value={cropInput} onChange={e => setCropInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCrop()} placeholder="e.g. Wheat, Rice…"
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={addCrop} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(form.cropSuitability || []).map((c: string, i: number) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  {c}<button onClick={() => removeCrop(i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Usage Instructions</label>
            <textarea value={form.usageInstructions} onChange={e => set('usageInstructions', e.target.value)} rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </section>

        {error && <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

        <div className="flex gap-3 pb-8">
          <Link href="/dashboard/shopkeeper/products/fertilizer" className="flex-1 py-3.5 text-center border-2 border-gray-200 text-gray-600 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-200">
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </>
  );
}
