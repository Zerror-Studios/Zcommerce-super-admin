import {
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  subDays,
} from "date-fns";
import type {
  Client,
  PlanName,
  PlatformSettings,
  Subscription,
  SubscriptionHealthBucket,
  Transaction,
} from "../types";
import {
  evaluateSubscriptionHealth,
  type SubscriptionHealthResult,
} from "./subscriptionHealth";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";
import { daysUntil } from "./utils";

export type ReportDrillFilter =
  | "all"
  | "healthy"
  | "at_risk"
  | "unhealthy"
  | "paid_month"
  | "pending"
  | "overdue"
  | "renewals_7"
  | "renewals_30"
  | "churned_month"
  | "new_month"
  | "expected";

export interface ReportQueryInput {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  asOf?: Date;
  /** Inclusive range start (preferred over `month`). */
  rangeStart?: Date;
  /** Inclusive range end (preferred over `month`). */
  rangeEnd?: Date;
  /** @deprecated Prefer rangeStart/rangeEnd. First day of month under review. */
  month?: Date;
  settings?: PlatformSettings;
  drill?: ReportDrillFilter;
  search?: string;
  plan?: PlanName | "all";
  health?: SubscriptionHealthBucket | "all";
  paymentStatus?: "all" | "paid" | "pending" | "overdue" | "failed" | "refunded";
}

export interface ShopReportRow {
  clientId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  plan: PlanName;
  clientStatus: Client["status"];
  subscriptionStatus: Subscription["status"] | "none";
  health: SubscriptionHealthBucket;
  healthReason: string;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  amountDue: number;
  daysOverdue: number;
  mrr: number;
}

export interface PaymentReportRow {
  id: string;
  clientId: string;
  shopName: string;
  ownerEmail: string;
  plan: PlanName;
  amount: number;
  currency: string;
  dueDate: string | null;
  paidDate: string | null;
  status: "paid" | "pending" | "overdue" | "failed" | "refunded";
  paymentMethod: string;
  transactionId: string;
}

export interface MonthSnapshot {
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  expectedAmount: number;
  collectedPercent: number;
  newSubscriptions: number;
  renewals: number;
  cancellations: number;
}

export interface SubscriptionReportOverview {
  totalShops: number;
  healthyCount: number;
  atRiskCount: number;
  unhealthyCount: number;
  paidThisMonth: { count: number; amount: number };
  pendingPayments: { count: number; amount: number };
  overduePayments: { count: number; amount: number };
  expectedRevenue: number;
  collectedRevenue: number;
  collectedPercent: number;
  renewals7: number;
  renewals30: number;
  churnedThisMonth: number;
  currentMonth: MonthSnapshot;
  previousMonth: MonthSnapshot;
}

function monthBounds(month: Date): { start: Date; end: Date } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function resolveRange(
  input: Pick<ReportQueryInput, "rangeStart" | "rangeEnd" | "month" | "asOf">,
): { start: Date; end: Date } {
  if (input.rangeStart && input.rangeEnd) {
    return {
      start: startOfDay(input.rangeStart),
      end: endOfDay(input.rangeEnd),
    };
  }
  const asOf = input.asOf ?? new Date();
  const month = input.month ?? new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  return monthBounds(month);
}

function previousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const length = differenceInCalendarDays(end, start) + 1;
  const prevEnd = endOfDay(subDays(start, 1));
  const prevStart = startOfDay(subDays(prevEnd, length - 1));
  return { start: prevStart, end: prevEnd };
}

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function lastSuccessfulPayment(
  clientId: string,
  transactions: Transaction[],
): string | null {
  const paid = transactions
    .filter((t) => t.clientId === clientId && t.status === "success")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return paid[0]?.date ?? null;
}

function mapTxnStatus(
  txn: Transaction,
  asOf: Date,
): PaymentReportRow["status"] {
  if (txn.status === "success") return "paid";
  if (txn.status === "failed") return "failed";
  if (txn.status === "refunded") return "refunded";
  if (txn.status === "pending") {
    if (txn.dueDate && daysUntil(txn.dueDate, asOf) < 0) return "overdue";
    return "pending";
  }
  return "pending";
}

