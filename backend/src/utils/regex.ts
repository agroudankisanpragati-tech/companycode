/**
 * Regex helpers for safe user-input matching.
 */

export function escapeRegExp(input: string): string {
  return String(input ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createSafeRegex(input: string, flags = 'i'): RegExp {
  return new RegExp(escapeRegExp(input), flags);
}

export function createExactSafeRegex(input: string, flags = 'i'): RegExp {
  return new RegExp(`^${escapeRegExp(input)}$`, flags);
}