'use client';

import { usePageContext } from '@/hooks/usePageContext';

interface Props {
  title?: string;
  department?: string;
  summary?: string;
  benefits?: string[];
  eligibility?: string;
  applicationProcess?: string;
}

/**
 * Drop this into the scheme detail page to register the open scheme
 * with Pragati Root AI. Renders nothing visible.
 */
export default function SchemePageContext(props: Props) {
  usePageContext({
    pageContext: 'government',
    schemeData: props,
  });
  return null;
}
