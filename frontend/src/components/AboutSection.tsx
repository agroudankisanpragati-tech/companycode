'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Target,
  Eye,
  ArrowRight,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};


export default function AboutSection() {
  return (
    <section
      id="about"
      aria-label="About AGROUDAN KISAN PRAGATI"
      className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-16 md:py-24"
    >
      {/* Ambient blobs — same style as Features */}
      <div className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-16 h-80 w-80 rounded-full bg-lime-200/20 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8 relative z-10 space-y-20 md:space-y-28">

        {/* ── HEADER ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Our Company
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl"
          >
            About{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
              AGROUDAN KISAN PRAGATI
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-base text-slate-500">
            Empowering Indian Farmers through Artificial Intelligence, Innovation, and Sustainable Agriculture.
          </motion.p>
        </motion.div>

        {/* ── OUR STORY ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center"
        >
          {/* Image */}
          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow-[0_16px_40px_rgba(0,0,0,0.12)] aspect-[4/3]"
          />

          {/* Text */}
          <motion.div variants={fadeUp} className="flex flex-col gap-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Our Story
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 sm:text-3xl leading-snug">
              Where Tradition Meets <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">Artificial Intelligence</span>
            </h3>
            <div className="space-y-4 text-slate-600 text-base leading-relaxed">
              <p>
                AGROUDAN KISAN PRAGATI LLP is an AI-powered Agritech startup committed to transforming Indian agriculture through intelligent and data-driven solutions.
              </p>
              <p>
                Founded by three young innovators from Rajasthan, our mission is to bridge the gap between traditional farming and modern Artificial Intelligence by providing farmers with personalized guidance, localized insights, and smarter decision-making tools.
              </p>
              <p>
                We believe that while land size cannot always increase, the income generated from every acre can. Through AI, we aim to help farmers choose the right crops, improve productivity, reduce risks, and adopt sustainable farming practices.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── MISSION & VISION ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          <motion.div variants={fadeUp} className="mx-auto mb-10 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Purpose
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Mission &amp; <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">Vision</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                icon: Target,
                label: 'Mission',
                color: 'from-emerald-500 to-teal-500',
                bg: 'from-emerald-50/80 to-teal-50/60',
                text: 'To empower every Indian farmer with AI-powered, data-driven, and localized agricultural intelligence that enables better decisions, higher profitability, and sustainable farming.',
              },
              {
                icon: Eye,
                label: 'Vision',
                color: 'from-amber-500 to-lime-500',
                bg: 'from-amber-50/80 to-lime-50/60',
                text: "To become India's most trusted AI-powered farming ecosystem where every farmer has access to intelligent guidance, modern technology, and the right information to maximize productivity and income.",
              },
            ].map(({ icon: Icon, label, color, bg, text }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} border border-white/80 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.10)]`}
              >
                <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-sm pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-4">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">{label}</h3>
                  <p className="text-slate-600 leading-relaxed">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── CLOSING CTA ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-500 px-6 py-14 text-center shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-lime-400/20 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-3xl font-extrabold text-white mb-4 leading-tight"
            >
              Building the Future of Indian Agriculture
            </motion.h2>
            <motion.p variants={fadeUp} className="text-emerald-100 text-base md:text-lg mb-3">
              Technology should not replace farmers — it should empower them.
            </motion.p>
            <motion.p variants={fadeUp} className="text-emerald-100/80 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
              At AGROUDAN KISAN PRAGATI, we are building an intelligent farming ecosystem where Artificial Intelligence helps every farmer make smarter decisions, increase income, and adopt sustainable farming practices.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/ai-assistant"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-emerald-700 shadow-xl shadow-emerald-900/20 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
                aria-label="Explore Platform"
              >
                Explore Platform
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/60 px-8 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-1 hover:bg-white/10"
                aria-label="Contact Us"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
