import { describe, expect, it } from "vitest";
import {
  scheduledPlanChangeOf,
  subscriptionsOf,
  toClient,
  toPlan,
  toSubscription,
  usageBarOf,
} from "./api-adapters";
import type { PlatformPlan, PlatformSubscription, PlatformTenant } from "../types/platform-api";

const plan: PlatformPlan = {
  id: "plan-plus",
  tenantId: null,
  name: "PLUS",
  price: { monthly: 4999, yearly: 48000, currency: "INR" },
  limits: {
    maxSkus: 5000,
    emailsPerMonth: 10000,
    smsPerMonth: 1000,
    whatsappPerMonth: 1000,
    maxStaffAccounts: 10,
    internationalMarkets: 2,
    developmentHours: 4,
    aiQuestionsPerWeek: 0,
    aiConnectorCallsPerWeek: 0,
    aiMonthlyTokenBudget: 0,
  },
  features: {
    onlineStore: true,
    blogSystem: "ADVANCED",
    lookCreation: true,
    analytics: "ADVANCED",
    salesChannels: true,
    prioritySupport: "6_HOURS",
    unlimitedWebHosting: true,
    sslCertificate: true,
    aiEnabled: false,
    aiDailySummary: false,
  },
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const subscription: PlatformSubscription = {
  id: "sub-1",
  tenantId: "t-1",
  tenantName: "Nahara",
  plan,
  status: "PAST_DUE",
  billingCycle: "YEARLY",
  mrr: 4000,
  amountDue: 48000,
  renewalDate: "2026-10-10T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  trialEndsAt: null,
  cancelledAt: null,
  cancelAtPeriodEnd: false,
  daysOverdue: 7,
  pendingPlanId: null,
  pendingBillingCycle: null,
};

const tenant: PlatformTenant = {
  id: "t-1",
  slug: "nahara",
  name: "Nahara",
  domain: "nahara.in",
  region: "ap-south-1",
  status: "ACTIVE",
  timezone: "Asia/Kolkata",
  currency: "INR",
  owner: { name: "Asha", email: "asha@nahara.in", phone: null },
  billing: { contactEmail: null, gstin: null },
  onboarding: { status: "READY", error: null, steps: [] },
  gracePeriodDaysOverride: 10,
  notes: "VIP",
  plan,
  subscription,
  monthlyFee: 4000,
  healthScore: 88,
  healthFactors: ["Account active", "Payments healthy"],
  paymentState: { label: "Overdue · 7 days", tone: "danger", detail: "Past grace period" },
  subscriptionHealth: { bucket: "unhealthy", reason: "Payment overdue by 7 days", daysOverdue: 7, daysUntilRenewal: -7, isOverdueInGrace: false },
  usage: { date: "2026-10-17", products: 120, orders30d: 40, revenue30d: 95000, growthPercent: 12.5, storageMb: 512, staffCount: 3, lastActiveAt: "2026-10-16T09:30:00.000Z", pageViews30d: 5200, sessions30d: 2000, conversionRate30d: 2 },
  suspendedAt: null,
  suspendReason: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("api adapters", () => {
  it("maps a tenant onto the console Client shape", () => {
    const client = toClient(tenant);
    expect(client).toMatchObject({
      id: "t-1",
      storeName: "Nahara",
      ownerEmail: "asha@nahara.in",
      plan: "PLUS",
      status: "active",
      mrr: 4000,
      notes: "VIP",
      gracePeriodDays: 10,
      joinedDate: "2026-01-01T00:00:00.000Z",
      orders30d: 40,
      revenue: 95000,
      growthPercent: 12.5,
      lastActive: "2026-10-16T09:30:00.000Z",
      slug: "nahara",
      health: { score: 88, factors: ["Account active", "Payments healthy"] },
    });
    expect(client.usage).toEqual({ products: 120, storageGb: 0.5, bandwidthGb: null });
    expect(client.paymentState?.label).toBe("Overdue · 7 days");
  });

  it("hands the server payment badge to subscriptions and the health libs prefer server values", async () => {
    const [row] = subscriptionsOf([tenant]);
    expect(row.paymentState?.tone).toBe("danger");
    const { getStoreHealth } = await import("./storeHealth");
    const { paymentState } = await import("./storeStatus");
    expect(getStoreHealth(toClient(tenant)).score).toBe(88);
    expect(paymentState(row).label).toBe("Overdue · 7 days");
  });

  it("keeps the snapshot date, staff, region and the plan version (PRD-024 FR-1.3, FR-1.7)", () => {
    const client = toClient({ ...tenant, liveAt: "2026-09-01T00:00:00.000Z" });
    expect(client).toMatchObject({
      hasUsage: true,
      usageAsOf: "2026-10-17",
      staffCount: 3,
      region: "ap-south-1",
      subscriptionStatus: "PAST_DUE",
      liveAt: "2026-09-01T00:00:00.000Z",
    });
    expect(client.planRef).toEqual({
      id: "plan-plus",
      version: null,
      displayName: null,
      custom: false,
      limits: { products: 5000, staff: 10 },
    });
    expect(toSubscription(subscription).daysOverdue).toBe(7);
  });

  it("marks a store without a usage snapshot as not measured (PRD-024 FR-1.7)", () => {
    const client = toClient({ ...tenant, usage: null });
    expect(client.hasUsage).toBe(false);
    expect(client.usageAsOf).toBeUndefined();
    expect(client.staffCount).toBeNull();
  });

  it("keeps a null growth as no comparison, never 0 or −100 (PRD-024 FR-2.1)", () => {
    const usage = { ...tenant.usage!, growthPercent: null, previousRevenue: 0, previousOrders: 0 };
    expect(toClient({ ...tenant, usage }).growthPercent).toBeNull();
    expect(toClient({ ...tenant, usage: null }).growthPercent).toBeNull();
    expect(toClient(tenant).growthPercent).toBe(12.5);
  });

  it("keeps messages this month and the partial flag (PRD-024 FR-2.7, FR-3.7)", () => {
    const usage = { ...tenant.usage!, partial: true, messagesThisMonth: 42 };
    expect(toClient({ ...tenant, usage })).toMatchObject({ messagesThisMonth: 42, usagePartial: true });
    expect(toClient(tenant)).toMatchObject({ messagesThisMonth: null, usagePartial: false });
  });

  it("takes the plan from the subscription, and flags a custom plan (PRD-024 FR-1.3)", () => {
    const custom = { ...plan, id: "plan-acme", tenantId: "t-1", version: 2, displayName: "Acme" };
    const client = toClient({ ...tenant, plan, subscription: { ...subscription, plan: custom } });
    expect(client.planRef).toMatchObject({ id: "plan-acme", version: 2, custom: true });
  });

  it("derives trial and suspended statuses", () => {
    expect(toClient({ ...tenant, status: "SUSPENDED" }).status).toBe("suspended");
    expect(
      toClient({ ...tenant, subscription: { ...subscription, status: "TRIAL" } }).status,
    ).toBe("trial");
    expect(toClient({ ...tenant, subscription: null, monthlyFee: 0 }).mrr).toBe(0);
  });

  it("maps subscriptions and keeps the backend enum values", () => {
    const row = toSubscription(subscription);
    expect(row).toMatchObject({
      clientId: "t-1",
      clientName: "Nahara",
      plan: "PLUS",
      status: "PAST_DUE",
      mrr: 4000,
      amountDue: 48000,
    });
    expect(row.canceledAt).toBeUndefined();
    expect(subscriptionsOf([tenant, { ...tenant, id: "t-2", subscription: null }])).toHaveLength(1);
  });

  it("maps plans with a readable feature list and store count", () => {
    const mapped = toPlan({ ...plan, tenantCount: 2 });
    expect(mapped.priceMonthly).toBe(4999);
    expect(mapped.clientCount).toBe(2);
    expect(mapped.limits).toEqual({ products: 5000, storageGb: null, bandwidthGb: null });
    expect(mapped.features).toContain("Advanced blog");
    expect(mapped.features).toContain("6 hours support");
  });

  it("counts no stores when the plan read didn't ask for tenantCount", () => {
    expect(toPlan(plan).clientCount).toBe(0);
  });

  // ─── Usage bars (UX-23) ─────────────────────────────────────────────────

  it("maps a plan without a SKU limit to no limit", () => {
    const unlimited = toPlan({ ...plan, limits: { ...plan.limits, maxSkus: 0 } });
    expect(unlimited.limits.products).toBeNull();
  });

  it("draws a bar only against a positive limit", () => {
    expect(usageBarOf(120, 5000)).toEqual({ percent: 2, unlimited: false });
    expect(usageBarOf(6000, 5000)).toEqual({ percent: 100, unlimited: false });
    expect(usageBarOf(0, 25)).toEqual({ percent: 0, unlimited: false });
  });

  it("shows no limit instead of 100 % or NaN when the limit is 0 or missing", () => {
    expect(usageBarOf(0.5, 0)).toEqual({ percent: null, unlimited: true });
    expect(usageBarOf(0, 0)).toEqual({ percent: null, unlimited: true });
    expect(usageBarOf(3, null)).toEqual({ percent: null, unlimited: true });
    expect(usageBarOf(3, -1)).toEqual({ percent: null, unlimited: true });
    expect(usageBarOf(3, Number.NaN)).toEqual({ percent: null, unlimited: true });
  });

  it("has no percentage when the usage is not measured", () => {
    expect(usageBarOf(null, 10)).toEqual({ percent: null, unlimited: false });
    expect(usageBarOf(Number.NaN, 10)).toEqual({ percent: null, unlimited: false });
  });

  // ─── Scheduled plan change (PRD-014 D6) ─────────────────────────────────

  it("has no scheduled change without a pending plan or cycle", () => {
    expect(scheduledPlanChangeOf(toSubscription(subscription), [toPlan(plan)])).toBeNull();
    expect(scheduledPlanChangeOf(undefined, [])).toBeNull();
  });

  it("names the pending plan and the renewal date it starts on", () => {
    const row = toSubscription({ ...subscription, pendingPlanId: "plan-plus", pendingBillingCycle: "MONTHLY" });
    expect(row.pendingPlanId).toBe("plan-plus");
    const change = scheduledPlanChangeOf(row, [toPlan(plan)]);
    expect(change?.plan?.name).toBe("PLUS");
    expect(change?.billingCycle).toBe("MONTHLY");
    expect(change?.effectiveAt).toBe("2026-10-10T00:00:00.000Z");
  });

  it("keeps an unknown pending plan as null rather than guessing", () => {
    const row = toSubscription({ ...subscription, pendingPlanId: "plan-gone" });
    expect(scheduledPlanChangeOf(row, [toPlan(plan)])?.plan).toBeNull();
  });
});
