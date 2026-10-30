/**
 * One status per store (docs/design/04-super-admin.md §2 "Store lifecycle"): the lifecycle badge and the
 * payment badge are shown as two separate columns. Never "Active" next to "Expired".
 * The payment badge is computed by the server (PRD-005 FR-3.6, one rule everywhere); this file only
 * maps it onto the kit's tones.
 */
import type { Tone } from "../components/ui/tones";
import type { Client, Subscription } from "../types";
import { daysUntil } from "./utils";

export interface StatusBadge {
  label: string;
  tone: Tone;
  /** Second line under the badge ("Suspends on 20 Oct"). */
  detail?: string;
}

// ─── Store lifecycle (PRD-024 FR-1.9, decision D4) ──────────────────────

/** The lifecycle states a store can show, in tab and filter order. */
export const storeLifecycleEnum = {
  LIVE: "live",
  SET_UP: "setup",
  TRIAL: "trial",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
  DELETED: "deleted",
} as const;

export type StoreLifecycleKey = (typeof storeLifecycleEnum)[keyof typeof storeLifecycleEnum];

/** Every state but Deleted (deleted stores are listed apart, PRD-018). */
export const STORE_LIFECYCLE_FILTERS: StoreLifecycleKey[] = [
  storeLifecycleEnum.LIVE,
  storeLifecycleEnum.SET_UP,
  storeLifecycleEnum.TRIAL,
  storeLifecycleEnum.PAST_DUE,
  storeLifecycleEnum.CANCELLED,
  storeLifecycleEnum.SUSPENDED,
];

const LIFECYCLE_BADGES: Record<StoreLifecycleKey, StatusBadge> = {
  live: { label: "Live", tone: "success" },
  setup: { label: "Set up", tone: "neutral" },
  trial: { label: "Trial", tone: "neutral" },
  past_due: { label: "Past due", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
  deleted: { label: "Deleted", tone: "neutral" },
};

/** Older links used `status=active` for Live. */
const LEGACY_LIFECYCLE_KEYS: Record<string, StoreLifecycleKey> = { active: storeLifecycleEnum.LIVE };

export function isStoreLifecycleKey(value: string): value is StoreLifecycleKey {
  return (Object.values(storeLifecycleEnum) as string[]).includes(value);
}

/** A status filter value from the URL, with the legacy `active` read as Live. */
export function normaliseLifecycleKey(value: string): StoreLifecycleKey | undefined {
  if (isStoreLifecycleKey(value)) return value;
  return LEGACY_LIFECYCLE_KEYS[value];
}

/**
 * D4: "Live" means the store went live (`liveAt`, PRD-018 FR-4.3). Deleted
 * and suspended stores show that first; a store that never went live shows
 * its subscription's state from the server (Trial, Past due, Cancelled,
 * Suspended), and otherwise "Set up".
 */
export function storeLifecycleKey(client: Client): StoreLifecycleKey {
  if (client.tenantStatus === "DELETED") return storeLifecycleEnum.DELETED;
  if (client.tenantStatus === "SUSPENDED" || client.status === "suspended") {
    return storeLifecycleEnum.SUSPENDED;
  }
  if (client.liveAt) return storeLifecycleEnum.LIVE;
  switch (client.subscriptionStatus) {
    case "TRIAL":
      return storeLifecycleEnum.TRIAL;
    case "PAST_DUE":
      return storeLifecycleEnum.PAST_DUE;
    case "CANCELLED":
      return storeLifecycleEnum.CANCELLED;
    case "SUSPENDED":
      return storeLifecycleEnum.SUSPENDED;
    default:
      return storeLifecycleEnum.SET_UP;
  }
}

/** The label of a lifecycle state ("past_due" → "Past due"). */
export function storeLifecycleLabel(key: StoreLifecycleKey): string {
  return LIFECYCLE_BADGES[key].label;
}

/** The lifecycle badge (one status per store; the payment badge is a separate column). */
export function storeLifecycle(client: Client): StatusBadge {
  return LIFECYCLE_BADGES[storeLifecycleKey(client)];
}

/**
 * This month's payment state: Paid · 3 Oct / Due 20 Oct / Overdue · 12 days (+ "Suspends on …" from the
 * grace period) / Trial / Cancelled, as the server judged it for this subscription.
 */
export function paymentState(subscription: Subscription | undefined): StatusBadge {
  if (!subscription) return { label: "No plan", tone: "neutral" };
  if (subscription.paymentState) {
    const { label, tone, detail } = subscription.paymentState;
    return { label, tone, detail: detail ?? undefined };
  }
  // A subscription row the server has not judged yet (never expected from the API).
  return { label: "Unknown", tone: "neutral" };
}

/** Grace days for a store: its own override, else the platform default (Settings › Billing rules). */
export function graceDaysFor(client: Client, platformDefault: number): number {
  return client.gracePeriodDays ?? platformDefault;
}

/**
 * PRD-024 FR-1.7 (B-05): days until the renewal, negative when overdue.
 * Overdue days are the server's (`daysOverdue`); a renewal date that has
 * passed without the server calling it overdue counts as due today.
 */
export function daysUntilDue(subscription: Subscription, now: Date = new Date()): number {
  const overdue = subscription.daysOverdue ?? 0;
  if (overdue > 0) return -overdue;
  return Math.max(0, daysUntil(subscription.renewalDate, now));
}
