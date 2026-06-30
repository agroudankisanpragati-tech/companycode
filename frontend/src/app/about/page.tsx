'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const founders = [
  {
    name: 'Mohitraj Yadav',
    role: 'Founder & CEO',
    initials: 'MY',
    color: 'from-emerald-500 to-teal-500',
    photo: null,
    shortBio: 'Visionary leader from farming roots, driving AI-powered agricultural transformation across India.',
    fullBio:
      'Coming from a deep-rooted farming background, Mohitraj Yadav founded AGROUDAN KISAN PRAGATI with a singular vision: to solve real agricultural challenges using cutting-edge technology. Having witnessed firsthand the daily struggles of farmers — unpredictable weather, crop failures, lack of market access — he believed that Artificial Intelligence could be the turning point. Under his leadership, the company has grown into a trusted platform empowering over 12,000 farmers with smart tools, real-time insights, and government scheme guidance, making farming profitable and sustainable for every Indian household.',
    message:
      '"Every farmer in India deserves access to the same intelligence and tools that billion-dollar corporations use. That is why we built AGROUDAN — to put AI in the hands of the people who feed our nation."',
    linkedin: 'http://localhost:3000/about',
    instagram: 'https://instagram.com',
  },
  {
    name: 'Rohit Sharma',
    role: 'Co-Founder & CTO',
    initials: 'RS',
    color: 'from-amber-500 to-orange-500',
    photo: null,
    shortBio: 'Tech architect building scalable, reliable systems that millions of farmers can trust.',
    fullBio:
      'Rohit Sharma leads all technology and product development at AGROUDAN KISAN PRAGATI. He oversees the website, mobile application, backend architecture, cloud infrastructure, and overall technical execution. With a passion for building secure and scalable systems, Rohit ensures that every farmer — whether using a smartphone in Punjab or a basic phone in Bihar — gets a seamless, fast, and reliable experience. His engineering philosophy is simple: build for the last mile, and everything in between will follow.',
    message:
      '"Technology should not be a privilege of the urban elite. Our platform is designed to work in low-bandwidth rural areas, in local languages, with zero technical knowledge required from the farmer."',
    linkedin: 'https://www.instagram.com/rao._sahab018?igsh=MWdmYTV0aWZvcGd6bQ==',
    instagram: 'https://instagram.com',
  },
  {
    name: 'Kartikeya Prasad',
    role: 'Co-Founder-AI Strategy & Business Head ',
    initials: 'KP',
    color: 'from-violet-500 to-purple-600',
    photo: null,
    shortBio: 'AI innovator building intelligent crop systems, voice assistants, and data-driven farm strategies.',
    fullBio:
      "Kartikeya Prasad leads Artificial Intelligence development, product innovation, and business strategy at AGROUDAN KISAN PRAGATI. He focuses on building intelligent solutions including AI Crop Recommendation, Multilingual Voice AI Assistant, Soil Health Analysis, Profit & Risk Prediction, and Crop Disease Detection. His strategic foresight shapes the company's roadmap to become India's most trusted AI-powered Agritech platform — connecting farmers with precision tools that make every season more productive and every decision more informed.",
    message:
      '"Agriculture is not just India\'s occupation — it is our identity. By merging ancient farming wisdom with modern AI, we are not replacing the farmer\'s instinct; we are amplifying it."',
    linkedin: 'https://linkedin.com',
    instagram: 'https://instagram.com',
  },
];

const trustPoints = [
  {
    icon: '🌱',
    title: 'Born from the Fields',
    text: 'Our founders come from agricultural backgrounds. We understand soil, seasons, and the sweat behind every harvest.',
  },
  {
    icon: '🤖',
    title: 'AI That Speaks Your Language',
    text: 'Our Voice AI supports 22+ Indian languages. Farmers get real-time advice in their own dialect — no literacy barrier.',
  },
  {
    icon: '📡',
    title: 'Hyperlocal & Accurate',
    text: 'Village-level weather, mandi prices, and soil data — not generic advice, but precision intelligence for your exact farm.',
  },
  {
    icon: '🛡️',
    title: 'Farmer-First, Always',
    text: 'No middlemen, no hidden fees. Every feature is designed to increase farmer income and reduce risk, period.',
  },
  {
    icon: '🌾',
    title: 'Proven Results',
    text: '12,000+ farmers have reported better yields, smarter crop choices, and 30% higher profits using our platform.',
  },
  {
    icon: '🇮🇳',
    title: 'Made for Bharat',
    text: 'Built specifically for Indian soil types, crop varieties, government schemes, and regional market dynamics.',
  },
];

