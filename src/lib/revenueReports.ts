import {
  planNameEnum,
  subscriptionStatusEnum,
  type Client,
  type PaymentGateway,
  type PlanName,
  type Subscription,
  type Transaction,
  type TransactionStatus,
} from "../types";
import { PAYMENT_GATEWAYS, PLAN_NAMES } from "./display-labels.util";
import { latestSubscriptionByClient } from "./subscription-lookup.util";
import {
  calendarDayEndUtc,
  calendarDayStartUtc,
  utcMonthBounds,
} from "./utils";

export interface MonthlyPlanRevenue {
  key: string; // YYYY-MM
  label: string;
  year: number;
  month: number; // 1-12
  STARTER: number;
  PREMIUM: number;
  PLUS: number;
  ENTERPRISE: number;
}

export interface RevenueKpis {
  planRevenue: number;
  netCollected: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
  activeMrr: number;
  payingStores: number;
  momChangePercent: number | null;
}

export interface PlanBreakdownRow {
  plan: PlanName;
  revenue: number;
  sharePercent: number;
  storeCount: number;
  mrr: number;
}

export interface GatewayBreakdownRow {
  gateway: PaymentGateway;
  collected: number;
  failed: number;
  pending: number;
  refunded: number;
  sharePercent: number;
}

export interface TopStoreRevenueRow {
  clientId: string;
  storeName: string;
  ownerEmail: string;
  plan: PlanName;
  collected: number;
  failed: number;
  txnCount: number;
}

export interface RevenueTrendPoint {
  month: string;
  fullLabel: string;
  revenue: number;
  mrr: number;
}

/** Demo monthly subscription revenue by plan (2025-10 → 2026-09). */
export const MONTHLY_PLAN_REVENUE: MonthlyPlanRevenue[] = [
  { key: "2025-10", label: "Oct 2025", year: 2025, month: 10, STARTER: 0, PREMIUM: 3800, PLUS: 8600, ENTERPRISE: 10800 },
  { key: "2025-11", label: "Nov 2025", year: 2025, month: 11, STARTER: 0, PREMIUM: 4000, PLUS: 9100, ENTERPRISE: 11200 },
  { key: "2025-12", label: "Dec 2025", year: 2025, month: 12, STARTER: 0, PREMIUM: 4300, PLUS: 9600, ENTERPRISE: 11800 },
  { key: "2026-01", label: "Jan 2026", year: 2026, month: 1, STARTER: 0, PREMIUM: 4500, PLUS: 9900, ENTERPRISE: 12200 },
  { key: "2026-02", label: "Feb 2026", year: 2026, month: 2, STARTER: 0, PREMIUM: 4700, PLUS: 10300, ENTERPRISE: 12800 },
  { key: "2026-03", label: "Mar 2026", year: 2026, month: 3, STARTER: 0, PREMIUM: 4900, PLUS: 10700, ENTERPRISE: 13400 },
  { key: "2026-04", label: "Apr 2026", year: 2026, month: 4, STARTER: 0, PREMIUM: 4200, PLUS: 9800, ENTERPRISE: 12000 },
  { key: "2026-05", label: "May 2026", year: 2026, month: 5, STARTER: 0, PREMIUM: 4600, PLUS: 10200, ENTERPRISE: 13200 },
  { key: "2026-06", label: "Jun 2026", year: 2026, month: 6, STARTER: 0, PREMIUM: 5100, PLUS: 11100, ENTERPRISE: 14000 },
  { key: "2026-07", label: "Jul 2026", year: 2026, month: 7, STARTER: 0, PREMIUM: 5400, PLUS: 11800, ENTERPRISE: 15100 },
  { key: "2026-08", label: "Aug 2026", year: 2026, month: 8, STARTER: 0, PREMIUM: 5800, PLUS: 12400, ENTERPRISE: 16200 },
  { key: "2026-09", label: "Sep 2026", year: 2026, month: 9, STARTER: 0, PREMIUM: 6100, PLUS: 13100, ENTERPRISE: 17100 },
];

const PLANS: PlanName[] = PLAN_NAMES;

// Ranges come from the date picker (local calendar days); rows and
// transactions are UTC. Compare both on UTC calendar days (PRD-002 SA-5).
function monthOverlapsRange(
  row: MonthlyPlanRevenue,
  start: Date,
  end: Date,
): boolean {
  const { start: s, end: e } = utcMonthBounds(row.year, row.month);
  return s <= calendarDayEndUtc(end) && e >= calendarDayStartUtc(start);
}

