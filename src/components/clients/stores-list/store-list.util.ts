/**
 * Stores list (04 S-02): how a row reads (status and payment badges in the S-00b words), the drawer filters and
 * the default "needs action first" order. Pure helpers over the loaded store list. The payment state itself is
 * still the server's (`paymentState`, PRD-005 FR-3.6); this file only words it as the short S-02 badge.
 */

import type { Tone } from "../../ui/tones";
import type { Client, PlatformSettings, Subscription } from "../../../types";
import { getStoreHealth } from "../../../lib/storeHealth";
import { healthBandOf, healthBandEnum, type HealthBandKey } from "../../../lib/store-table.util";
import { normaliseLifecycleKey, storeLifecycleKey, type StoreLifecycleKey } from "../../../lib/storeStatus";
import { daysUntil } from "../../../lib/utils";
import { getPlanLabel } from "../../../lib/display-labels.util";

// ─── Badges ───────────────────────────────────────────────────────────────

export interface RowBadge {
  label: string;
  tone: Tone;
  /** Second line under the badge (`small` muted). */
  detail?: string;
}

/** Store status in the S-00b words and tones (Trial neutral, Past due danger). */
const STATUS_BADGES: Record<StoreLifecycleKey, RowBadge> = {
  live: { label: "Live", tone: "success" },
  setup: { label: "Set up", tone: "neutral" },
  trial: { label: "Trial", tone: "neutral" },
  past_due: { label: "Past due", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  deleted: { label: "Deleted", tone: "neutral" },
};

export function storeStatusBadge(client: Client): RowBadge {
  return STATUS_BADGES[storeLifecycleKey(client)];
}

export const paymentKindEnum = {
  PAID: "paid",
  DUE: "due",
  GRACE: "grace",
  OVERDUE: "overdue",
  NONE: "none",
} as const;

export type PaymentKind = (typeof paymentKindEnum)[keyof typeof paymentKindEnum];

export interface PaymentBadge extends RowBadge {
  kind: PaymentKind;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Days past due: the server's count, else the number in its "Overdue · 5 days" label. */
function overdueDays(subscription: Subscription, label: string): number {
  if (subscription.daysOverdue && subscription.daysOverdue > 0) return subscription.daysOverdue;
  const match = /(\d+)/.exec(label);
  return match ? Number(match[1]) : 0;
}

/**
 * This month's payment as the short S-02 badge: Paid · Due 15 Nov · In grace · Overdue · No fee. The server's
 * badge decides the state; "Overdue · 5 days" inside the grace period reads "In grace" with "2 days left".
 */
export function paymentBadge(subscription: Subscription | undefined, graceDays: number): PaymentBadge {
  const none: PaymentBadge = { kind: paymentKindEnum.NONE, label: "No fee", tone: "neutral" };
  const state = subscription?.paymentState;
  if (!subscription || !state) return none;
  const label = state.label;

  if (state.tone === "success") {
    return subscription.mrr > 0 ? { kind: paymentKindEnum.PAID, label: "Paid", tone: "success" } : none;
  }
  if (state.tone === "warning" && label.startsWith("Due")) {
    return { kind: paymentKindEnum.DUE, label, tone: "warning" };
  }
  const isOverdueLabel = label.startsWith("Overdue");
  // Suspended or cancelled with money still owed reads Overdue; otherwise there is no fee this month.
  if (!isOverdueLabel && !(state.tone === "danger" && subscription.amountDue > 0)) return none;

  const days = overdueDays(subscription, label);
  const pastGrace = state.detail === "Past grace period" || days > graceDays || !isOverdueLabel;
  if (pastGrace) {
    return {
      kind: paymentKindEnum.OVERDUE,
      label: "Overdue",
      tone: "danger",
      detail: days > 0 ? `${plural(days, "day")} overdue` : undefined,
    };
  }
  const left = Math.max(0, graceDays - days);
  return { kind: paymentKindEnum.GRACE, label: "In grace", tone: "warning", detail: `${plural(left, "day")} left` };
}

/** Owes a payment now: Send reminder is offered. */
export function isPaymentOwed(kind: PaymentKind): boolean {
  return kind === paymentKindEnum.DUE || kind === paymentKindEnum.GRACE || kind === paymentKindEnum.OVERDUE;
}

/** The plan's short name ("Plus"), never the version. */
export function planShortName(client: Client): string {
  return client.planRef?.displayName || getPlanLabel(client.plan);
}

// ─── Health ───────────────────────────────────────────────────────────────

export const HEALTH_LABELS: Record<HealthBandKey, string> = {
  [healthBandEnum.HEALTHY]: "Healthy",
  [healthBandEnum.AT_RISK]: "At risk",
  [healthBandEnum.CRITICAL]: "Critical",
};

// ─── Filters ──────────────────────────────────────────────────────────────

export interface StoreListFilters {
  plans: string[];
  statuses: string[];
  health: HealthBandKey[];
  payment: PaymentKind[];
  /** Renews within this many days ("7" or "30"). */
  renews: string;
  /** Joined within the last N days. */
  joined: string;
}

export const NO_FILTERS: StoreListFilters = { plans: [], statuses: [], health: [], payment: [], renews: "", joined: "" };

export const PAYMENT_FILTER_OPTIONS: { value: PaymentKind; label: string }[] = [
  { value: paymentKindEnum.PAID, label: "Paid" },
  { value: paymentKindEnum.DUE, label: "Due this month" },
  { value: paymentKindEnum.GRACE, label: "In grace" },
  { value: paymentKindEnum.OVERDUE, label: "Overdue" },
];

export const RENEWS_OPTIONS = [
  { value: "7", label: "Within 7 days" },
  { value: "30", label: "Within 30 days" },
];

export const JOINED_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export function countFilters(filters: StoreListFilters): number {
  return (
    (filters.plans.length ? 1 : 0) +
    (filters.statuses.length ? 1 : 0) +
    (filters.health.length ? 1 : 0) +
    (filters.payment.length ? 1 : 0) +
    (filters.renews ? 1 : 0) +
    (filters.joined ? 1 : 0)
  );
}

export function matchesListFilters(
  filters: StoreListFilters,
  client: Client,
  subscription: Subscription | undefined,
  payment: PaymentKind,
  now: Date,
): boolean {
  if (filters.plans.length && !filters.plans.some((value) => value === client.planRef?.id || value === client.plan)) {
    return false;
  }
  if (filters.statuses.length) {
    const key = storeLifecycleKey(client);
    if (!filters.statuses.some((value) => normaliseLifecycleKey(value) === key)) return false;
  }
  if (filters.health.length && !filters.health.includes(healthBandOf(client))) return false;
  if (filters.payment.length && !filters.payment.includes(payment)) return false;
  if (filters.renews) {
    if (!subscription?.renewalDate) return false;
    const days = daysUntil(subscription.renewalDate, now);
    if (days < 0 || days > Number(filters.renews)) return false;
  }
  if (filters.joined) {
    const age = -daysUntil(client.joinedDate, now);
    if (age > Number(filters.joined)) return false;
  }
  return true;
}

export function matchesSearch(client: Client, query: string): boolean {
  if (!query) return true;
  return [client.storeName, client.slug ?? "", client.ownerName, client.ownerEmail].some((text) =>
    text.toLowerCase().includes(query),
  );
}

// ─── Order ────────────────────────────────────────────────────────────────

/** Needs action first: overdue (and in grace), then due, then at risk or critical health; the rest after. */
export function actionRank(client: Client, payment: PaymentKind): number {
  if (payment === paymentKindEnum.OVERDUE || payment === paymentKindEnum.GRACE) return 0;
  if (payment === paymentKindEnum.DUE) return 1;
  if (healthBandOf(client) !== healthBandEnum.HEALTHY) return 2;
  return 3;
}

/** Default order (S-02): needs action first, then Sales · 30d high to low. */
export interface SortableRow {
  client: Client;
  payment: { kind: PaymentKind };
  subscription?: Subscription;
}

export function compareNeedsAction(a: SortableRow, b: SortableRow): number {
  const rank = actionRank(a.client, a.payment.kind) - actionRank(b.client, b.payment.kind);
  if (rank !== 0) return rank;
  return b.client.revenue - a.client.revenue;
}

const PAYMENT_ORDER: Record<PaymentKind, number> = { overdue: 0, grace: 1, due: 2, paid: 3, none: 4 };

export function compareByColumn(a: SortableRow, b: SortableRow, column: string): number {
  switch (column) {
    case "payment":
      return (
        PAYMENT_ORDER[a.payment.kind] - PAYMENT_ORDER[b.payment.kind] ||
        (a.subscription?.renewalDate ?? "").localeCompare(b.subscription?.renewalDate ?? "")
      );
    case "renewalDate":
      return (a.subscription?.renewalDate ?? "9999").localeCompare(b.subscription?.renewalDate ?? "9999");
    case "health":
      return getStoreHealth(a.client).score - getStoreHealth(b.client).score;
    case "sales":
      return a.client.revenue - b.client.revenue;
    case "fee":
      return a.client.mrr - b.client.mrr;
    case "status":
      return storeStatusBadge(a.client).label.localeCompare(storeStatusBadge(b.client).label);
    case "plan":
      return planShortName(a.client).localeCompare(planShortName(b.client));
    default:
      return a.client.storeName.localeCompare(b.client.storeName, undefined, { numeric: true, sensitivity: "base" });
  }
}

// ─── Reminders ────────────────────────────────────────────────────────────

/**
 * Which reminder matches today: the latest one whose time has passed (Reminder 1 before any has), from the
 * reminder schedule in Settings › Payments & billing rules.
 */
export function reminderForToday(reminders: PlatformSettings["reminders"], daysUntilDue: number): string | null {
  const schedule = [
    ...[...reminders.daysBeforeDue].sort((a, b) => b - a).map((days) => -days),
    ...[...reminders.daysAfterDue].sort((a, b) => a - b),
  ];
  if (!schedule.length) return null;
  const daysSinceDue = -daysUntilDue;
  let index = 0;
  schedule.forEach((offset, i) => {
    if (offset <= daysSinceDue) index = i;
  });
  const offset = schedule[index];
  const timing =
    offset === 0
      ? "on the due date"
      : offset < 0
        ? `${plural(-offset, "day")} before due`
        : `${plural(offset, "day")} after due`;
  return `Reminder ${index + 1} · ${timing}`;
}
