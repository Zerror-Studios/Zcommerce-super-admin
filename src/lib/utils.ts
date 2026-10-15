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

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