// ─── MRR (PRD-002 SA-4) ───────────────────────────────────────────────────
// One definition, used by the KPI card, the plan breakdown and the trend:
// MRR = sum of the monthly-normalised price (`Subscription.mrr`) of paying,
// non-trial subscriptions — status ACTIVE, mrr > 0 — that had started and
// were not cancelled at the given instant. One (latest) subscription per
// client is counted.

/** MRR one subscription contributes at `at`; 0 when it doesn't count. */
export function subscriptionMrrAt(subscription: Subscription, at: Date): number {
  const atMs = at.getTime();

  if (subscription.status !== subscriptionStatusEnum.ACTIVE) return 0;
  if (subscription.mrr <= 0) return 0;
  if (
    subscription.startedAt &&
    new Date(subscription.startedAt).getTime() > atMs
  ) {
    return 0;
  }
  if (
    subscription.canceledAt &&
    new Date(subscription.canceledAt).getTime() <= atMs
  ) {
    return 0;
  }

  return subscription.mrr;
}

/** Subscriptions that count towards MRR at `at` (latest per client). */
export function mrrSubscriptionsAt(
  subscriptions: Subscription[],
  at: Date,
): Subscription[] {
  return Array.from(latestSubscriptionByClient(subscriptions, at).values())
    .filter((subscription) => subscriptionMrrAt(subscription, at) > 0);
}

/** Platform MRR at `at`. */
export function computeMrr(subscriptions: Subscription[], at: Date): number {
  return mrrSubscriptionsAt(subscriptions, at).reduce(
    (sum, subscription) => sum + subscriptionMrrAt(subscription, at),
    0,
  );
}

export function filterMonthlyPlanRevenue(
  rows: MonthlyPlanRevenue[],
  start: Date,
  end: Date,
): MonthlyPlanRevenue[] {
  return rows.filter((row) => monthOverlapsRange(row, start, end));
}

export function monthTotal(row: MonthlyPlanRevenue): number {
  return row.STARTER + row.PREMIUM + row.PLUS + row.ENTERPRISE;
}

export function filterTransactionsInRange(
  transactions: Transaction[],
  start: Date,
  end: Date,
): Transaction[] {
  const startMs = calendarDayStartUtc(start).getTime();
  const endMs = calendarDayEndUtc(end).getTime();
  return transactions.filter((txn) => {
    const t = new Date(txn.date).getTime();
    return t >= startMs && t <= endMs;
  });
}

