import Link from 'next/link';

export const metadata = {
  title: 'Disease Detection | Agroudan Kisan pragati LLP',
  description: 'Detect crop disease early with Agroudan Kisan pragati LLP using AI-powered guidance and farmer-friendly support.',
};

export default function DiseaseDetectionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">Disease Detection</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Catch crop problems before they spread.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Upload, inspect, and learn with simple AI-assisted disease detection guidance designed for farmers.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ['Early warning', 'Identify likely issues faster and reduce crop loss.'],
            ['Simple steps', 'Get practical treatment ideas without technical jargon.'],
            ['Farm follow-up', 'Move from diagnosis to action with weather and crop context.'],
          ].map(([title, body]) => (
            <article key={title} className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/ai-assistant" className="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700">
            Open AI Assistant
          </Link>
          <Link href="/dashboard/farmer/crop-health" className="rounded-full border border-rose-200 bg-white px-6 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
            Farmer Crop Health
          </Link>
        </div>
      </section>
    </main>
  );
}