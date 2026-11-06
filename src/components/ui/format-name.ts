/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Names in the UI (round 2 G13): plan names in Title Case ("Starter", "Growth", "Plus", "Custom"), never CAPS.
 * Words already written in mixed case are kept as they are ("Pro Plus", "eCom"); only all-caps or all-lower words
 * and codes ("STARTER", "growth_plus") are rewritten. "—" for a missing name.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY = "—";

// ─── Formatters ──────────────────────────────────────────────────────────────

/** "STARTER" → "Starter" · "GROWTH_PLUS" → "Growth Plus" · "Pro Plus" stays. */
export function formatPlanName(name: string | null | undefined): string {
  const text = (name ?? "").trim();
  if (!text) return EMPTY;
  return text
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => {
      const isUniform = word === word.toUpperCase() || word === word.toLowerCase();
      return isUniform ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
    })
    .join(" ");
}