function sumByStatus(
  transactions: Transaction[],
  status: TransactionStatus,
): number {
  return transactions
    .filter((t) => t.status === status)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function buildRevenueKpis(input: {
  monthly: MonthlyPlanRevenue[];
  allMonthly: MonthlyPlanRevenue[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  rangeStart: Date;
  rangeEnd: Date;
  /** Instant for the live MRR figures. Default: now. */
  asOf?: Date;
}): RevenueKpis {
  const {
    monthly,
    allMonthly,
    transactions,
    subscriptions,
    rangeStart,
    rangeEnd,
    asOf = new Date(),
  } = input;

  const planRevenue = monthly.reduce((sum, row) => sum + monthTotal(row), 0);
  const inRange = filterTransactionsInRange(transactions, rangeStart, rangeEnd);
  const collected = sumByStatus(inRange, "success");
  const refunded = sumByStatus(inRange, "refunded");
  const pending = sumByStatus(inRange, "pending");
  const failed = sumByStatus(inRange, "failed");

  const payingStores = mrrSubscriptionsAt(subscriptions, asOf).length;
  const activeMrr = computeMrr(subscriptions, asOf);

  let momChangePercent: number | null = null;
  if (monthly.length > 0) {
    const last = monthly[monthly.length - 1];
    const lastIdx = allMonthly.findIndex((r) => r.key === last.key);
    const prev = lastIdx > 0 ? allMonthly[lastIdx - 1] : undefined;
    if (prev) {
      const prevTotal = monthTotal(prev);
      const lastTotal = monthTotal(last);
      momChangePercent =
        prevTotal === 0 ? null : ((lastTotal - prevTotal) / prevTotal) * 100;
    }
  }

  return {
    planRevenue,
    netCollected: collected - refunded,
    pendingAmount: pending,
    failedAmount: failed,
    refundedAmount: refunded,
    activeMrr,
    payingStores,
    momChangePercent,
  };
}

export function buildPlanBreakdown(
  monthly: MonthlyPlanRevenue[],
  clients: Client[],
  subscriptions: Subscription[],
  asOf: Date = new Date(),
): PlanBreakdownRow[] {
  const revenueByPlan: Record<PlanName, number> = {
    STARTER: 0,
    PREMIUM: 0,
    PLUS: 0,
    ENTERPRISE: 0,
  };
  const mrrSubscriptions = mrrSubscriptionsAt(subscriptions, asOf);
  for (const row of monthly) {
    for (const plan of PLANS) revenueByPlan[plan] += row[plan];
  }
  const total = PLANS.reduce((s, p) => s + revenueByPlan[p], 0);

  return PLANS.map((plan) => {
    const revenue = revenueByPlan[plan];
    const planClients = clients.filter((c) => c.plan === plan);
    return {
      plan,
      revenue,
      sharePercent: total === 0 ? 0 : (revenue / total) * 100,
      storeCount: planClients.length,
      mrr: mrrSubscriptions
        .filter((sub) => sub.plan === plan)
        .reduce((sum, sub) => sum + subscriptionMrrAt(sub, asOf), 0),
    };
  }).filter((row) => row.revenue > 0 || row.storeCount > 0);
}

export function buildGatewayBreakdown(
  transactions: Transaction[],
  start: Date,
  end: Date,
): GatewayBreakdownRow[] {
  const inRange = filterTransactionsInRange(transactions, start, end);
  const rows = PAYMENT_GATEWAYS.map((gateway) => {
    const subset = inRange.filter((t) => t.gateway === gateway);
    return {
      gateway,
      collected: sumByStatus(subset, "success"),
      failed: sumByStatus(subset, "failed"),
      pending: sumByStatus(subset, "pending"),
      refunded: sumByStatus(subset, "refunded"),
      sharePercent: 0,
    };
  });
  const collectedTotal = rows.reduce((s, r) => s + r.collected, 0);
  return rows
    .map((r) => ({
      ...r,
      sharePercent:
        collectedTotal === 0 ? 0 : (r.collected / collectedTotal) * 100,
    }))
    .filter(
      (r) =>
        r.collected > 0 || r.failed > 0 || r.pending > 0 || r.refunded > 0,
    );
}

export function buildTopStoreRevenue(
  transactions: Transaction[],
  clients: Client[],
  start: Date,
  end: Date,
  limit = 8,
): TopStoreRevenueRow[] {
  const inRange = filterTransactionsInRange(transactions, start, end);
  const byClient = new Map<
    string,
    { collected: number; failed: number; txnCount: number }
  >();

  for (const txn of inRange) {
    const cur = byClient.get(txn.clientId) ?? {
      collected: 0,
      failed: 0,
      txnCount: 0,
    };
    cur.txnCount += 1;
    if (txn.status === "success") cur.collected += txn.amount;
    if (txn.status === "failed") cur.failed += txn.amount;
    byClient.set(txn.clientId, cur);
  }

  const clientById = new Map(clients.map((c) => [c.id, c]));

  return Array.from(byClient.entries())
    .map(([clientId, stats]) => {
      const client = clientById.get(clientId);
      return {
        clientId,
        storeName: client?.storeName ?? clientId,
        ownerEmail: client?.ownerEmail ?? "—",
        plan: client?.plan ?? planNameEnum.STARTER,
        collected: stats.collected,
        failed: stats.failed,
        txnCount: stats.txnCount,
      };
    })
    .sort((a, b) => b.collected - a.collected || b.txnCount - a.txnCount)
    .slice(0, limit);
}

/**
 * Revenue = month plan bookings; MRR = platform MRR at each month's end
 * (same definition as the KPI card). Computed over the full history, then
 * sliced to the selected range, so a point never depends on the range.
 */
export function buildTrendWithMrr(
  allMonthly: MonthlyPlanRevenue[],
  subscriptions: Subscription[],
  rangeStart: Date,
  rangeEnd: Date,
): RevenueTrendPoint[] {
  const points = allMonthly.map((row) => {
    const { end } = utcMonthBounds(row.year, row.month);
    return {
      row,
      point: {
        month: row.label.replace(/ 20\d\d$/, ""),
        fullLabel: row.label,
        revenue: monthTotal(row),
        mrr: computeMrr(subscriptions, end),
      },
    };
  });

  return points
    .filter(({ row }) => monthOverlapsRange(row, rangeStart, rangeEnd))
    .map(({ point }) => point);
}
