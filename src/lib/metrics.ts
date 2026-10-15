/**
 * Platform money metrics: ONE definition each, used by Home, Billing and Analytics
 * (docs/design/04-super-admin.md §2). Before this file, Home showed a hard-coded MRR (₹1,282) while
 * Revenue computed ₹982 from the stores; both now read monthlyBilling().
 *
 * The data has no invoices yet, so:
 * - "earned" = successful transactions minus refunds in the period;
 * - "outstanding" = the open invoice rows Billing › Collections lists (pending transactions, plus due subscriptions
 *   with no pending transaction), so Home's Outstanding equals Collections' Pending + Overdue.
 */
import type { Client, Subscription, Transaction } from "../types";
import { buildPaymentReportRows } from "./subscriptionReports";

// ─── Periods ─────────────────────────────────────────────────────────────────

export type YearKind = "calendar" | "financial";

export interface Period {
  start: Date;
  /** Exclusive. */
  end: Date;
}

export function monthPeriod(now: Date = new Date()): Period {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/** Calendar year (1 Jan) or Indian financial year (1 Apr – 31 Mar) containing `now`. */
export function yearPeriod(now: Date = new Date(), kind: YearKind = "calendar"): Period {
  if (kind === "calendar") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: new Date(startYear, 3, 1), end: new Date(startYear + 1, 3, 1) };
}

function inPeriod(iso: string, period: Period): boolean {
  const time = new Date(iso).getTime();
  return time >= period.start.getTime() && time < period.end.getTime();
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

/** Stores we bill: everything except suspended (no cancelled state exists in the data yet). */
export function isBillable(client: Client): boolean {
  return client.status !== "suspended";
}

/** Monthly billing: sum of monthly fees of billable stores. Label "Monthly billing" (tooltip: monthly recurring revenue). */
export function monthlyBilling(clients: Client[]): number {
  return clients.filter(isBillable).reduce((sum, client) => sum + client.mrr, 0);
}

/** Successful payments received in the period, minus refunds. */
export function earnedIn(transactions: Transaction[], period: Period): number {
  return transactions
    .filter((txn) => inPeriod(txn.date, period))
    .reduce((sum, txn) => {
      if (txn.status === "success") return sum + txn.amount;
      if (txn.status === "refunded") return sum - txn.amount;
      return sum;
    }, 0);
}

/** Stores with at least one successful payment in the period. */
export function storesPaidIn(transactions: Transaction[], period: Period): number {
  return new Set(
    transactions.filter((txn) => txn.status === "success" && inPeriod(txn.date, period)).map((txn) => txn.clientId),
  ).size;
}

/** Earned so far this year + monthly billing for each month left in the year after the current one. */
export function projectedForYear(
  clients: Client[],
  transactions: Transaction[],
  now: Date = new Date(),
  kind: YearKind = "calendar",
): number {
  const year = yearPeriod(now, kind);
  const monthsLeft =
    (year.end.getFullYear() - now.getFullYear()) * 12 + (year.end.getMonth() - now.getMonth()) - 1;
  return earnedIn(transactions, { start: year.start, end: now }) + monthlyBilling(clients) * Math.max(monthsLeft, 0);
}

export interface Outstanding {
  amount: number;
  /** Stores with something due or overdue. */
  unpaidStores: number;
  /** Of those, past their due date. */
  overdueStores: number;
}

/** Issued and not yet paid (due + overdue), from the same invoice rows as Billing › Collections. */
export function outstanding(
  data: { clients: Client[]; subscriptions: Subscription[]; transactions: Transaction[] },
  now: Date = new Date(),
): Outstanding {
  const open = buildPaymentReportRows({ ...data, asOf: now }).filter(
    (row) => row.status === "pending" || row.status === "overdue",
  );
  return {
    amount: open.reduce((sum, row) => sum + row.amount, 0),
    unpaidStores: new Set(open.map((row) => row.clientId)).size,
    overdueStores: new Set(open.filter((row) => row.status === "overdue").map((row) => row.clientId)).size,
  };
}

/** Collected ÷ (collected + outstanding) for the period, as a percentage; null when nothing was billed. */
export function collectionRate(collected: number, open: number): number | null {
  const billed = collected + open;
  return billed > 0 ? (collected / billed) * 100 : null;
}
