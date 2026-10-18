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
    lastActive:
      usage?.lastActiveAt ?? tenant.updatedAt ?? tenant.createdAt ?? new Date(0).toISOString(),
    joinedDate: tenant.createdAt ?? new Date(0).toISOString(),
    usage: {
      products: usage?.products ?? 0,
      storageGb: usage ? Math.round((usage.storageMb / MB_PER_GB) * 100) / 100 : 0,
      bandwidthGb: 0,
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
      products: plan.limits.maxSkus,
      // Storage and bandwidth limits are not on the backend plan yet.
      storageGb: 0,
      bandwidthGb: 0,
    },
  };
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
