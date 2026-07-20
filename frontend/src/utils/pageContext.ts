/**
 * Page Context Auto-Detector
 * Reads the current URL pathname and returns the matching context key
 * used by the Language Engine for category-prioritized lookups.
 *
 * Context keys map to CONTEXT_PRIORITY in languageDictionaryService.ts:
 *   disease | soil | government | weather | market | crop | shop | ui
 */

const CONTEXT_MAP: Array<{ pattern: RegExp; context: string }> = [
  { pattern: /disease/i,                               context: 'disease' },
  { pattern: /soil/i,                                  context: 'soil' },
  { pattern: /scheme|government|govt/i,                context: 'government' },
  { pattern: /weather/i,                               context: 'weather' },
  { pattern: /mandi|market|price/i,                    context: 'market' },
  { pattern: /crop-advisory|crop-recommendation|crop/i, context: 'crop' },
  { pattern: /shop|marketplace/i,                      context: 'shop' },
];

export function detectPageContext(pathname?: string): string {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  for (const { pattern, context } of CONTEXT_MAP) {
    if (pattern.test(path)) return context;
  }
  return 'ui';
}
