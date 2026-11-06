/**
 * Plans by identity (PRD-024 FR-1.3, D-03, B-08, B-10)
 *
 * A store is on one plan **version** (id, version, limits; a custom plan
 * belongs to one store). The console used to match plans by tier name,
 * which lent a store the limits of another version or another store's
 * custom plan. These helpers name, list and price plans by id.
 */

import type { Client, Plan } from "../types";
import { getPlanLabel } from "./display-labels.util";
import { formatPlanName } from "../components/ui/format-name";

// ─── Types ────────────────────────────────────────────────────────────────

export type BillingCycle = "MONTHLY" | "YEARLY";

type PlanNaming = Pick<Plan, "name" | "displayName" | "version" | "tenantId">;

// ─── Constants ────────────────────────────────────────────────────────────

/** The server's default store settings (`DEFAULT_TENANT_SETTINGS`). */
export const DEFAULT_STORE_TIMEZONE = "Asia/Kolkata";

export const DEFAULT_STORE_CURRENCY = "INR";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

// ─── Labels ───────────────────────────────────────────────────────────────

/**
 * Round 2 D16: the one plan name every surface shows (header chip, Overview,
 * Billing): the plan version's display name, else the tier in Title Case
 * ("Plus"). The version ("v1") is added only on Billing.
 */
export function planLabel(plan: { displayName?: string | null; name?: string | null } | null | undefined): string {
  if (!plan) return "No plan";
  return plan.displayName ? formatPlanName(plan.displayName) : getPlanLabel((plan.name ?? "") as any);
}

/** Round 2 D16: the store's plan name from its own plan version (the subscription's), else the tier. */
export function clientPlanName(client: Pick<Client, "plan" | "planRef">): string {
  return client.planRef?.displayName ? formatPlanName(client.planRef.displayName) : getPlanLabel(client.plan);
}

/** "Premium v2", "Acme v1 (custom)": one plan version's name. */
export function planOptionLabel(plan: PlanNaming): string {
  const name = plan.displayName ? formatPlanName(plan.displayName) : getPlanLabel(plan.name);
  const custom = plan.tenantId ? " (custom)" : "";
  return `${name} v${plan.version ?? 1}${custom}`;
}

/** The store's plan as lists show it: its own version, else the tier. */
export function clientPlanLabel(client: Client): string {
  const ref = client.planRef;
  if (!ref) return getPlanLabel(client.plan);
  const name = ref.displayName ? formatPlanName(ref.displayName) : getPlanLabel(client.plan);
  const custom = ref.custom ? " (custom)" : "";
  return `${name} v${ref.version ?? 1}${custom}`;
}

// ─── Lists ────────────────────────────────────────────────────────────────

/** Plan filter options from `platformPlans`: global plans, then custom ones. */
export function planFilterOptions(
  plans: readonly Plan[],
): { key: string; label: string }[] {
  const global = plans.filter((plan) => !plan.tenantId);
  const custom = plans.filter((plan) => plan.tenantId);
  return [...global, ...custom].map((plan) => ({
    key: plan.id,
    label: planOptionLabel(plan),
  }));
}

/**
 * Add store offers only global plans that can be sold now: ACTIVE and not
 * a custom plan of another store (the server answers `PLAN_OTHER_TENANT`).
 */
export function addStorePlans(plans: readonly Plan[]): Plan[] {
  return plans.filter(
    (plan) => !plan.tenantId && (plan.status ?? "ACTIVE") === "ACTIVE",
  );
}

/** The price line under the plan picker, for the chosen billing cycle. */
export function planPriceHint(
  plan: Pick<Plan, "priceMonthly" | "priceYearly">,
  cycle: BillingCycle,
  format: (amount: number) => string,
): string {
  if (cycle === "YEARLY") {
    return plan.priceYearly != null
      ? `${format(plan.priceYearly)} / year`
      : "No yearly price on this plan";
  }
  return `${format(plan.priceMonthly)} / month`;
}

// ─── Store settings ───────────────────────────────────────────────────────

/** A currency field: a three-letter code, upper-cased, or `null`. */
export function normaliseCurrency(value: string): string | null {
  const code = value.trim().toUpperCase();
  return CURRENCY_PATTERN.test(code) ? code : null;
}
