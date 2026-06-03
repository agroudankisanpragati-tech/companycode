import Link from 'next/link';

export const metadata = {
  title: 'Crop Advisory | Agroudan Kisan pragati LLP',
  description: 'Get AI-powered crop advisory, disease support, weather guidance, and smart farming recommendations from Agroudan Kisan pragati LLP.',
};

export default function CropAdvisoryPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Crop Advisory</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Smart crop guidance for every season.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Use our AI farming assistant to get crop recommendations, disease help, irrigation tips, and practical next steps for your farm.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ['Crop planning', 'Choose the right crop for your soil, season, and market goals.'],
            ['Disease support', 'Spot issues early and get treatment suggestions in simple language.'],
            ['Actionable advice', 'Turn weather and soil data into clear next steps.'],
          ].map(([title, body]) => (
            <article key={title} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link href="/ai-assistant" className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            Open AI Assistant
          </Link>
          <Link href="/contact" className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}