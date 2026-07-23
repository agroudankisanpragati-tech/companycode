import Link from 'next/link';

export default function RajasthanPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">Rajasthan AI Seva Mitra</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">Regional Farming Assistant</h1>
            <p className="mt-4 max-w-3xl text-slate-600 leading-7">
              This route hosts the Rajasthan-specific user experience for the Kisan Pragati platform. Use this folder to implement the
              regional landing, assistant, dashboard, schemes, and farmer profile pages with the existing backend integration.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Landing',
                href: '/rajasthan/landing',
                description: 'Region-specific homepage and service overview',
              },
              {
                title: 'Assistant',
                href: '/rajasthan/assistant',
                description: 'AI assistant for local crop and weather guidance',
              },
              {
                title: 'Dashboard',
                href: '/rajasthan/dashboard',
                description: 'Farmer dashboard with local insights and tasks',
              },
              {
                title: 'Schemes',
                href: '/rajasthan/schemes',
                description: 'State schemes and government assistance info',
              },
              {
                title: 'Profile',
                href: '/rajasthan/profile',
                description: 'Farmer profile, settings and preferences',
              },
              {
                title: 'Application',
                href: '/rajasthan/application',
                description: 'Forms and service applications for the region',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 transition hover:border-emerald-300 hover:bg-white"
              >
                <h2 className="text-xl font-semibold text-slate-900 group-hover:text-emerald-700">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
