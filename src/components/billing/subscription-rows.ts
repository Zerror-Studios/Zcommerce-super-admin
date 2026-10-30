/**
 * Subscriptions (04 S-04): one row per store with a subscription, the status tabs, the drawer filters and the
 * menu's orange count. The payment badge is the Stores list's (`paymentBadge`, S-00b words), so both pages agree.
 */

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Client, Subscription } from "../../types";
import type { ShopReportRow } from "../../types/reports";
import { graceDaysFor } from "../../lib/storeStatus";
import { paymentBadge, type PaymentBadge, type PaymentKind } from "../clients/stores-list/store-list.util";

export const subscriptionTabEnum = {
  ACTIVE: "active",
  DUE: "due",
  TRIAL: "trial",
  CANCELLED: "cancelled",
} as const;

export type SubscriptionTab = (typeof subscriptionTabEnum)[keyof typeof subscriptionTabEnum];

export const SUBSCRIPTION_TABS: { value: SubscriptionTab; label: string }[] = [
  { value: subscriptionTabEnum.ACTIVE, label: "Active" },
  { value: subscriptionTabEnum.DUE, label: "Due & overdue" },
  { value: subscriptionTabEnum.TRIAL, label: "Trial" },
  { value: subscriptionTabEnum.CANCELLED, label: "Cancelled" },
];

export function isSubscriptionTab(value: string | null | undefined): value is SubscriptionTab {
  return SUBSCRIPTION_TABS.some((tab) => tab.value === value);
}

export interface SubscriptionRow {
  id: string;
  report: ShopReportRow;
  client?: Client;
  subscription?: Subscription;
  payment: PaymentBadge;
  /** What the store owes now (the open invoices, else its fee when a payment is owed). */
  owed: number;
}

/** Owes money now: due, in grace or overdue. */
export function isOwed(kind: PaymentKind): boolean {
  return kind === "due" || kind === "grace" || kind === "overdue";
}

const ACTIVE_STATUSES = new Set(["ACTIVE", "PAST_DUE", "SUSPENDED"]);

/** The tab a row belongs to (rows without a subscription belong to none). */
export function rowTab(row: Pick<SubscriptionRow, "report">): Exclude<SubscriptionTab, "due"> | null {
  const status = row.report.subscriptionStatus;
  if (status === "TRIAL") return subscriptionTabEnum.TRIAL;
  if (status === "CANCELLED") return subscriptionTabEnum.CANCELLED;
  if (ACTIVE_STATUSES.has(status)) return subscriptionTabEnum.ACTIVE;
  return null;
}

export function matchesTab(row: SubscriptionRow, tab: SubscriptionTab): boolean {
  const base = rowTab(row);
  if (tab === subscriptionTabEnum.DUE) return base === subscriptionTabEnum.ACTIVE && isOwed(row.payment.kind);
  return base === tab;
}

/** Joins the server rows with the loaded stores; deleted stores and stores without a subscription are left out. */
export function buildSubscriptionRows(
  reports: readonly ShopReportRow[],
  clients: ReadonlyMap<string, Client>,
  subscriptions: ReadonlyMap<string, Subscription>,
  platformGraceDays: number,
): SubscriptionRow[] {
  const rows: SubscriptionRow[] = [];
  for (const report of reports) {
    if (report.subscriptionStatus === "none") continue;
    const client = clients.get(report.clientId);
    if (client?.tenantStatus === "DELETED") continue;
    const subscription = subscriptions.get(report.clientId);
    const grace = client ? graceDaysFor(client, platformGraceDays) : platformGraceDays;
    const payment = paymentBadge(subscription, grace);
    const owed = isOwed(payment.kind) ? report.amountDue || subscription?.amountDue || report.mrr : 0;
    rows.push({ id: report.clientId, report, client, subscription, payment, owed });
  }
  return rows;
}

// ─── Cells ────────────────────────────────────────────────────────────────

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "15 Nov"; "15 Nov 2027" outside this year. */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, date.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy");
}

