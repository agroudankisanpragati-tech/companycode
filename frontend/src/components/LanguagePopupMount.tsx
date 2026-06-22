'use client';

import { useLanguage } from '@/context/LanguageContext';
import LanguagePopup from './LanguagePopup';

export default function LanguagePopupMount() {
  const { showPopup } = useLanguage();
  if (!showPopup) return null;
  return <LanguagePopup />;
}