function SocialIcon({ type, href }: { type: string; href: string }) {
  const icons: Record<string, JSX.Element> = {
    linkedin: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
      {icons[type]}
    </a>
  );
}

export default function AboutPage() {
  const [activeFounder, setActiveFounder] = useState<(typeof founders)[0] | null>(null);

  return (
    <>
      <TopBar />
      <Navbar />
      <main className="w-full bg-[#f6faf5]">

        {/* ── HERO ──
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-green-600 to-lime-500 py-24 md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOFYwaDM2djM2SDM2VjE4eiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-40" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="pointer-events-none absolute top-10 -left-10 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl" />
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="relative z-10 mx-auto max-w-4xl px-4 text-center"
          >
            <motion.div variants={fadeUp} className="flex justify-center mb-5">
              <span className="text-5xl">🌾</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl font-extrabold text-white sm:text-6xl leading-tight drop-shadow-md">
              AGROUDAN KISAN PRAGATI
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 text-lg md:text-xl text-emerald-100 max-w-2xl mx-auto leading-relaxed">
              Empowering every Indian farmer with Artificial Intelligence, real-time data, and sustainable agricultural solutions.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap justify-center gap-3">
              {['12k+ Farmers', '45 Crops', '22+ Languages', '8k+ Markets'].map((tag) => (
                <span key={tag} className="rounded-full bg-white/20 backdrop-blur-sm px-5 py-2 text-sm font-semibold text-white border border-white/30">
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </section> */}

        {/* ── ABOUT COMPANY ── */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-5xl px-4 lg:px-8">
            <motion.div
              variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
              className="space-y-6"
            >
              <motion.div variants={fadeUp} className="flex items-center gap-3">
                <span className="text-3xl">🏢</span>
                <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">About Our Company</h2>
              </motion.div>

              <motion.div variants={fadeUp} className="h-1 w-20 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" />

              <motion.p variants={fadeUp} className="text-lg text-slate-700 leading-relaxed">
                <span className="font-bold text-emerald-700">AGROUDAN KISAN PRAGATI</span> is an Indian Agritech startup founded with a mission to revolutionize agriculture through the power of Artificial Intelligence. We were born from a deep understanding of the challenges faced by Indian farmers — unpredictable rainfall, soil degradation, lack of market access, and limited access to expert agricultural advice. Our founders, all rooted in India's agricultural heartland, decided to bridge this gap with technology.
              </motion.p>

              <motion.p variants={fadeUp} className="text-lg text-slate-700 leading-relaxed">
                Our platform is a comprehensive digital ecosystem designed exclusively for the Indian farming community. From AI-powered crop recommendations and multilingual voice assistance to hyperlocal weather intelligence and real-time mandi price updates — every feature is crafted with one goal: to make every Indian farmer smarter, safer, and more profitable.
              </motion.p>

              <motion.p variants={fadeUp} className="text-lg text-slate-700 leading-relaxed">
                We support over <span className="font-bold text-emerald-700">12,000+ farmers</span> across India, covering more than <span className="font-bold text-emerald-700">45 crop varieties</span> in <span className="font-bold text-emerald-700">22+ regional languages</span>. Our AI models are trained on India-specific soil data, crop patterns, and climate conditions — delivering hyper-accurate, localized recommendations that generic global platforms simply cannot match.
              </motion.p>

              <motion.p variants={fadeUp} className="text-lg text-slate-700 leading-relaxed">
                Beyond technology, we are a movement. A movement to dignify the role of the farmer in India's economy, to ensure that the people who feed 1.4 billion citizens have access to the same intelligence and resources as any Fortune 500 company. We are not just building software — we are building a sustainable future for Indian agriculture, one farm at a time.
              </motion.p>

              {/* Stats row */}
              <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {[
                  { value: '12k+', label: 'Farmers Helped', icon: '👨‍🌾' },
                  { value: '45', label: 'Crops Supported', icon: '🌾' },
                  { value: '22+', label: 'Languages', icon: '🗣️' },
                  { value: '8k+', label: 'Market Links', icon: '🏪' },
                ].map((s) => (
                  <motion.div
                    key={s.label} variants={fadeUp}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center shadow-md border border-emerald-50"
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <span className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
                      {s.value}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── MEET OUR FOUNDERS ── */}
        <section className="py-20 bg-gradient-to-b from-white to-emerald-50/50">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <motion.div
              variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            >
              <motion.div variants={fadeUp} className="text-center mb-14">
                <div className="flex justify-center items-center gap-3 mb-3">
                  <span className="text-3xl">🤝</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Meet Our Founders</h2>
                </div>
                <p className="text-slate-500 max-w-xl mx-auto">The passionate team behind India's AI farming revolution. Click on a card to know more.</p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
                {founders.map((f) => (
                  <motion.div
                    key={f.name} variants={fadeUp}
                    onClick={() => setActiveFounder(f)}
                    className="group relative cursor-pointer rounded-3xl bg-white shadow-lg border border-emerald-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* Top gradient banner */}
                    <div className={`h-32 bg-gradient-to-br ${f.color} relative flex items-center justify-center`}>
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent)]" />
                      {/* Avatar */}
                      <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-sm border-4 border-white/60 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
                        {f.initials}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col gap-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">{f.name}</h3>
                        <p className="text-xs font-semibold text-emerald-600 mt-0.5">{f.role}</p>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{f.shortBio}</p>

                      {/* Social icons */}
                      <div className="flex gap-3 pt-1 text-slate-400">
                        <SocialIcon type="linkedin" href={f.linkedin} />
                        <SocialIcon type="instagram" href={f.instagram} />
                        {/* <SocialIcon type="facebook" href={f.facebook} /> */}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                        <span>View Full Profile</span>
                        <span>→</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── FOUNDER MODAL ── */}
        <AnimatePresence>
          {activeFounder && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveFounder(null)}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                {/* Modal header */}
                <div className={`h-40 bg-gradient-to-br ${activeFounder.color} relative flex items-end justify-start px-7 pb-5`}>
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent)]" />
                  <div className="w-24 h-24 rounded-full bg-white/30 backdrop-blur-sm border-4 border-white/70 flex items-center justify-center text-white text-4xl font-extrabold shadow-xl relative z-10">
                    {activeFounder.initials}
                  </div>
                  <button
                    onClick={() => setActiveFounder(null)}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xl hover:bg-white/40 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-7 flex flex-col gap-4">
                  <div>
                    <h3 className="text-2xl font-extrabold text-slate-900">{activeFounder.name}</h3>
                    <p className="text-sm font-bold text-emerald-600 mt-1">{activeFounder.role}</p>
                  </div>

                  <p className="text-slate-600 leading-relaxed text-sm">{activeFounder.fullBio}</p>

                  <div className={`rounded-2xl bg-gradient-to-br ${activeFounder.color} p-5 text-white`}>
                    <p className="text-sm italic leading-relaxed opacity-95">{activeFounder.message}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm font-semibold text-slate-500">Connect:</span>
                    <div className="flex gap-3 text-slate-500">
                      <SocialIcon type="linkedin" href={activeFounder.linkedin} />
                      <SocialIcon type="instagram" href={activeFounder.instagram} />
                      {/* <SocialIcon type="facebook" href={activeFounder.facebook} /> */}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── WHY FARMERS TRUST US ── */}
        <section className="py-20 md:py-28 bg-[#f6faf5]">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <motion.div
              variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            >
              <motion.div variants={fadeUp} className="text-center mb-14">
                <div className="flex justify-center items-center gap-3 mb-3">
                  <span className="text-3xl">💚</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Why Farmers Trust Us</h2>
                </div>
                <p className="text-slate-500 max-w-lg mx-auto">Six reasons why over 12,000 farmers across India choose AGROUDAN every single season.</p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {trustPoints.map((tp, i) => (
                  <motion.div
                    key={tp.title}
                    variants={fadeUp}
                    custom={i}
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="group rounded-2xl bg-white p-7 shadow-md border border-emerald-100 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 cursor-default"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-lime-100 flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {tp.icon}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 leading-snug">{tp.title}</h3>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">{tp.text}</p>
                    <div className="mt-4 h-0.5 w-10 rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 group-hover:w-16 transition-all duration-500" />
                  </motion.div>
                ))}
              </div>

              {/* Bottom CTA strip */}
              <motion.div
                variants={fadeUp}
                className="mt-14 rounded-3xl bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 p-8 md:p-12 text-white text-center shadow-xl"
              >
                <span className="text-4xl mb-3 block">🌾</span>
                <h3 className="text-2xl font-extrabold mb-2">Ready to Transform Your Farm?</h3>
                <p className="text-emerald-100 mb-6 max-w-md mx-auto text-sm leading-relaxed">
                  Join thousands of farmers already using AI-powered tools to grow smarter, earn more, and farm sustainably.
                </p>
                <a
                  href="/auth/register"
                  className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold px-8 py-3 rounded-full shadow-md hover:shadow-lg hover:bg-emerald-50 transition-all duration-200 text-sm"
                >
                  Get Started Free <span>→</span>
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