export function buildShopReportRows(
  input: Omit<ReportQueryInput, "drill" | "paymentStatus">,
): ShopReportRow[] {
  const {
    clients,
    subscriptions,
    transactions,
    asOf = new Date(),
    settings = DEFAULT_PLATFORM_SETTINGS,
    search = "",
    plan = "all",
    health = "all",
  } = input;

  const byClient = new Map(subscriptions.map((s) => [s.clientId, s]));
  const q = search.trim().toLowerCase();

  return clients
    .map((client) => {
      const sub = byClient.get(client.id);
      const healthResult: SubscriptionHealthResult = evaluateSubscriptionHealth({
        client,
        subscription: sub,
        asOf,
        settings,
      });

      return {
        clientId: client.id,
        storeName: client.storeName,
        ownerName: client.ownerName,
        ownerEmail: client.ownerEmail,
        plan: client.plan,
        clientStatus: client.status,
        subscriptionStatus: sub?.status ?? "none",
        health: healthResult.bucket,
        healthReason: healthResult.reason,
        lastPaymentDate: lastSuccessfulPayment(client.id, transactions),
        nextDueDate: sub?.renewalDate ?? null,
        amountDue: sub?.amountDue ?? 0,
        daysOverdue: healthResult.daysOverdue,
        mrr: sub?.mrr ?? client.mrr,
      } satisfies ShopReportRow;
    })
    .filter((row) => {
      if (plan !== "all" && row.plan !== plan) return false;
      if (health !== "all" && row.health !== health) return false;
      if (!q) return true;
      return (
        row.storeName.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q) ||
        row.ownerEmail.toLowerCase().includes(q)
      );
    });
}

export function buildPaymentReportRows(
  input: ReportQueryInput,
): PaymentReportRow[] {
  const {
    clients,
    subscriptions,
    transactions,
    asOf = new Date(),
    search = "",
    plan = "all",
    paymentStatus = "all",
  } = input;

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const subByClient = new Map(subscriptions.map((s) => [s.clientId, s]));
  const q = search.trim().toLowerCase();

  const fromTxns: PaymentReportRow[] = transactions.map((txn) => {
    const client = clientById.get(txn.clientId);
    const sub = subByClient.get(txn.clientId);
    return {
      id: txn.id,
      clientId: txn.clientId,
      shopName: txn.clientName,
      ownerEmail: client?.ownerEmail ?? "—",
      plan: sub?.plan ?? client?.plan ?? "Free",
      amount: txn.amount,
      currency: txn.currency,
      dueDate: txn.dueDate ?? null,
      paidDate: txn.status === "success" ? txn.date : null,
      status: mapTxnStatus(txn, asOf),
      paymentMethod: txn.gateway,
      transactionId: txn.transactionId,
    };
  });

  // Synthetic pending/overdue rows from subscriptions without a matching pending txn
  const pendingSubRows: PaymentReportRow[] = subscriptions
    .filter((s) => s.amountDue > 0 && (s.status === "pending" || s.status === "past_due"))
    .filter((s) => !transactions.some((t) => t.clientId === s.clientId && t.status === "pending"))
    .map((s) => {
      const client = clientById.get(s.clientId);
      return {
        id: `syn-${s.id}`,
        clientId: s.clientId,
        shopName: s.clientName,
        ownerEmail: client?.ownerEmail ?? "—",
        plan: s.plan,
        amount: s.amountDue,
        currency: "INR",
        dueDate: s.renewalDate,
        paidDate: null,
        status: (s.status === "past_due" ? "overdue" : "pending") as PaymentReportRow["status"],
        paymentMethod: "—",
        transactionId: "—",
      };
    });

  return [...fromTxns, ...pendingSubRows].filter((row) => {
    if (plan !== "all" && row.plan !== plan) return false;
    if (paymentStatus !== "all" && row.status !== paymentStatus) return false;
    if (!q) return true;
    return row.shopName.toLowerCase().includes(q);
  });
}

function periodSnapshot(
  input: ReportQueryInput,
  start: Date,
  end: Date,
): MonthSnapshot {
  const { subscriptions, transactions } = input;

  const success = transactions.filter(
    (t) => t.status === "success" && inRange(t.date, start, end),
  );
  const collectedAmount = success.reduce((sum, t) => sum + t.amount, 0);

  const pendingSubs = subscriptions.filter(
    (s) => s.status === "pending" && s.amountDue > 0,
  );
  const overdueSubs = subscriptions.filter(
    (s) => s.status === "past_due" && s.amountDue > 0,
  );

  const pendingAmount =
    pendingSubs.reduce((s, x) => s + x.amountDue, 0) +
    overdueSubs.reduce((s, x) => s + x.amountDue, 0);

  const expectedAmount =
    subscriptions
      .filter((s) => s.status !== "canceled" && s.mrr > 0)
      .reduce((sum, s) => sum + s.mrr, 0) || collectedAmount + pendingAmount;

  const newSubscriptions = subscriptions.filter((s) =>
    inRange(s.startedAt, start, end),
  ).length;

  const renewals = success.filter((t) => {
    const sub = subscriptions.find((s) => s.clientId === t.clientId);
    return sub?.startedAt ? !inRange(sub.startedAt, start, end) : true;
  }).length;

  const cancellations = subscriptions.filter((s) =>
    inRange(s.canceledAt ?? (s.status === "canceled" ? s.renewalDate : null), start, end),
  ).length;

  const pendingCount = pendingSubs.length + overdueSubs.length;

  return {
    collectedCount: success.length,
    collectedAmount,
    pendingCount,
    pendingAmount,
    expectedAmount,
    collectedPercent:
      expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 1000) / 10 : 0,
    newSubscriptions,
    renewals,
    cancellations,
  };
}

