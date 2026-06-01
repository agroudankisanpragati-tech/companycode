 'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowRight,
  Bot,
  CloudSunRain,
  FileText,
  Mic,
  ScanSearch,
  ShoppingBasket,
  Sprout,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

type Feature = {
  title: string;
  description: string;
  image: string;
};

const features: Feature[] = [
  {
    title: 'AI Farming Assistant',
    description:
      'Ask about crops, diseases, mandi prices, or government schemes through simple text or voice chat.',
    image:
      'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Voice-Based Assistant',
    description:
      'Speak in your local language and get practical guidance without typing or technical steps.',
    image:
      'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Mandi Bhav',
    description:
      'Check live mandi prices and compare market rates before deciding when and where to sell your produce.',
    image:
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Weather Intelligence',
    description:
      'Get rainfall alerts, heatwave warnings, and irrigation suggestions before the weather impacts your crop.',
    image:
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Disease Detection',
    description:
      'Upload crop images to detect leaf diseases, nutrient deficiencies, and pest attacks with treatment advice.',
    image:
      'https://images.unsplash.com/photo-1598515213692-d6f2f2a6f1a2?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Gamified Learning',
    description:
      'Earn points, badges, and rewards by learning farming best practices and completing useful activities.',
    image:
      'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Government Scheme Help',
    description:
      'Understand eligibility, required documents, and application steps for PM-Kisan, insurance, and subsidies.',
    image:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Organic Support',
    description:
      'Promote low-chemical and water-efficient farming with organic alternatives and sustainable crop choices.',
    image:
      'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Community Learning',
    description:
      'Watch success stories, ask questions, and learn from nearby farmers and community discussions.',
    image:
      'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=1200&q=80',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function ServiceCard({ title, image }: Feature) {
  return (
    <motion.article
      variants={cardVariants}
      className="group flex h-full w-full max-w-[334px] flex-col rounded-[22px] bg-[#f5f5f5] p-[14px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-transform duration-300 hover:-translate-y-1 justify-self-center"
    >
      <div className="relative overflow-hidden rounded-[20px]">
        <div className="relative h-[164px] w-full overflow-hidden rounded-[20px]">
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
        <div className="absolute bottom-0 right-0 h-12 w-12 overflow-hidden rounded-tl-[18px] bg-[#f5f5f5]">
          <ArrowUpRight className="absolute bottom-2 right-2 h-7 w-7 text-green-600 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:scale-90" />
          <ArrowRight className="absolute bottom-2 right-2 h-7 w-7 text-green-600 opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105" />
        </div>
      </div>

      <h3 className="mt-[14px] text-[20px] font-semibold leading-tight text-[#555]">{title}</h3>
    </motion.article>
  );
}

export default function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-[#efebe7] py-7 md:py-11 lg:py-15">
      <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rounded-full bg-lime-200/25 blur-3xl" />

      <div className="section-container relative z-10">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 shadow-sm backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Smart Farming Suite
          </div>
          <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
          <h2 className="mt-5 text-2xl font-extrabold leading-tight text-emerald-700 sm:text-3xl lg:text-4xl">
            Smart Tools for Smarter Farming
          </h2>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <ServiceCard key={feature.title} {...feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
