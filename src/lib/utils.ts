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

export function daysUntil(isoDate: string, from: Date = new Date()): number {
  const target = new Date(isoDate);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(isoDate: string, withinDays = 7): boolean {
  const days = daysUntil(isoDate);
  return days >= 0 && days <= withinDays;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
