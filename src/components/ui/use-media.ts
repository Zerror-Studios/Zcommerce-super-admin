/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Viewport bands for the responsive kit (docs/design-v2/README.md §10): desktop 1280px and up (as designed), laptop
 * 1024–1279, tablet 768–1023, phone under 768. The CSS uses the same edges (Tailwind md 768, lg 1024, xl 1280).
 * Components that must render differently (not just restyle) read the band here, so every part switches at the
 * same width.
 */
import { useSyncExternalStore } from "react";

// ─── Queries ─────────────────────────────────────────────────────────────────

export const PHONE_QUERY = "(max-width: 767px)";
/** Tablet and phone: secondary title-row buttons move into ⋯. */
export const BELOW_LAPTOP_QUERY = "(max-width: 1023px)";
/** Laptop, tablet and phone: the menu is the 72px rail (phone: a drawer). */
export const BELOW_DESKTOP_QUERY = "(max-width: 1279px)";
/** No hover (touch screens): anything shown on hover needs a tap equivalent. */
export const NO_HOVER_QUERY = "(hover: none)";

export type ViewportBand = "phone" | "tablet" | "laptop" | "desktop";

// ─── Hooks ───────────────────────────────────────────────────────────────────

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** True while the media query matches; follows changes (rotation, window resize). False without matchMedia. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (canMatch() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Under 768px. */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** The current band: phone < 768 ≤ tablet < 1024 ≤ laptop < 1280 ≤ desktop. */
export function useViewportBand(): ViewportBand {
  const phone = useMediaQuery(PHONE_QUERY);
  const belowLaptop = useMediaQuery(BELOW_LAPTOP_QUERY);
  const belowDesktop = useMediaQuery(BELOW_DESKTOP_QUERY);
  if (phone) return "phone";
  if (belowLaptop) return "tablet";
  if (belowDesktop) return "laptop";
  return "desktop";
}
