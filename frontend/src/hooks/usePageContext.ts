'use client';

import { useEffect, useRef } from 'react';
import { useAIAssistant, PageData } from '@/context/AIAssistantContext';

/**
 * usePageContext — registers live page data with Pragati AI.
 *
 * Call this once at the top of any page component (after all useState calls):
 *
 *   usePageContext({ pageContext: 'disease', diseaseResult: result });
 *
 * Pragati AI will then answer from the data currently on that page.
 * When the page unmounts, the context is cleared automatically.
 *
 * Uses a ref-based serialization check to avoid infinite re-renders.
 */
export function usePageContext(data: PageData | null) {
  const { setPageData } = useAIAssistant();
  const prevRef = useRef<string>('');

  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === prevRef.current) return;
    prevRef.current = serialized;
    setPageData(data);
    return () => {
      prevRef.current = '';
      setPageData(null);
    };
  // setPageData is stable (useCallback in context), data identity changes handled by serialization
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);
}
