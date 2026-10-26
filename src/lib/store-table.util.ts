/**
 * Stores table: tabs, saved views, filters and the default order
 * (docs/design/09-settings-and-scale.md §3.7).
 *
 * Pure helpers over the loaded store list; the page keeps the choices in the
 * URL. Nothing here changes how a store's status, payment or health is judged:
 * those still come from lib/storeStatus and lib/storeHealth.
 */

import { getHealthBand } from "../components/ui/status-map";
import { subscriptionStatusEnum, type Client, type Subscription } from "../types";
import { getStoreHealth } from "./storeHealth";
import { normaliseLifecycleKey, paymentState, storeLifecycleEnum, storeLifecycleKey } from "./storeStatus";
import { daysUntil } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────

/** Status tabs, then the saved views ("Overdue", "Trials ending this week"). */
export const storeTabEnum = {
  ALL: "all",
  LIVE: "live",
  SET_UP: "setup",
  TRIAL: "trial",
  UNPAID: "unpaid",
  SUSPENDED: "suspended",
  OVERDUE: "overdue",
  TRIALS_WEEK: "trials-week",
} as const;

export type StoreTab = (typeof storeTabEnum)[keyof typeof storeTabEnum];

export const STORE_TABS: StoreTab[] = Object.values(storeTabEnum);

export const healthBandEnum = {
  HEALTHY: "healthy",
  AT_RISK: "at-risk",
  CRITICAL: "critical",
} as const;

export type HealthBandKey = (typeof healthBandEnum)[keyof typeof healthBandEnum];

export interface StoreFilters {
  plans: string[];
  statuses: string[];
  health: HealthBandKey[];
  /** Only stores whose payment is overdue. */
  overdue: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** "This week" for the trials view: renews within the next 7 days. */
const TRIAL_WEEK_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────

export function isStoreTab(value: string | null | undefined): value is StoreTab {
  return value != null && (STORE_TABS as string[]).includes(value);
}

/** Unpaid = something issued and not yet paid (the server's open-invoice rule, as in Collections). */
export function isUnpaid(subscription?: Subscription): boolean {
  return (
    subscription != null &&
    (subscription.status === subscriptionStatusEnum.ACTIVE ||
      subscription.status === subscriptionStatusEnum.PAST_DUE) &&
    subscription.amountDue > 0
  );
}

/** Overdue = the server's payment badge is critical (same rule as Home › Needs attention). */
export function isOverdue(subscription?: Subscription): boolean {
  return subscription != null && paymentState(subscription).tone === "danger";
}

export function isTrialEndingThisWeek(
  client: Client,
  subscription: Subscription | undefined,
  now: Date,
): boolean {
  if (client.status !== "trial" || !subscription?.renewalDate) return false;
  const days = daysUntil(subscription.renewalDate, now);
  return days >= 0 && days <= TRIAL_WEEK_DAYS;
}

/** The kit's health band for a store, as a URL-safe key. */
export function healthBandOf(client: Client): HealthBandKey {
  const tone = getHealthBand(getStoreHealth(client).score).tone;
  if (tone === "success") return healthBandEnum.HEALTHY;
  if (tone === "warning") return healthBandEnum.AT_RISK;
  return healthBandEnum.CRITICAL;
}

export function matchesTab(
  tab: StoreTab,
  client: Client,
  subscription: Subscription | undefined,
  now: Date,
): boolean {
  switch (tab) {
    // PRD-024 FR-1.9 (D4): the lifecycle state, Live = went live (liveAt).
    case storeTabEnum.LIVE:
      return storeLifecycleKey(client) === storeLifecycleEnum.LIVE;
    case storeTabEnum.SET_UP:
      return storeLifecycleKey(client) === storeLifecycleEnum.SET_UP;
    case storeTabEnum.TRIAL:
      return storeLifecycleKey(client) === storeLifecycleEnum.TRIAL;
    case storeTabEnum.SUSPENDED:
      return storeLifecycleKey(client) === storeLifecycleEnum.SUSPENDED;
    case storeTabEnum.UNPAID:
      return isUnpaid(subscription);
    case storeTabEnum.OVERDUE:
      return isOverdue(subscription);
    case storeTabEnum.TRIALS_WEEK:
      return isTrialEndingThisWeek(client, subscription, now);
    default:
      return true;
  }
}

/**
 * PRD-024 FR-1.3 (B-08): plan filter values are plan version ids from
 * `platformPlans`; older links carry a tier name, still matched by tier.
 */
export function matchesPlanFilter(values: string[], client: Client): boolean {
  const planId = client.planRef?.id;
  return values.some((value) => value === planId || value === client.plan);
}

/** PRD-024 FR-1.9: status filter values are lifecycle states (legacy `active` = Live). */
export function matchesStatusFilter(values: string[], client: Client): boolean {
  const key = storeLifecycleKey(client);
  return values.some((value) => normaliseLifecycleKey(value) === key);
}

export function matchesFilters(
  filters: StoreFilters,
  client: Client,
  subscription: Subscription | undefined,
): boolean {
  if (filters.plans.length > 0 && !matchesPlanFilter(filters.plans, client)) return false;
  if (filters.statuses.length > 0 && !matchesStatusFilter(filters.statuses, client)) return false;
  if (filters.health.length > 0 && !filters.health.includes(healthBandOf(client))) return false;
  if (filters.overdue && !isOverdue(subscription)) return false;
  return true;
}

/** Default order (§3.7): lowest health first, then the earliest billing due date. */
export function compareByHealthThenDue(
  a: Client,
  b: Client,
  subscriptionByClientId: Map<string, Subscription>,
): number {
  const health = getStoreHealth(a).score - getStoreHealth(b).score;
  if (health !== 0) return health;
  const dueA = subscriptionByClientId.get(a.id)?.renewalDate || "9999";
  const dueB = subscriptionByClientId.get(b.id)?.renewalDate || "9999";
  return dueA.localeCompare(dueB);
}

/** "a,b" ↔ ["a", "b"] for multi-value URL filters. */
export function splitParam(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function joinParam(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}
