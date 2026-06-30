import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FaEnvelope, FaMapMarkerAlt, FaPhoneAlt, FaRegClock, FaWhatsapp } from 'react-icons/fa';

const supportChannels = [
    {
        title: 'Phone Support',
        detail: '+916358095181',
        note: 'Mon-Sat, 9:00 AM - 7:00 PM',
        icon: FaPhoneAlt,
        accent: 'from-amber-400 to-orange-500',
    },
    {
        title: 'Email Helpdesk',
        detail: 'support@agroudankisanpragati.com',
        note: 'Typical response in under 3 hours',
        icon: FaEnvelope,
        accent: 'from-lime-400 to-green-500',
    },
    {
        title: 'WhatsApp Assist',
        detail: '+916358095181',
        note: 'Chat for weather, mandi, and app support',
        icon: FaWhatsapp,
        accent: 'from-emerald-400 to-teal-500',
    },
];

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-amber-50 via-lime-50 to-white">
            <Navbar />
            <section className="relative overflow-hidden">
                <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-yellow-300/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-20 top-20 h-80 w-80 rounded-full bg-green-300/20 blur-3xl" />

                <div className="section-container py-14 md:py-20">
                    <div className="mx-auto max-w-6xl rounded-3xl border border-green-100 bg-white/90 shadow-xl backdrop-blur-sm">
                        <div className="grid gap-10 p-6 md:grid-cols-2 md:gap-12 md:p-10 lg:p-12">
                            <div className="space-y-6">
                                <span className="inline-flex items-center rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700">
                                    Contact Agroudan Kisan Pragati
                                </span>

                                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
                                    Let&apos;s Solve Farming
                                    <span className="block gradient-text">Challenges Together</span>
                                </h1>

                                <p className="max-w-xl text-base text-gray-600 md:text-lg">
                                    Need help with weather insights, mandi pricing, crop recommendations, or account setup?
                                    Our support team is available in Hindi and English.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-2xl font-bold text-amber-700">10k+</p>
                                        <p className="text-sm text-amber-900/80">Farmers assisted</p>
                                    </div>
                                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                                        <p className="text-2xl font-bold text-green-700">95%</p>
                                        <p className="text-sm text-green-900/80">Issue resolution rate</p>
                                    </div>
                                </div>

                                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex items-start gap-3 text-sm text-gray-700">
                                        <FaMapMarkerAlt className="mt-1 text-green-600" />
                                        <p>Agri Innovation Hub, Sector 62, Noida, Uttar Pradesh</p>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-gray-700">
                                        <FaRegClock className="mt-1 text-green-600" />
                                        <p>Support Hours: Monday to Saturday, 9:00 AM to 7:00 PM</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-lg md:p-6">
                                <h2 className="text-2xl font-bold text-gray-900">Send Us a Message</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    Fill this form and our agritech specialist will connect with you shortly.
                                </p>

                                <form className="mt-6 space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-medium text-gray-700">Full Name</span>
                                            <input
                                                type="text"
                                                name="name"
                                                placeholder="Your name"
                                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-medium text-gray-700">Phone Number</span>
                                            <input
                                                type="tel"
                                                name="phone"
                                                placeholder="+91"
                                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                            />
                                        </label>
                                    </div>

                                    <label className="block">
                                        <span className="mb-1 block text-sm font-medium text-gray-700">Email Address</span>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="you@example.com"
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-1 block text-sm font-medium text-gray-700">How can we help?</span>
                                        <textarea
                                            name="message"
                                            rows={5}
                                            placeholder="Describe your issue or requirement"
                                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl bg-gradient-to-r from-green-600 to-lime-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-green-700 hover:to-lime-600 hover:shadow-lg"
                                    >
                                        Submit Request
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                        {supportChannels.map((channel) => {
                            const Icon = channel.icon;

                            return (
                                <article
                                    key={channel.title}
                                    className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <div
                                        className={`mb-4 inline-flex rounded-xl bg-gradient-to-br p-3 text-white shadow-md ${channel.accent}`}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">{channel.title}</h3>
                                    <p className="mt-2 text-base font-semibold text-green-700">{channel.detail}</p>
                                    <p className="mt-1 text-sm text-gray-600">{channel.note}</p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
