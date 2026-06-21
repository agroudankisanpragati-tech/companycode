'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAIAssistant } from '@/context/AIAssistantContext';

export default function AIAssistantPage() {
  const router = useRouter();
  const { openAssistant } = useAIAssistant();

  useEffect(() => {
    openAssistant();
    router.replace('/dashboard/farmer');
  }, [openAssistant, router]);

  return null;
}
