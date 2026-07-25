'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useVoiceGuideContext } from '@/context/VoiceGuideContext';

const PAGE_MAP: Array<{ pattern: RegExp; page: string }> = [
  { pattern: /\/auth\/login/,                                    page: 'login' },
  { pattern: /\/auth\/register/,                                 page: 'register' },
  { pattern: /\/auth/,                                           page: 'login' },
  { pattern: /\/dashboard\/farmer\/profile/,                     page: 'profile' },
  { pattern: /\/dashboard\/farmer\/soil-health/,                 page: 'soil_health' },
  { pattern: /\/dashboard\/farmer\/my-crops/,                    page: 'crop_recommendation' },
  { pattern: /\/dashboard\/farmer/,                              page: 'home' },
  { pattern: /\/disease-detection/,                              page: 'disease_detection' },
  { pattern: /\/crop-recommendation/,                            page: 'crop_recommendation' },
  { pattern: /\/soil-health/,                                    page: 'soil_health' },
  { pattern: /\/weather/,                                        page: 'weather' },
  { pattern: /\/mandi-prices/,                                   page: 'mandi' },
  { pattern: /\/marketplace/,                                    page: 'marketplace' },
  { pattern: /\/schemes|\/rajasthan\/schemes/,                   page: 'government_scheme' },
  { pattern: /\/ai-assistant/,                                   page: 'ai_chat' },
  { pattern: /\/settings/,                                       page: 'app_settings' },
  { pattern: /^\/$/,                                             page: 'home' },
];

function detectPage(pathname: string): string {
  for (const { pattern, page } of PAGE_MAP) {
    if (pattern.test(pathname)) return page;
  }
  return 'home';
}

export default function VoiceGuideNavigator() {
  const pathname = usePathname();
  const guide = useVoiceGuideContext();
  const prevPathRef = useRef('');
  const prevPageRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pathname || pathname === prevPathRef.current) return;

    const prevPage = prevPageRef.current;
    const nextPage = detectPage(pathname);

    // Play exit on previous page before navigating
    if (prevPage && prevPage !== nextPage && guide.bridgeOnline) {
      guide.play(prevPage, 'exit').catch(() => {});
    }

    prevPathRef.current = pathname;
    prevPageRef.current = nextPage;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      guide.openPage(nextPage);
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
