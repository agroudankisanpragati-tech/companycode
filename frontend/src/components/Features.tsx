'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot,
  Mic,
  ShoppingBasket,
  CloudSunRain,
  ScanSearch,
  Trophy,
  FileText,
  Sprout,
  Users,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

type Tool = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  color: string;
  glow: string;
};

const tools: Tool[] = [
  {
    icon: Bot,
    title: 'AI Farming Assistant',
    description: 'Get instant AI-powered farming guidance.',
    href: '/ai-assistant',
    color: 'from-emerald-500 to-teal-500',
    glow: 'group-hover:shadow-emerald-200/60',
  },
  {
    icon: Mic,
    title: 'Voice-Based Assistant',
    description: 'Speak naturally and receive voice guidance.',
    href: '/ai-assistant',
    color: 'from-violet-500 to-purple-600',
    glow: 'group-hover:shadow-violet-200/60',
  },
  {
    icon: ShoppingBasket,
    title: 'Mandi Bhav',
    description: 'Check real-time mandi prices.',
    href: '/mandi-prices',
    color: 'from-amber-500 to-orange-500',
    glow: 'group-hover:shadow-amber-200/60',
  },
  {
    icon: CloudSunRain,
    title: 'Weather Intelligence',
    description: 'Weather forecasts and farming alerts.',
    href: '/weather',
    color: 'from-sky-500 to-blue-500',
    glow: 'group-hover:shadow-sky-200/60',
  },
  {
    icon: ScanSearch,
    title: 'Disease Detection',
    description: 'Identify crop diseases using AI.',
    href: '/disease-detection',
    color: 'from-rose-500 to-pink-500',
    glow: 'group-hover:shadow-rose-200/60',
  },
  {
    icon: Trophy,
    title: 'Farmer Success',
    description: 'Celebrate and learn from real farmer success stories.',
    href: '/farmer-stories',
    color: 'from-yellow-400 to-amber-500',
    glow: 'group-hover:shadow-yellow-200/60',
  },
  {
    icon: FileText,
    title: 'Government Scheme Help',
    description: 'Find eligible government schemes.',
    href: '/schemes',
    color: 'from-indigo-500 to-blue-600',
    glow: 'group-hover:shadow-indigo-200/60',
  },
  {
    icon: Sprout,
    title: 'Organic Support',
    description: 'Organic farming recommendations and guidance.',
    href: '/crop-advisory?filter=organic',
    color: 'from-lime-500 to-green-500',
    glow: 'group-hover:shadow-lime-200/60',
  },
  {
    icon: Users,
    title: 'Community Learning',
    description: 'Learn from successful farmer stories.',
    href: '/farmer-stories',
    color: 'from-cyan-500 to-teal-600',
    glow: 'group-hover:shadow-cyan-200/60',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function ToolCard({ icon: Icon, title, description, href, color, glow }: Tool) {
  return (
    <motion.div variants={cardVariants}>
      <Link
        href={href}
        className={`group relative flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] ${glow}`}
        aria-label={title}
      >
        {/* Gradient bg on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300 from-emerald-400 to-lime-300 pointer-events-none" />

        <div className="flex items-start justify-between">
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
            <Icon size={22} strokeWidth={1.8} />
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all duration-300 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowRight size={15} />
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-800 leading-snug">{title}</h3>
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white py-16 md:py-24">
      <div className="pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-16 h-80 w-80 rounded-full bg-lime-200/20 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8 relative z-10">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Smart Farming Suite
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Smart Tools for <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">Smarter Farming</span>
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Everything you need to grow better — powered by AI, built for Indian farmers.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
