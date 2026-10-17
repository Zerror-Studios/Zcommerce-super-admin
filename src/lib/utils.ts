import { formatCount, formatDelta, formatMoney } from "../components/ui/money";
import { formatDate as kitFormatDate, formatDateTime as kitFormatDateTime } from "../components/ui/format-date";
// Money and number formatting delegate to the shared formatters (component-specs §20) so both products match.
export function formatCurrency(value: number, currency = "INR", compact = false): string {
  return formatMoney(value, { currency, compact });
}

export function formatNumber(value: number, compact = false): string {
  return formatCount(value, compact);
}

export function formatPercent(value: number, digits = 1): string {
  return formatDelta(value, digits);
}

/** "14 Oct", or "14 Oct 2025" outside the current year (docs/design/05-wording.md §2); shared kit helper. */
export function formatDate(iso: string): string {
  return kitFormatDate(iso);
}

/** "14 Oct, 4:58 pm". */
export function formatDateTime(iso: string): string {
  return kitFormatDateTime(iso);
}

// ─── UTC date math (PRD-002 SA-5) ─────────────────────────────────────────
// Data dates are UTC (ISO strings; date-only strings parse as UTC midnight).
// Calendar values picked in the UI (a month, a range day) are read from their
// local fields and mapped to the same UTC calendar day. Day differences are
// taken between UTC midnights and rounded with Math.round — the one rule.

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** UTC midnight of the instant's UTC calendar day. */
export function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Whole UTC calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (utcDayStart(to).getTime() - utcDayStart(from).getTime()) / MS_PER_DAY,
  );
}

/** UTC start of the calendar day a UI picker value (local fields) represents. */
export function calendarDayStartUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/** UTC end (23:59:59.999) of the calendar day a UI picker value represents. */
export function calendarDayEndUtc(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/** UTC bounds of a calendar month given as a UI value (local fields). */
export function calendarMonthBoundsUtc(month: Date): {
  start: Date;
  end: Date;
} {
  return utcMonthBounds(month.getFullYear(), month.getMonth() + 1);
}

/** UTC bounds of `year`/`month` (month is 1-12). */
export function utcMonthBounds(
  year: number,
  month: number,
): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/** Calendar month (local-field value, day 1) containing the instant's UTC day. */
export function calendarMonthOf(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function daysUntil(isoDate: string, from: Date = new Date()): number {
  return daysBetween(from, new Date(isoDate));
}

export function isExpiringSoon(isoDate: string, withinDays = 7): boolean {
  const days = daysUntil(isoDate);
  return days >= 0 && days <= withinDays;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
