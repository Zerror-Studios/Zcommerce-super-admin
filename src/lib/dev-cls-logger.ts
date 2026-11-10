/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Dev-only CLS logger (round 3 D3): measures layout shift per page so CLS < 0.02 can be checked on Home, Orders,
 * Products, Customers, Marketing, Insights, Traffic and the Super Admin Home / Store pages without extra tools.
 *
 * - Started from main.tsx only when `import.meta.env.DEV` (never in a build). No dependency: a PerformanceObserver
 *   on `layout-shift` (Chromium; elsewhere it does nothing).
 * - CLS is computed like web-vitals: shifts without recent input, grouped in session windows (gap < 1s, window
 *   < 5s), the largest window counts. One page = the path plus the in-page tab (`?tab=`, `?section=`).
 * - When the page changes, one console line: `[CLS] /admin/orders?tab=toPack 0.004 ✓` (or "over 0.02"), with the
 *   elements that moved most. `window.__zcCls()` prints the table of every page seen in this tab.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayoutShiftSource {
  node?: Node | null;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: LayoutShiftSource[];
}

interface PageCls {
  cls: number;
  shifts: number;
  /** The elements behind the largest shifts, as short selectors. */
  movers: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_CLS = 0.02;
const SESSION_GAP_MS = 1_000;
const SESSION_MAX_MS = 5_000;
const ROUTE_POLL_MS = 250;
const MOVERS_MAX = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pageKey = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = ["tab", "section"]
    .map((name) => (params.get(name) ? `${name}=${params.get(name)}` : ""))
    .filter(Boolean)
    .join("&");
  return `${window.location.pathname}${tab ? `?${tab}` : ""}`;
};

const describe = (node?: Node | null): string => {
  if (!node || !(node instanceof Element)) return node?.nodeName?.toLowerCase() ?? "?";
  const id = node.id ? `#${node.id}` : "";
  const classes = Array.from(node.classList).slice(0, 2).map((name) => `.${name}`).join("");
  return `${node.tagName.toLowerCase()}${id}${classes}`;
};

// ─── Logger ───────────────────────────────────────────────────────────────────

/** Starts measuring; returns a stop function. Safe to call where `layout-shift` isn't supported (no-op). */
export function startClsLogger(): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => undefined;
  if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) return () => undefined;

  const pages = new Map<string, PageCls>();
  let key = pageKey();
  let current: PageCls = { cls: 0, shifts: 0, movers: [] };
  let session = 0;
  let sessionStart = 0;
  let lastShift = 0;

  const finish = () => {
    const best = Math.max(pages.get(key)?.cls ?? 0, current.cls);
    pages.set(key, { ...current, cls: best });
    const verdict = best < TARGET_CLS ? "✓" : `over ${TARGET_CLS}`;
    console.info(`[CLS] ${key} ${best.toFixed(3)} ${verdict}`, current.movers.length ? current.movers : "");
  };

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LayoutShiftEntry[]) {
      if (entry.hadRecentInput) continue;
      const startsNew = entry.startTime - lastShift > SESSION_GAP_MS || entry.startTime - sessionStart > SESSION_MAX_MS;
      if (startsNew) {
        session = 0;
        sessionStart = entry.startTime;
      }
      session += entry.value;
      lastShift = entry.startTime;
      current.shifts += 1;
      current.cls = Math.max(current.cls, session);
      if (entry.value >= 0.001) {
        const movers = (entry.sources ?? []).map((source) => `${describe(source.node)} (${entry.value.toFixed(3)})`);
        current.movers = [...current.movers, ...movers].slice(-MOVERS_MAX);
      }
    }
  });
  observer.observe({ type: "layout-shift", buffered: true });

  // The router changes the URL with the History API; a light poll is enough for a dev tool.
  const poll = window.setInterval(() => {
    const next = pageKey();
    if (next === key) return;
    finish();
    key = next;
    current = { cls: 0, shifts: 0, movers: [] };
    session = 0;
    sessionStart = 0;
    lastShift = 0;
  }, ROUTE_POLL_MS);

  (window as Window & { __zcCls?: () => void }).__zcCls = () => {
    finish();
    console.table(
      Array.from(pages.entries()).map(([page, value]) => ({
        page,
        cls: Number(value.cls.toFixed(3)),
        ok: value.cls < TARGET_CLS,
        shifts: value.shifts,
      })),
    );
  };

  return () => {
    observer.disconnect();
    window.clearInterval(poll);
  };
}
