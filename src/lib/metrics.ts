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

// ─── Store sales (what stores sell to their own customers) ───────────────────
// The data has one 30-day snapshot per store (revenue, orders30d, growthPercent), so every store-sales figure
// covers the last 30 days and compares with the 30 days before. growthPercent −100 means "no previous sales".

export interface StoreSalesRow {
  clientId: string;
  storeName: string;
  ownerEmail: string;
  plan: Client["plan"];
  status: Client["status"];
  sales: number;
  orders: number;
  /** Average order value; null without orders. */
  averageOrder: number | null;
  /** Change vs the previous 30 days; null when there were no sales then. */
  changePercent: number | null;
}

/** Sales in the previous 30 days, worked back from the current sales and the change. */
function previousSales(client: Client): number {
  return client.growthPercent <= -100 ? 0 : client.revenue / (1 + client.growthPercent / 100);
}

export function storeSalesRows(clients: Client[]): StoreSalesRow[] {
  return clients
    .map((client) => ({
      clientId: client.id,
      storeName: client.storeName,
      ownerEmail: client.ownerEmail,
      plan: client.plan,
      status: client.status,
      sales: client.revenue,
      orders: client.orders30d,
      averageOrder: client.orders30d > 0 ? client.revenue / client.orders30d : null,
      changePercent: client.growthPercent <= -100 ? null : client.growthPercent,
    }))
    .sort((a, b) => b.sales - a.sales);
}

export interface StoreSalesSummary {
  sales: number;
  orders: number;
  averageOrder: number | null;
  /** Total sales change vs the previous 30 days; null when nothing sold then. */
  changePercent: number | null;
  /** Stores with at least one order in the last 30 days. */
  sellingStores: number;
  totalStores: number;
}

export function storeSalesSummary(clients: Client[]): StoreSalesSummary {
  const sales = clients.reduce((sum, client) => sum + client.revenue, 0);
  const orders = clients.reduce((sum, client) => sum + client.orders30d, 0);
  const previous = clients.reduce((sum, client) => sum + previousSales(client), 0);
  return {
    sales,
    orders,
    averageOrder: orders > 0 ? sales / orders : null,
    changePercent: previous > 0 ? ((sales - previous) / previous) * 100 : null,
    sellingStores: clients.filter((client) => client.orders30d > 0).length,
    totalStores: clients.length,
  };
}

export interface StoreSalesByPlan {
  plan: Client["plan"];
  sales: number;
  orders: number;
  stores: number;
  sharePercent: number;
}

export function storeSalesByPlan(clients: Client[]): StoreSalesByPlan[] {
  const total = clients.reduce((sum, client) => sum + client.revenue, 0);
  const plans = [...new Set(clients.map((client) => client.plan))];
  return plans
    .map((plan) => {
      const group = clients.filter((client) => client.plan === plan);
      const sales = group.reduce((sum, client) => sum + client.revenue, 0);
      return {
        plan,
        sales,
        orders: group.reduce((sum, client) => sum + client.orders30d, 0),
        stores: group.length,
        sharePercent: total > 0 ? (sales / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.sales - a.sales);
}

/** Stores whose sales fell by this much or more are flagged on Store sales. */
export const SALES_DROP_ALERT_PERCENT = 20;
