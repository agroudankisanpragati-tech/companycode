'use client';

import { useEffect } from 'react';
import { useVoiceGuide } from '@/hooks/useVoiceGuide';

export default function HomeVoiceGuide() {
  useVoiceGuide('home');
  return null;
}
