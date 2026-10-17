/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * AI surfaces (docs/design/README.md Phase 7) are always on (owner decision 2026-10-17): no switch, no
 * VITE_FEATURE_AI, no per-browser localStorage flag. The hook stays so AI call sites keep one place to gate on
 * if a real switch is ever needed again. Answers are samples until the assistant backend exists.
 */

export function isAiEnabled(): boolean {
  return true;
}

/** Kept for existing call sites; AI is always on. */
export function useAiEnabled(): boolean {
  return true;
}
