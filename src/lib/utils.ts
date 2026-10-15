import { formatCount, formatDelta, formatMoney } from "../components/ui/money";
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

/** "14 Oct", or "14 Oct 2025" outside the current year (docs/design/05-wording.md §2). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" as const }),
  }).format(date);
}

/** "14 Oct, 4:58 pm". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    .replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toLowerCase()}`);
  return `${formatDate(iso)}, ${time}`;
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
