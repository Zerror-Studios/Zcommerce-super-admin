/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Date formatting (docs/design/05-wording.md §2). Fixed English month and weekday names, so the output
 * doesn't depend on the browser's locale data (en-IN in recent ICU writes "Sept"; the spec says "Sep").
 *
 *   formatDate      "14 Oct" · "14 Oct 2025" (year only when it isn't the current year)
 *   formatDateTime  "14 Oct, 4:58 pm"
 *   formatRange     "15 Sep – 14 Oct"
 *   formatRelative  "now" · "2m" · "1h" · "Yesterday" · "Mon", then formatDate (feeds and notifications only)
 *
 * Every function returns "—" for a missing or invalid date.
 */

export type DateInput = string | number | Date | null | undefined;

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY = "—";
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "4:58 pm" */
function time(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/** "14 Oct", or "14 Oct 2025" outside the current year. */
export function formatDate(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  return date.getFullYear() === now.getFullYear() ? dayMonth(date) : `${dayMonth(date)} ${date.getFullYear()}`;
}

/** "14 Oct, 4:58 pm" (lower-case am/pm; year added outside the current year). */
export function formatDateTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  return `${formatDate(date, now)}, ${time(date)}`;
}

/**
 * "15 Sep – 14 Oct" (en dash with spaces). One date when both ends are the same day.
 * The year is shown once at the end when both ends share a past or future year ("15 Sep – 14 Oct 2025"),
 * and on each end when the years differ ("20 Dec 2025 – 14 Jan 2026").
 */
export function formatRange(start: DateInput, end: DateInput, now: Date = new Date()): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return from ? formatDate(from, now) : to ? formatDate(to, now) : EMPTY;
  if (sameDay(from, to)) return formatDate(from, now);
  if (from.getFullYear() !== to.getFullYear()) {
    return `${dayMonth(from)} ${from.getFullYear()} – ${dayMonth(to)} ${to.getFullYear()}`;
  }
  return `${dayMonth(from)} – ${formatDate(to, now)}`;
}

/**
 * Relative time for feeds and notifications (under 7 days): "now" · "2m" · "1h" · "Yesterday" · "Mon".
 * Older (or future) dates fall back to formatDate.
 */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return diff > -60000 ? "now" : formatDate(date, now);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (sameDay(date, now)) return `${Math.floor(minutes / 60)}h`;
  if (sameDay(date, new Date(now.getTime() - DAY_MS))) return "Yesterday";
  if (diff < 7 * DAY_MS) return WEEKDAYS[date.getDay()];
  return formatDate(date, now);
}