export function buildSubscriptionReportOverview(
  input: ReportQueryInput,
): SubscriptionReportOverview {
  const asOf = input.asOf ?? new Date();
  const shops = buildShopReportRows({ ...input, asOf });
  const payments = buildPaymentReportRows({ ...input, asOf });
  const { start, end } = resolveRange({ ...input, asOf });
  const prev = previousPeriod(start, end);

  const paidMonthPayments = applyDrillToPayments(payments, "paid_month", start, end, asOf);
  const pendingPayments = applyDrillToPayments(payments, "pending", start, end, asOf);
  const overduePayments = applyDrillToPayments(payments, "overdue", start, end, asOf);

  const expectedRevenue = input.subscriptions
    .filter((s) => s.status !== "canceled" && s.mrr > 0)
    .reduce((sum, s) => sum + s.mrr, 0);
  const collectedRevenue = paidMonthPayments.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalShops: shops.length,
    healthyCount: shops.filter((s) => s.health === "healthy").length,
    atRiskCount: shops.filter((s) => s.health === "at_risk").length,
    unhealthyCount: shops.filter((s) => s.health === "unhealthy").length,
    paidThisMonth: {
      count: paidMonthPayments.length,
      amount: collectedRevenue,
    },
    pendingPayments: {
      count: pendingPayments.length,
      amount: pendingPayments.reduce((s, x) => s + x.amount, 0),
    },
    overduePayments: {
      count: overduePayments.length,
      amount: overduePayments.reduce((s, x) => s + x.amount, 0),
    },
    expectedRevenue,
    collectedRevenue,
    collectedPercent:
      expectedRevenue > 0
        ? Math.round((collectedRevenue / expectedRevenue) * 1000) / 10
        : 0,
    renewals7: applyDrillToShops(shops, "renewals_7", asOf).length,
    renewals30: applyDrillToShops(shops, "renewals_30", asOf).length,
    churnedThisMonth: input.subscriptions.filter((s) =>
      inRange(
        s.canceledAt ?? (s.status === "canceled" ? s.renewalDate : null),
        start,
        end,
      ),
    ).length,
    currentMonth: periodSnapshot(input, start, end),
    previousMonth: periodSnapshot(input, prev.start, prev.end),
  };
}

/** Apply a drill filter so card counts match table row counts. */
export function applyDrillToShops(
  shops: ShopReportRow[],
  drill: ReportDrillFilter,
  asOf: Date = new Date(),
  _rangeStart?: Date,
): ShopReportRow[] {
  switch (drill) {
    case "healthy":
      return shops.filter((s) => s.health === "healthy");
    case "at_risk":
      return shops.filter((s) => s.health === "at_risk");
    case "unhealthy":
      return shops.filter((s) => s.health === "unhealthy");
    case "pending":
      return shops.filter((s) => s.subscriptionStatus === "pending");
    case "overdue":
      return shops.filter((s) => s.subscriptionStatus === "past_due" || s.daysOverdue > 0);
    case "renewals_7":
      return shops.filter(
        (s) =>
          s.nextDueDate &&
          daysUntil(s.nextDueDate, asOf) >= 0 &&
          daysUntil(s.nextDueDate, asOf) <= 7 &&
          s.subscriptionStatus !== "canceled",
      );
    case "renewals_30":
      return shops.filter(
        (s) =>
          s.nextDueDate &&
          daysUntil(s.nextDueDate, asOf) >= 0 &&
          daysUntil(s.nextDueDate, asOf) <= 30 &&
          s.subscriptionStatus !== "canceled",
      );
    case "churned_month":
      return shops.filter((s) => s.subscriptionStatus === "canceled");
    case "paid_month":
    case "expected":
    case "new_month":
      return shops;
    default:
      return shops;
  }
}

export function applyDrillToPayments(
  payments: PaymentReportRow[],
  drill: ReportDrillFilter,
  rangeStart?: Date,
  rangeEnd?: Date,
  asOf: Date = new Date(),
): PaymentReportRow[] {
  const { start, end } = resolveRange({
    rangeStart,
    rangeEnd,
    asOf,
  });

  switch (drill) {
    case "paid_month":
      return payments.filter(
        (p) => p.status === "paid" && p.paidDate && inRange(p.paidDate, start, end),
      );
    case "pending":
      return payments.filter((p) => p.status === "pending");
    case "overdue":
      return payments.filter((p) => p.status === "overdue");
    default:
      return payments;
  }
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
