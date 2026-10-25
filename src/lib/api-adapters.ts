/**
 * API → console entity adapters (PRD-005 FR-11.3)
 *
 * The screens keep their `Client`, `Subscription` and `Plan` types; these
 * functions map the platform-admin API rows onto them so each screen can
 * move to the API without a rewrite. Since Phase 2 the server also sends
 * the health score, payment badge and usage snapshot; they ride along on
 * the mapped objects and `lib/storeHealth` / `lib/storeStatus` prefer them
 * over the client-side rules (one rule, on the server).
 */

import type { Client, ClientStatus, Plan, PlatformSettings, Subscription } from "../types";
import { planNameEnum } from "../types";
import type {
  PlatformPlan,
  PlatformSettingsApi,
  PlatformSubscription,
  PlatformTenant,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

const MB_PER_GB = 1024;

// ─── Helpers ──────────────────────────────────────────────────────────────

function clientStatusOf(tenant: PlatformTenant): ClientStatus {
  if (tenant.status === "SUSPENDED") return "suspended";
  if (tenant.subscription?.status === "TRIAL") return "trial";
  return "active";
}

function featureList(plan: PlatformPlan): string[] {
  const features: string[] = [];
  if (plan.features.onlineStore) features.push("Online store");
  if (plan.features.blogSystem !== "NONE") {
    features.push(`${capitalise(plan.features.blogSystem)} blog`);
  }
  if (plan.features.lookCreation) features.push("Lookbooks");
  features.push(`${capitalise(plan.features.analytics)} analytics`);
  if (plan.features.salesChannels) features.push("Sales channels");
  features.push(`${plan.features.prioritySupport.replace("_", " ").toLowerCase()} support`);
  return features;
}

/**
 * A plan limit, or `null` when the plan sets none. The backend usage job
 * treats a limit that is not positive as "no limit" too (UX-23).
 */
function limitOf(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function capitalise(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// ─── Adapters ─────────────────────────────────────────────────────────────

export function toSubscription(
  row: PlatformSubscription,
  tenant?: Pick<PlatformTenant, "paymentState">,
): Subscription {
  return {
    id: row.id,
    clientId: row.tenantId,
    clientName: row.tenantName,
    plan: row.plan?.name ?? planNameEnum.STARTER,
    status: row.status,
    renewalDate: row.renewalDate,
    mrr: row.mrr,
    amountDue: row.amountDue,
    startedAt: row.startedAt ?? undefined,
    canceledAt: row.cancelledAt ?? undefined,
    billingCycle: row.billingCycle,
    pendingPlanId: row.pendingPlanId ?? undefined,
    pendingBillingCycle: row.pendingBillingCycle ?? undefined,
    paymentState: tenant?.paymentState ?? undefined,
  };
}

export function toClient(tenant: PlatformTenant): Client {
  const subscription = tenant.subscription;
  const usage = tenant.usage;
  return {
    id: tenant.id,
    storeName: tenant.name,
    ownerName: tenant.owner.name ?? "—",
    ownerEmail: tenant.owner.email ?? tenant.billing.contactEmail ?? "—",
    plan: subscription?.plan?.name ?? tenant.plan?.name ?? planNameEnum.STARTER,
    status: clientStatusOf(tenant),
    mrr: tenant.monthlyFee,
    orders30d: usage?.orders30d ?? 0,
    revenue: usage?.revenue30d ?? 0,
    growthPercent: usage?.growthPercent ?? 0,
    sessions30d: usage?.sessions30d ?? 0,
    pageViews30d: usage?.pageViews30d ?? 0,
    conversionRate30d: usage?.conversionRate30d ?? 0,
    lastActive:
      usage?.lastActiveAt ?? tenant.updatedAt ?? tenant.createdAt ?? new Date(0).toISOString(),
    joinedDate: tenant.createdAt ?? new Date(0).toISOString(),
    usage: {
      products: usage?.products ?? 0,
      storageGb: usage ? Math.round((usage.storageMb / MB_PER_GB) * 100) / 100 : 0,
      bandwidthGb: null,
    },
    notes: tenant.notes ?? "",
    gracePeriodDays: tenant.gracePeriodDaysOverride ?? undefined,
    slug: tenant.slug,
    domain: tenant.domain ?? undefined,
    ownerPhone: tenant.owner.phone ?? undefined,
    onboarding: tenant.onboarding,
    health: { score: tenant.healthScore, factors: tenant.healthFactors },
    paymentState: tenant.paymentState,
  };
}

/** The subscription rows the console's lists and reports read. */
export function subscriptionsOf(tenants: PlatformTenant[]): Subscription[] {
  return tenants
    .filter((tenant) => tenant.subscription)
    .map((tenant) => toSubscription(tenant.subscription!, tenant));
}

export function toPlan(plan: PlatformPlan, tenants: PlatformTenant[] = []): Plan {
  return {
    id: plan.id,
    name: plan.name,
    priceMonthly: plan.price.monthly,
    features: featureList(plan),
    clientCount: tenants.filter(
      (tenant) => (tenant.subscription?.plan?.id ?? tenant.plan?.id) === plan.id,
    ).length,
    limits: {
      products: limitOf(plan.limits.maxSkus),
      // Storage and bandwidth limits are not on the backend plan yet.
      storageGb: null,
      bandwidthGb: null,
    },
  };
}

// ─── Scheduled plan change ────────────────────────────────────────────────

export interface ScheduledPlanChange {
  plan: Plan | null;
  billingCycle: "MONTHLY" | "YEARLY" | null;
  /** The renewal date the change takes effect on. */
  effectiveAt: string;
}

/**
 * The plan change waiting for the next renewal (PRD-014 D6), or `null`.
 * A cycle-only change keeps the current plan id in `pendingPlanId`.
 */
export function scheduledPlanChangeOf(
  subscription: Subscription | undefined,
  plans: Plan[],
): ScheduledPlanChange | null {
  if (!subscription?.pendingPlanId && !subscription?.pendingBillingCycle) {
    return null;
  }
  return {
    plan: plans.find((plan) => plan.id === subscription.pendingPlanId) ?? null,
    billingCycle: subscription.pendingBillingCycle ?? null,
    effectiveAt: subscription.renewalDate,
  };
}

// ─── Usage bars ───────────────────────────────────────────────────────────

export interface UsageBar {
  /** 0–100, or `null` when no bar can be drawn. */
  percent: number | null;
  /** True when the plan sets no limit for the metric. */
  unlimited: boolean;
}

/**
 * One plan-usage bar (UX-23). Without a positive limit there is no bar
 * ("No limit"), and without a measured value there is no percentage
 * either, so the card never shows a 100 % red bar or `NaN%`.
 */
export function usageBarOf(
  used: number | null | undefined,
  limit: number | null | undefined,
): UsageBar {
  const cap = limitOf(limit);
  if (cap === null) return { percent: null, unlimited: true };
  if (typeof used !== "number" || !Number.isFinite(used)) {
    return { percent: null, unlimited: false };
  }
  const percent = Math.round((Math.max(0, used) / cap) * 100);
  return { percent: Math.min(100, percent), unlimited: false };
}

// ─── Settings ─────────────────────────────────────────────────────────────

export function toPlatformSettings(api: PlatformSettingsApi): PlatformSettings {
  return {
    health: { ...api.health },
    gracePeriodDays: api.gracePeriodDays,
    billing: { provider: api.billing.provider, configured: api.billing.configured === true },
    reminders: {
      daysBeforeDue: [...api.reminders.daysBeforeDue],
      daysAfterDue: [...api.reminders.daysAfterDue],
      email: api.reminders.channels.email,
      sms: api.reminders.channels.sms,
      whatsapp: api.reminders.channels.whatsapp,
      template: api.reminders.template,
    },
    yearKind: api.yearKind,
  };
}

export function toPlatformSettingsInput(settings: PlatformSettings): PlatformSettingsApi {
  return {
    health: { ...settings.health },
    gracePeriodDays: settings.gracePeriodDays,
    billing: { provider: settings.billing?.provider ?? "MANUAL" },
    reminders: {
      daysBeforeDue: [...settings.reminders.daysBeforeDue],
      daysAfterDue: [...settings.reminders.daysAfterDue],
      channels: {
        email: settings.reminders.email,
        sms: settings.reminders.sms,
        whatsapp: settings.reminders.whatsapp,
      },
      template: settings.reminders.template ?? "",
    },
    yearKind: settings.yearKind ?? "CALENDAR",
  };
}
