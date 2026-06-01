 'use client';

import Image from 'next/image';
import { FaUserPlus, FaRobot, FaLeaf, FaStore } from 'react-icons/fa';

const steps = [
    {
        icon: <FaUserPlus className="text-2xl md:text-3xl text-green-700" />,
        accent: 'from-emerald-500 via-green-500 to-lime-400',
        ring: 'ring-emerald-200/70',
        title: 'Create your farmer profile',
        description:
            'Add your location, soil type, farm size, and crop history so Kisan Unnati can personalize every recommendation.',
    },
    {
        icon: <FaRobot className="text-2xl md:text-3xl text-amber-600" />,
        accent: 'from-amber-500 via-orange-500 to-yellow-400',
        ring: 'ring-amber-200/70',
        title: 'Ask the AI assistant',
        description:
            'Use text or voice in your language to ask about crops, diseases, mandi prices, weather, and schemes.',
    },
    {
        icon: <FaLeaf className="text-2xl md:text-3xl text-emerald-600" />,
        accent: 'from-teal-500 via-emerald-500 to-green-400',
        ring: 'ring-emerald-200/70',
        title: 'Follow the smart plan',
        description:
            'Get crop recommendations, organic alternatives, irrigation tips, and disease treatment in simple steps.',
    },
    {
        icon: <FaStore className="text-2xl md:text-3xl text-slate-700" />,
        accent: 'from-slate-700 via-emerald-700 to-green-600',
        ring: 'ring-slate-200/80',
        title: 'Sell and grow',
        description:
            'List produce in the marketplace, connect with buyers directly, and keep learning through community content.',
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(180deg,_#f8fffb_0%,_#ffffff_45%,_#f3faf5_100%)] py-14 md:py-20 lg:py-28">
            <div className="pointer-events-none absolute -top-16 right-[-5rem] h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-300/30 via-lime-200/20 to-amber-200/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-6rem] left-[-5rem] h-80 w-80 rounded-full bg-gradient-to-bl from-amber-200/25 via-pink-200/15 to-emerald-200/20 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

            <div className="section-container relative z-10">
                <div className="mx-auto mb-10 max-w-3xl text-center md:mb-16">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.08)] backdrop-blur">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Step by step
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-emerald-700 sm:text-4xl md:text-5xl">
                        Agroudan Kisan Pragati
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                        A simple flow that helps farmers get guidance, make decisions, and reach the market faster.
                    </p>
                </div>

                <div className="mx-auto max-w-6xl">
                    <div className="hidden xl:block">
                        <div className="relative mx-auto aspect-square w-full max-w-[66rem]">
                            <div className="absolute inset-0 rounded-full border border-dashed border-emerald-200/70 bg-white/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] backdrop-blur-sm" />
                            <div className="absolute inset-6 rounded-full pointer-events-none bg-gradient-to-br from-emerald-50/30 via-amber-50/18 to-green-50/30 mix-blend-screen rounded-[9999px]" />
                            <div className="absolute inset-10 rounded-full border border-emerald-100/80 bg-gradient-to-br from-white/92 via-white/72 to-emerald-50/82 shadow-[0_24px_70px_rgba(16,185,129,0.08)]" />

                            <div className="absolute inset-0 xl:animate-[spin_42s_linear_infinite]">
                                <div className="absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-100 bg-white text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
                                    <div className="relative h-28 w-28 xl:animate-[spin_42s_linear_infinite_reverse]">
                                        <Image src="/logo.png" alt="Kisan Unnati logo" fill className="object-contain p-1" priority />
                                    </div>
                                </div>

                                <div className="absolute inset-0 grid place-items-center p-8">
                                    {steps.map((step, index) => {
                                        const positions = [
                                            'top-8 left-1/2 -translate-x-1/2',
                                            'right-8 top-1/2 -translate-y-1/2',
                                            'bottom-8 left-1/2 -translate-x-1/2',
                                            'left-8 top-1/2 -translate-y-1/2',
                                        ];

                                        return (
                                            <article
                                                key={step.title}
                                                className={`group absolute z-10 flex aspect-square w-[22rem] items-center justify-center ${positions[index]}`}
                                            >
                                                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-white/90 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.14)] xl:animate-[spin_42s_linear_infinite_reverse]">
                                                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.accent} opacity-10 blur-2xl transition duration-300 group-hover:opacity-30`} />
                                                    <div className={`absolute inset-2 rounded-full border border-white/70 bg-gradient-to-br ${step.accent} opacity-[0.07]`} />
                                                    <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-white/85 px-8">
                                                        <div className={`mb-4 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-white shadow-[0_14px_36px_rgba(15,23,42,0.12)] ring-1 ${step.ring}`}>
                                                            {step.icon}
                                                        </div>
                                                        <div className={`inline-flex rounded-full border border-white/70 bg-gradient-to-br ${step.accent} px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-white shadow-sm`}>
                                                            0{index + 1}
                                                        </div>
                                                        <h3 className="mt-3 text-[1rem] font-bold leading-5 tracking-tight text-slate-950">{step.title}</h3>
                                                        <p className="mt-2 px-1 text-[0.8rem] leading-5 text-slate-600">
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:hidden">
                        {steps.map((step, index) => (
                            <article
                                key={step.title}
                                className="group relative overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
                            >
                                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${step.accent}`} />
                                <div className="flex items-start gap-4">
                                    <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ${step.ring}`}>
                                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${step.accent} opacity-0 blur-xl transition duration-300 group-hover:opacity-20`} />
                                        {step.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-emerald-700">
                                            0{index + 1}
                                        </div>
                                        <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950">{step.title}</h3>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-600">{step.description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}