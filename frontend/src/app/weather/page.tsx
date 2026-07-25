"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FaBell, FaCloud, FaHome, FaArrowLeft, FaSearch, FaMapMarkerAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import WeatherWidget from './WeatherWidget';
import { usePageContext } from '@/hooks/usePageContext';
import { useVoiceGuide } from '@/hooks/useVoiceGuide';

export default function Page() {
    const router = useRouter();
    usePageContext({ pageContext: 'weather' });
    useVoiceGuide('weather');

    const handleGoBack = () => {
        try {
            router.back();
        } catch (e) {
            router.push('/dashboard/farmer');
        }
    };
    return (
        <>
            <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_28%),linear-gradient(180deg,_#f8fdf7_0%,_#f2fbf5_42%,_#eef7ee_100%)]">
                <div className="pointer-events-none absolute inset-0 opacity-60">
                    <div className="absolute -left-16 top-24 h-40 w-40 rounded-full bg-emerald-300/30 blur-3xl" />
                    <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-lime-300/20 blur-3xl" />
                    <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
                </div>

                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 pt-4 md:pb-14 md:pt-6">
                    <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_28px_80px_rgba(20,83,45,0.12)] backdrop-blur-xl">
                        <div className="flex flex-col gap-4 border-b border-white/70 bg-gradient-to-r from-emerald-700 via-green-700 to-lime-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-white/15 p-2 ring-1 ring-white/20 backdrop-blur">
                                    <Image
                                        src="/logo.png"
                                        alt="Kisan Unnati Logo"
                                        width={34}
                                        height={34}
                                        className="rounded-xl bg-white p-0.5"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Live Farm Forecast</h1>
                                    <p className="text-sm text-emerald-50/85">Simple, live weather for quick farm decisions.</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={handleGoBack} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/18">
                                    <FaArrowLeft className="text-[0.8rem]" /> Back
                                </button>
                                <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/18">
                                    <FaHome className="text-[0.8rem]" /> Home
                                </Link>
                                <button className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/18">
                                    <FaBell className="text-[0.8rem]" /> Alerts
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3 sm:px-6">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Search</p>
                                <p className="mt-1 text-sm text-emerald-950">City, town, village</p>
                            </div>
                            <div className="rounded-2xl border border-lime-100 bg-lime-50/80 p-3 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-700">View</p>
                                <p className="mt-1 text-sm text-emerald-950">Current, daily, hourly</p>
                            </div>
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Source</p>
                                <p className="mt-1 text-sm text-emerald-950">WeatherAPI.com live data</p>
                            </div>
                        </div>
                    </header>

                    <div className="mt-6">
                        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/82 p-4 shadow-[0_24px_70px_rgba(20,83,45,0.12)] backdrop-blur-md sm:p-6 md:p-8">
                            <WeatherWidget />
                        </section>
                    </div>
                </div>
            </main >
        </>
    );
}
