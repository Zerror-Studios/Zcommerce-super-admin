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

import type {
  Client,
  ClientPlanRef,
  ClientStatus,
  Plan,
  PlatformSettings,
  Subscription,
} from "../types";
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
    planId: row.plan?.id ?? undefined,
    planVersion: row.plan?.version ?? undefined,
    planDisplayName: row.plan?.displayName ?? undefined,
    creditBalance: row.creditBalance ?? undefined,
    billingState: row.billingState ?? undefined,
    ordersPauseAt: row.ordersPauseAt ?? undefined,
    suspendsAt: row.suspendsAt ?? undefined,
    paymentState: tenant?.paymentState ?? undefined,
    daysOverdue: row.daysOverdue ?? 0,
  };
}

/**
 * PRD-024 FR-1.3 (D-03): the store's own plan version, from the
 * subscription (else the tenant). Limits come from that version, so a custom
 * plan or a newer version of the tier never lends its limits.
 */
export function planRefOf(tenant: PlatformTenant): ClientPlanRef | undefined {
  const plan = tenant.subscription?.plan ?? tenant.plan;
  if (!plan) return undefined;
  return {
    id: plan.id,
    version: plan.version ?? null,
    displayName: plan.displayName ?? null,
    custom: plan.tenantId != null,
    limits: {
      products: limitOf(plan.limits.maxSkus),
      staff: limitOf(plan.limits.maxStaffAccounts),
    },
  };
}

export function toClient(tenant: PlatformTenant): Client {
  const subscription = tenant.subscription;
  // PRD-024 FR-1.7 (B-03): without a snapshot the usage figures are not
  // measured; they stay 0 for sorting, and `hasUsage` makes screens show "—".
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
    // PRD-024 FR-2.1: null (no previous sales, or no snapshot) is "no comparison", never 0.
    growthPercent: usage ? usage.growthPercent : null,
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
    ownerEmailSet: !!tenant.owner.email?.trim(),
    onboarding: tenant.onboarding,
    health: { score: tenant.healthScore, factors: tenant.healthFactors },
    paymentState: tenant.paymentState,
    billingContactEmail: tenant.billing.contactEmail ?? undefined,
    gstin: tenant.billing.gstin ?? undefined,
    timezone: tenant.timezone ?? undefined,
    currency: tenant.currency ?? undefined,
    tenantStatus: tenant.status,
    suspendCategory: tenant.suspendCategory ?? undefined,
    suspendReason: tenant.suspendReason ?? undefined,
    suspendedAt: tenant.suspendedAt ?? undefined,
    purgeAfter: tenant.purgeAfter ?? undefined,
    domainStatus: tenant.domainStatus,
    pendingDomain: tenant.pendingDomain ?? undefined,
    liveAt: tenant.liveAt ?? undefined,
    subscriptionStatus: subscription?.status ?? undefined,
    hasUsage: usage != null,
    usageAsOf: usage?.date ?? undefined,
    staffCount: usage ? usage.staffCount : null,
    messagesThisMonth: usage?.messagesThisMonth ?? null,
    usagePartial: usage?.partial === true,
    region: tenant.region ?? undefined,
    planRef: planRefOf(tenant),
  };
}

/** The subscription rows the console's lists and reports read. */
export function subscriptionsOf(tenants: PlatformTenant[]): Subscription[] {
  return tenants
    .filter((tenant) => tenant.subscription)
    .map((tenant) => toSubscription(tenant.subscription!, tenant));
}

/**
 * A plan row. The store count comes from the server (`tenantCount`, PRD-014
 * close-out), so it is right even before every tenant page has loaded.
 */
export function toPlan(plan: PlatformPlan): Plan {
  return {
    id: plan.id,
    name: plan.name,
    priceMonthly: plan.price.monthly,
    features: featureList(plan),
    clientCount: plan.tenantCount ?? 0,
    limits: {
      products: limitOf(plan.limits.maxSkus),
      // Storage and bandwidth limits are not on the backend plan yet.
      storageGb: null,
      bandwidthGb: null,
    },
    priceYearly: plan.price.yearly,
    version: plan.version,
    status: plan.status,
    displayName: plan.displayName,
    tenantId: plan.tenantId,
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
    billing: {
      provider: api.billing.provider,
      configured: api.billing.configured === true,
      checkoutAvailable: api.billing.checkoutAvailable === true,
      bankTransferInstructions: api.billing.bankTransferInstructions ?? "",
      supportContact: api.billing.supportContact ?? "",
    },
    reminders: {
      daysBeforeDue: [...api.reminders.daysBeforeDue],
      daysAfterDue: [...api.reminders.daysAfterDue],
      email: api.reminders.channels.email,
      sms: api.reminders.channels.sms,
      whatsapp: api.reminders.channels.whatsapp,
      template: api.reminders.template,
    },
    yearKind: api.yearKind,
    dunning: api.dunning ? { ...api.dunning } : undefined,
    entitlementsMode: api.entitlementsMode,
  };
}

/**
 * The full settings save. Dunning and the entitlement mode are left out on
 * purpose: they are saved on their own, behind a confirmation (PRD-016
 * FR-14, FR-16), so a Billing rules save never changes them.
 */
export function toPlatformSettingsInput(settings: PlatformSettings): PlatformSettingsApi {
  return {
    health: { ...settings.health },
    gracePeriodDays: settings.gracePeriodDays,
    billing: {
      provider: settings.billing?.provider ?? "MANUAL",
      // PRD-017 FR-3.2: an empty text clears the setting on the server.
      bankTransferInstructions: settings.billing?.bankTransferInstructions?.trim() ?? "",
      supportContact: settings.billing?.supportContact?.trim() ?? "",
    },
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
