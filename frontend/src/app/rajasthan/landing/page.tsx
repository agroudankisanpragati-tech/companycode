import Link from 'next/link';

export default function RajasthanLandingPage() {
  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Rajasthan AI Seva Mitra</h1>
        <p className="mt-3 text-slate-600 leading-7">
          Welcome to the Rajasthan regional service. This landing page is connected to the shared backend for schemes, farmer profile, and AI assistant support.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Link href="/rajasthan/schemes" className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-emerald-300 hover:bg-white">
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-700">Local Schemes</h2>
          <p className="mt-2 text-slate-600">View Rajasthan-specific government support and crop subsidy programs.</p>
        </Link>
        <Link href="/rajasthan/assistant" className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-emerald-300 hover:bg-white">
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-700">Expert Assistance</h2>
          <p className="mt-2 text-slate-600">Ask the AI assistant for local crop advice, pest help, and irrigation guidance.</p>
        </Link>
        <Link href="/rajasthan/profile" className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-emerald-300 hover:bg-white">
          <h2 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-700">Profile</h2>
          <p className="mt-2 text-slate-600">Manage your farmer profile, preferences, and Rajasthan location settings.</p>
        </Link>
      </section>
    </main>
  );
}