/** The Payment cell's second line: "₹2,999 due", "₹2,999 · 2 days left", "₹2,999 · 5 days overdue". */
export function paymentDetail(row: SubscriptionRow, money: (amount: number) => string): string | null {
  const { kind, detail } = row.payment;
  if (!isOwed(kind)) return null;
  const amount = money(row.owed);
  if (kind === "due") return `${amount} due`;
  if (kind === "overdue" && row.report.daysOverdue > 0) return `${amount} · ${plural(row.report.daysOverdue, "day")} overdue`;
  return detail ? `${amount} · ${detail}` : `${amount} due`;
}

// ─── Order ────────────────────────────────────────────────────────────────

const OWED_ORDER: Record<PaymentKind, number> = { overdue: 0, grace: 1, due: 2, paid: 3, none: 3 };

/** Overdue first, then next due soonest (S-04 default sort). */
export function compareSubscriptionRows(a: SubscriptionRow, b: SubscriptionRow): number {
  const rank = OWED_ORDER[a.payment.kind] - OWED_ORDER[b.payment.kind];
  if (rank !== 0) return rank;
  const due = (row: SubscriptionRow) => (row.report.nextDueDate ? Date.parse(row.report.nextDueDate) : Number.POSITIVE_INFINITY);
  return due(a) - due(b) || a.report.storeName.localeCompare(b.report.storeName);
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface SubscriptionFilters {
  payment: PaymentKind[];
  renews: string;
  plans: string[];
  cycle: string[];
  health: string[];
  issue: string;
}

export const PAYMENT_OPTIONS: { value: PaymentKind; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "due", label: "Due this period" },
  { value: "grace", label: "In grace" },
  { value: "overdue", label: "Overdue" },
];

export const RENEWS_OPTIONS = [
  { value: "7", label: "Within 7 days" },
  { value: "30", label: "Within 30 days" },
];

export const CYCLE_OPTIONS = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export const HEALTH_OPTIONS = [
  { value: "healthy", label: "Healthy" },
  { value: "at_risk", label: "At risk" },
  { value: "unhealthy", label: "Critical" },
];

export const ISSUE_OPTIONS = [
  { value: "flagged", label: "Flagged payment" },
  { value: "stuck", label: "Stuck in a suspended store" },
];

export function matchesFilters(
  row: SubscriptionRow,
  filters: SubscriptionFilters,
  issueStores: ReadonlySet<string> | null,
  now: Date = new Date(),
): boolean {
  if (filters.payment.length && !filters.payment.includes(row.payment.kind)) return false;
  if (filters.renews) {
    if (!row.report.nextDueDate || row.report.subscriptionStatus === "CANCELLED") return false;
    const until = differenceInCalendarDays(parseISO(row.report.nextDueDate), now);
    if (until < 0 || until > Number(filters.renews)) return false;
  }
  if (filters.plans.length && !filters.plans.includes(row.report.plan)) return false;
  if (filters.cycle.length && !filters.cycle.includes(row.subscription?.billingCycle ?? "MONTHLY")) return false;
  if (filters.health.length && !filters.health.includes(row.report.health)) return false;
  if (filters.issue && issueStores && !issueStores.has(row.id)) return false;
  return true;
}

// ─── Menu count ───────────────────────────────────────────────────────────

/**
 * The orange count on the Subscriptions menu item (04 S-00): stores whose payment is overdue (or in grace), or due
 * within 7 days. Read from the loaded store list, so it needs no extra request.
 */
export function subscriptionsNeedingAction(
  clients: readonly Client[],
  subscriptions: ReadonlyMap<string, Subscription>,
  platformGraceDays: number,
  now: Date = new Date(),
): number {
  let count = 0;
  for (const client of clients) {
    if (client.tenantStatus === "DELETED") continue;
    const subscription = subscriptions.get(client.id);
    if (!subscription) continue;
    const { kind } = paymentBadge(subscription, graceDaysFor(client, platformGraceDays));
    if (kind === "overdue" || kind === "grace") count += 1;
    else if (kind === "due" && differenceInCalendarDays(parseISO(subscription.renewalDate), now) <= 7) count += 1;
  }
  return count;
}
