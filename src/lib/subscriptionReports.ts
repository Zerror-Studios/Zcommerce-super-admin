import {
  planNameEnum,
  subscriptionStatusEnum,
  type Client,
  type PlanName,
  type PlatformSettings,
  type Subscription,
  type SubscriptionHealthBucket,
  type Transaction,
} from "../types";
import {
  evaluateSubscriptionHealth,
  type SubscriptionHealthResult,
} from "./subscriptionHealth";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";
import { latestSubscriptionByClient } from "./subscription-lookup.util";
import {
  MS_PER_DAY,
  calendarDayEndUtc,
  calendarDayStartUtc,
  calendarMonthBoundsUtc,
  calendarMonthOf,
  daysBetween,
  daysUntil,
  utcDayStart,
  utcMonthBounds,
} from "./utils";

export type ReportDrillFilter =
  | "all"
  | "healthy"
  | "at_risk"
  | "unhealthy"
  | "paid_month"
  | "pending"
  | "overdue"
  | "overdue_grace"
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
  /** Inclusive range start, a UI picker value (local fields); preferred over `month`. */
  rangeStart?: Date;
  /** Inclusive range end, a UI picker value (local fields); preferred over `month`. */
  rangeEnd?: Date;
  /** @deprecated Prefer rangeStart/rangeEnd. Calendar month under review (local fields, day 1). */
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
  isOverdueInGrace: boolean;
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
  /** At-risk shops whose renewal passed unpaid but are still in grace. */
  overdueInGraceCount: number;
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

/**
 * UTC bounds of the period under review (PRD-002 SA-5): an explicit range
 * when the UI passes one, else the calendar month (`month`, or `asOf`'s).
 */
function resolveRange(
  input: Pick<ReportQueryInput, "rangeStart" | "rangeEnd" | "month" | "asOf">,
): { start: Date; end: Date } {
  if (input.rangeStart && input.rangeEnd) {
    return {
      start: calendarDayStartUtc(input.rangeStart),
      end: calendarDayEndUtc(input.rangeEnd),
    };
  }
  const asOf = input.asOf ?? new Date();
  return calendarMonthBoundsUtc(input.month ?? calendarMonthOf(asOf));
}

/**
 * The period before `start`..`end`: the previous calendar month for a whole
 * month, else the same number of whole UTC days ending the day before `start`.
 */
function previousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const isWholeMonth =
    start.getUTCDate() === 1 &&
    utcMonthBounds(year, month).end.getTime() === end.getTime();
  if (isWholeMonth) return utcMonthBounds(year, month - 1);

  const lengthDays = daysBetween(start, end) + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(
    utcDayStart(prevEnd).getTime() - (lengthDays - 1) * MS_PER_DAY,
  );
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

  const byClient = latestSubscriptionByClient(subscriptions);
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
        isOverdueInGrace: healthResult.isOverdueInGrace,
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
  const subByClient = latestSubscriptionByClient(subscriptions);
  const q = search.trim().toLowerCase();

  const fromTxns: PaymentReportRow[] = transactions.map((txn) => {
    const client = clientById.get(txn.clientId);
    const sub = subByClient.get(txn.clientId);
    return {
      id: txn.id,
      clientId: txn.clientId,
      shopName: txn.clientName,
      ownerEmail: client?.ownerEmail ?? "—",
      plan: sub?.plan ?? client?.plan ?? planNameEnum.STARTER,
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
  const pendingSubRows: PaymentReportRow[] = Array.from(subByClient.values())
    .filter(
      (s) =>
        s.amountDue > 0 &&
        s.status !== subscriptionStatusEnum.CANCELLED,
    )
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
        status: (s.status === subscriptionStatusEnum.PAST_DUE ||
        daysUntil(s.renewalDate, asOf) < 0
          ? "overdue"
          : "pending") as PaymentReportRow["status"],
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

/**
 * PRD-002 SA-3: a period is judged from its own rows — payments due in it,
 * as they stood at its end (or at `asOf` for a running period) — never from
 * today's subscription state.
 */
function periodSnapshot(
  input: ReportQueryInput,
  payments: PaymentReportRow[],
  start: Date,
  end: Date,
  asOf: Date,
): MonthSnapshot {
  const cutoff = new Date(Math.min(end.getTime(), asOf.getTime()));
  const { subscriptions, transactions } = input;
  const subByClient = latestSubscriptionByClient(subscriptions);

  // 1. Cash collected inside the month
  const success = transactions.filter(
    (t) => t.status === "success" && inRange(t.date, start, cutoff),
  );
  const collectedAmount = success.reduce((sum, t) => sum + t.amount, 0);

  // 2. What fell due in the month, and what was still unpaid at its cutoff
  const dueRows = payments.filter(
    (p) =>
      inRange(p.dueDate, start, end) &&
      (p.status === "paid" || p.status === "pending" || p.status === "overdue"),
  );
  const outstanding = dueRows.filter(
    (p) => !p.paidDate || new Date(p.paidDate).getTime() > cutoff.getTime(),
  );
  const pendingAmount = outstanding.reduce((sum, p) => sum + p.amount, 0);

  const expectedAmount =
    dueRows.reduce((sum, p) => sum + p.amount, 0) ||
    collectedAmount + pendingAmount;

  const newSubscriptions = subscriptions.filter((s) =>
    inRange(s.startedAt, start, cutoff),
  ).length;

  const renewals = success.filter((t) => {
    const sub = subByClient.get(t.clientId);
    return sub?.startedAt ? !inRange(sub.startedAt, start, end) : true;
  }).length;

  const cancellations = subscriptions.filter((s) =>
    inRange(
      s.canceledAt ??
        (s.status === subscriptionStatusEnum.CANCELLED ? s.renewalDate : null),
      start,
      cutoff,
    ),
  ).length;

  return {
    collectedCount: success.length,
    collectedAmount,
    pendingCount: outstanding.length,
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

  const expectedRevenue = Array.from(
    latestSubscriptionByClient(input.subscriptions).values(),
  )
    .filter((s) => s.status !== subscriptionStatusEnum.CANCELLED && s.mrr > 0)
    .reduce((sum, s) => sum + s.mrr, 0);
  const collectedRevenue = paidMonthPayments.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalShops: shops.length,
    healthyCount: shops.filter((s) => s.health === "healthy").length,
    atRiskCount: shops.filter((s) => s.health === "at_risk").length,
    unhealthyCount: shops.filter((s) => s.health === "unhealthy").length,
    overdueInGraceCount: shops.filter((s) => s.isOverdueInGrace).length,
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
        s.canceledAt ??
          (s.status === subscriptionStatusEnum.CANCELLED
            ? s.renewalDate
            : null),
        start,
        end,
      ),
    ).length,
    currentMonth: periodSnapshot(input, payments, start, end, asOf),
    previousMonth: periodSnapshot(input, payments, prev.start, prev.end, asOf),
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
      return shops.filter(
        (s) =>
          s.amountDue > 0 &&
          s.daysOverdue === 0 &&
          s.subscriptionStatus === subscriptionStatusEnum.ACTIVE,
      );
    case "overdue":
      return shops.filter(
        (s) =>
          s.subscriptionStatus === subscriptionStatusEnum.PAST_DUE ||
          s.daysOverdue > 0,
      );
    case "overdue_grace":
      return shops.filter((s) => s.isOverdueInGrace);
    case "renewals_7":
      return shops.filter(
        (s) =>
          s.nextDueDate &&
          daysUntil(s.nextDueDate, asOf) >= 0 &&
          daysUntil(s.nextDueDate, asOf) <= 7 &&
          s.subscriptionStatus !== subscriptionStatusEnum.CANCELLED,
      );
    case "renewals_30":
      return shops.filter(
        (s) =>
          s.nextDueDate &&
          daysUntil(s.nextDueDate, asOf) >= 0 &&
          daysUntil(s.nextDueDate, asOf) <= 30 &&
          s.subscriptionStatus !== subscriptionStatusEnum.CANCELLED,
      );
    case "churned_month":
      return shops.filter(
        (s) => s.subscriptionStatus === subscriptionStatusEnum.CANCELLED,
      );
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
  const { start, end } = resolveRange({ rangeStart, rangeEnd, asOf });

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

// ─── CSV export (PRD-002 SA-6) ────────────────────────────────────────────

/** Cells starting with these are read as formulas by spreadsheet apps. */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Delay before revoking a download URL, so the browser can start it. */
export const CSV_REVOKE_DELAY_MS = 1000;

/** Neutralise formula injection, then quote per RFC 4180 when needed. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let cell = String(value);
  if (CSV_FORMULA_PREFIX.test(cell)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;

  return cell;
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","))
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
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), CSV_REVOKE_DELAY_MS);
}
