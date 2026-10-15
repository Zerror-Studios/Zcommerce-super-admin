/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/** Shell helpers: keyboard shortcuts, remembered sidebar state, relative times. */
import { useEffect } from "react";

/** ⌘K / Ctrl+K opens the palette; ⌘\ / Ctrl+\ toggles the sidebar; ⌘J / Ctrl+J opens the assistant (when given). */
export function useShellHotkeys({
  onSearch,
  onToggleSidebar,
  onAsk,
}: {
  onSearch?: () => void;
  onToggleSidebar?: () => void;
  onAsk?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() === "k" && onSearch) {
        event.preventDefault();
        onSearch();
      } else if (event.key === "\\" && onToggleSidebar) {
        event.preventDefault();
        onToggleSidebar();
      } else if (event.key.toLowerCase() === "j" && onAsk) {
        event.preventDefault();
        onAsk();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch, onToggleSidebar, onAsk]);
}

/** Remembers the collapsed sidebar in localStorage (falls back to expanded when storage is unavailable). */
export function readStoredFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function storeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable (private mode): keep the in-memory state only */
  }
}

const DAY = 24 * 60 * 60 * 1000;
const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** Relative time for feeds (docs/design/05-wording.md §2): 2m · 1h · Yesterday · Mon, then "14 Oct". */
export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const diff = now.getTime() - date.getTime();
  if (Number.isNaN(diff)) return "";
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (isSameDay(date, now)) return `${Math.round(minutes / 60)}h`;
  if (isSameDay(date, new Date(now.getTime() - DAY))) return "Yesterday";
  if (diff < 7 * DAY) return weekday.format(date);
  return dayMonth.format(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
