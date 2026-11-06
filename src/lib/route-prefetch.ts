/**
 * Route prefetch (docs review-r2 ROUND-2-FIXES.md §2 "Prefetching", round 2 R2-10): a menu link under the pointer
 * or in focus loads its page's code before the click (the Sidebar's `onPrefetch`). The imports are the same as
 * App.tsx's `lazy()` ones, so Vite serves one chunk. Store tabs prefetch their data in StoreTabsPrefetch.
 */

/** A section is warmed at most once per session. */
const warmed = new Set<string>();

const ROUTES: Record<string, () => Promise<unknown>> = {
  "": () => import("../pages/Home"),
  stores: () => import("../pages/Clients"),
  subscriptions: () => import("../pages/Subscriptions"),
  analytics: () => import("../pages/Analytics"),
  ai: () => import("../pages/Ai"),
  settings: () => import("../pages/Settings"),
  "support/tickets": () => import("../pages/SupportTickets"),
  "support/announcements": () => import("../pages/SupportAnnouncements"),
  "support/guides": () => import("../pages/SupportGuides"),
  "system-health": () => import("../pages/SystemHealth"),
};

/** "/analytics/revenue" → "analytics"; "/support/tickets" → "support/tickets". */
function sectionOf(path: string): string | undefined {
  const parts = path.replace(/^\/|\/$/g, "").split("/");
  const two = parts.slice(0, 2).join("/");
  if (two in ROUTES) return two;
  return parts[0] in ROUTES ? parts[0] : undefined;
}

export function prefetchRoute(path: string): void {
  const section = sectionOf(path);
  if (section == null || warmed.has(section)) return;
  warmed.add(section);
  ROUTES[section]().catch(() => warmed.delete(section));
}
