import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fetchSchemeBySlug } from '@/services/schemes';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

const formatDate = (value?: string) => {
    if (!value) return 'Recently published';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
};

const resolveUrl = (url: string) => url.startsWith('/') ? `${API_BASE}${url}` : url;

type Props = { params: { slug: string } };

export default async function SchemeDetailPage({ params }: Props) {
    let scheme: Awaited<ReturnType<typeof fetchSchemeBySlug>> | null = null;
    let error = '';

    try {
        scheme = await fetchSchemeBySlug(params.slug);
    } catch (err) {
        error = err instanceof Error ? err.message : 'Unable to load this scheme.';
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-lime-50 via-white to-amber-50">
            <Navbar />

            <section className="section-container py-10">
                <Link href="/schemes" className="inline-flex rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50">
                    ← Back to Schemes
                </Link>
            </section>

            {error || !scheme ? (
                <section className="section-container pb-12">
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error || 'Scheme not found.'}</div>
                </section>
            ) : (
                <article className="section-container pb-16">
                    <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-white shadow-sm">
                        {/* Cover */}
                        <div className="relative h-56 bg-gradient-to-r from-amber-200 via-lime-200 to-emerald-200 md:h-72 overflow-hidden">
                            {scheme.coverImage || scheme.images?.[0] ? (
                                <img src={resolveUrl(scheme.coverImage || scheme.images[0])} alt={scheme.title} className="h-full w-full object-cover" />
                            ) : null}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold shadow ${scheme.schemeType === 'central' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>
                                    {scheme.schemeType === 'central' ? 'Central Government' : 'State Government'}
                                </span>
                                {scheme.state && <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow">{scheme.state}</span>}
                            </div>
                        </div>

                        <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10 space-y-7">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">{formatDate(scheme.publishedAt || scheme.createdAt)} • {scheme.department}</p>
                                <h1 className="mt-3 text-3xl font-extrabold leading-tight text-gray-900 md:text-4xl">{scheme.title}</h1>
                                <p className="mt-3 text-base font-medium text-emerald-700">For: {scheme.audience}</p>
                            </div>

                            {scheme.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {scheme.tags.map((tag) => (
                                        <span key={tag} className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-green-800">#{tag}</span>
                                    ))}
                                </div>
                            )}

                            <p className="whitespace-pre-wrap text-base leading-8 text-gray-700">{scheme.description}</p>

                            {scheme.benefits?.length > 0 && (
                                <div className="rounded-2xl border border-green-100 bg-green-50/70 p-5">
                                    <h2 className="text-lg font-bold text-gray-900">Key Benefits</h2>
                                    <ul className="mt-4 space-y-2 text-gray-700">
                                        {scheme.benefits.map((b) => (
                                            <li key={b} className="flex gap-3"><span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-600" /><span>{b}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scheme.eligibility && (
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
                                    <h2 className="text-lg font-bold text-gray-900">Eligibility</h2>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{scheme.eligibility}</p>
                                </div>
                            )}

                            {(scheme.requiredDocuments?.length ?? 0) > 0 && (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                                    <h2 className="text-lg font-bold text-gray-900">Required Documents</h2>
                                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                                        {scheme.requiredDocuments!.map((doc) => (
                                            <li key={doc} className="flex gap-2"><span className="text-blue-500">•</span>{doc}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scheme.applicationProcess && (
                                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
                                    <h2 className="text-lg font-bold text-gray-900">How to Apply</h2>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{scheme.applicationProcess}</p>
                                </div>
                            )}

                            {/* Extra images */}
                            {scheme.images?.length > 1 && (
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">Gallery</h2>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {scheme.images.slice(1).map((img) => (
                                            <img key={img} src={resolveUrl(img)} alt="" className="h-36 w-full rounded-xl object-cover" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Videos */}
                            {scheme.videos?.length > 0 && (
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-3">Videos</h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {scheme.videos.map((vid) => (
                                            <video key={vid} src={resolveUrl(vid)} controls className="w-full rounded-xl" />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3">
                                {scheme.applicationLink && (
                                    <a href={scheme.applicationLink} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700">Apply Now</a>
                                )}
                                {scheme.officialLink && (
                                    <a href={scheme.officialLink} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50">Official Website</a>
                                )}
                            </div>
                        </div>
                    </div>
                </article>
            )}

            <Footer />
        </main>
    );
}
