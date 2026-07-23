"use client";

import { useState } from 'react';

const API_BASE = '/api/support';

export default function RajasthanApplicationPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'General Support',
    subject: '',
    message: '',
    attachments: [] as File[],
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof typeof form, value: string | FileList | string[]) => {
    if (key === 'attachments' && value instanceof FileList) {
      setForm((prev) => ({ ...prev, attachments: Array.from(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('email', form.email);
      data.append('phone', form.phone);
      data.append('category', form.category);
      data.append('subject', form.subject);
      data.append('message', form.message);
      form.attachments.forEach((file) => data.append('attachments', file));

      const response = await fetch(API_BASE, {
        method: 'POST',
        body: data,
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to submit request');

      setStatus({ type: 'success', message: 'Support request submitted successfully.' });
      setForm({ name: '', email: '', phone: '', category: 'General Support', subject: '', message: '', attachments: [] });
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to submit the request.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan Service Application</h1>
        <p className="mt-3 text-slate-600 leading-7">
          Submit a regional support request for advisory help, scheme enrollment, or document review specific to Rajasthan farmers.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Full Name</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              >
                <option>General Support</option>
                <option>Scheme Enrollment</option>
                <option>Soil & Water Help</option>
                <option>Pest & Disease Help</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Subject</span>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={(e) => handleChange('message', e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Attachments</span>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => handleChange('attachments', e.target.files!)}
              className="w-full text-sm text-slate-700"
            />
            <p className="mt-2 text-xs text-slate-500">Upload up to 3 files, each max 10MB.</p>
          </label>

          {status && (
            <div className={`rounded-2xl p-4 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? 'Submitting…' : 'Submit Support Request'}
          </button>
        </form>
      </section>
    </main>
  );
}
