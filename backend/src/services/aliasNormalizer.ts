/**
 * Alias Normalizer — Backward-Compatibility Shim
 *
 * All alias logic has been consolidated into aliasResolver.ts (Fix 3).
 * This file re-exports from aliasResolver so existing imports continue to work
 * without any changes to callers.
 *
 * DO NOT add new logic here. Use aliasResolver.ts directly.
 */

export {
  resolveAlias      as normalizeAlias,
  prepareForIntentDetection,
  getAliasesForDomain,
  type AliasResolveResult as AliasResult,
} from './aliasResolver';
