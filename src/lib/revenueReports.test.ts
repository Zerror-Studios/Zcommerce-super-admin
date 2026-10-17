import { describe, expect, it } from "vitest";
import {
  MONTHLY_PLAN_REVENUE,
  buildGatewayBreakdown,
  buildPlanBreakdown,
  buildRevenueKpis,
  buildTrendWithMrr,
  computeMrr,
  filterMonthlyPlanRevenue,
  filterTransactionsInRange,
  monthTotal,
} from "./revenueReports";
import type { Client, Subscription, Transaction } from "../types";

const clients: Client[] = [
  {
    id: "c1",
    storeName: "A",
    ownerName: "O",
    ownerEmail: "a@test.com",
    plan: "PLUS",
    status: "active",
    mrr: 99,
    orders30d: 1,
    revenue: 100,
    growthPercent: 0,
    lastActive: "2026-09-01",
    joinedDate: "2025-01-01",
    usage: { products: 1, storageGb: 1, bandwidthGb: 1 },
    notes: "",
  },
  {
    id: "c2",
    storeName: "B",
    ownerName: "O",
    ownerEmail: "b@test.com",
    plan: "PREMIUM",
    status: "active",
    mrr: 29,
    orders30d: 1,
    revenue: 50,
    growthPercent: 0,
    lastActive: "2026-09-01",
    joinedDate: "2025-01-01",
    usage: { products: 1, storageGb: 1, bandwidthGb: 1 },
    notes: "",
  },
];

const subscriptions: Subscription[] = [
  {
    id: "s1",
    clientId: "c1",
    clientName: "A",
    plan: "PLUS",
    status: "ACTIVE",
    renewalDate: "2026-10-10",
    mrr: 99,
    amountDue: 0,
    startedAt: "2025-10-10",
  },
  {
    id: "s2",
    clientId: "c2",
    clientName: "B",
    plan: "PREMIUM",
    status: "ACTIVE",
    renewalDate: "2026-10-12",
    mrr: 29,
    amountDue: 0,
    startedAt: "2026-06-12",
  },
  {
    id: "s3",
    clientId: "c3",
    clientName: "C",
    plan: "PREMIUM",
    status: "TRIAL",
    renewalDate: "2026-10-20",
    mrr: 29,
    amountDue: 0,
    startedAt: "2026-09-20",
  },
];

const asOf = new Date("2026-10-06T12:00:00Z");

const transactions: Transaction[] = [
  {
    id: "t1",
    clientId: "c1",
    clientName: "A",
    amount: 99,
    currency: "INR",
    gateway: "STRIPE",
    status: "success",
    date: "2026-09-10T12:00:00Z",
    transactionId: "x1",
  },
  {
    id: "t2",
    clientId: "c2",
    clientName: "B",
    amount: 29,
    currency: "INR",
    gateway: "RAZORPAY",
    status: "failed",
    date: "2026-09-12T12:00:00Z",
    transactionId: "x2",
  },
];

describe("revenueReports", () => {
  it("filters months overlapping the selected range", () => {
    const rows = filterMonthlyPlanRevenue(
      MONTHLY_PLAN_REVENUE,
      new Date(2026, 3, 1),
      new Date(2026, 5, 30, 23, 59, 59),
    );
    expect(rows.map((r) => r.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("builds plan breakdown shares", () => {
    const monthly = filterMonthlyPlanRevenue(
      MONTHLY_PLAN_REVENUE,
      new Date(2026, 8, 1),
      new Date(2026, 8, 30, 23, 59, 59),
    );
    const rows = buildPlanBreakdown(monthly, clients, subscriptions, asOf);
    const total = rows.reduce((s, r) => s + r.revenue, 0);
    expect(total).toBe(monthTotal(monthly[0]));
    expect(rows.find((r) => r.plan === "ENTERPRISE")?.sharePercent).toBeGreaterThan(40);
  });

  it("builds KPIs and gateway split from transactions", () => {
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 30, 23, 59, 59);
    const monthly = filterMonthlyPlanRevenue(MONTHLY_PLAN_REVENUE, start, end);
    const kpis = buildRevenueKpis({
      monthly,
      allMonthly: MONTHLY_PLAN_REVENUE,
      transactions,
      subscriptions,
      rangeStart: start,
      rangeEnd: end,
      asOf,
    });
    expect(kpis.netCollected).toBe(99);
    expect(kpis.failedAmount).toBe(29);
    expect(kpis.payingStores).toBe(2);

    const gateways = buildGatewayBreakdown(transactions, start, end);
    expect(gateways.find((g) => g.gateway === "STRIPE")?.collected).toBe(99);
    expect(gateways.find((g) => g.gateway === "RAZORPAY")?.failed).toBe(29);
  });

  // PRD-002 SA-4: one MRR definition — paying, non-trial ACTIVE subscriptions
  describe("MRR", () => {
    it("excludes trials, and payingStores matches the MRR set", () => {
      const start = new Date(2026, 8, 1);
      const end = new Date(2026, 8, 30);
      const kpis = buildRevenueKpis({
        monthly: [],
        allMonthly: MONTHLY_PLAN_REVENUE,
        transactions,
        subscriptions,
        rangeStart: start,
        rangeEnd: end,
        asOf,
      });
      expect(kpis.activeMrr).toBe(128);
      expect(kpis.payingStores).toBe(2);
    });

    it("plan breakdown MRR sums to the KPI MRR", () => {
      const rows = buildPlanBreakdown(
        MONTHLY_PLAN_REVENUE,
        clients,
        subscriptions,
        asOf,
      );
      const total = rows.reduce((sum, row) => sum + row.mrr, 0);
      expect(total).toBe(computeMrr(subscriptions, asOf));
    });

    it("ignores subscriptions not yet started or already cancelled", () => {
      expect(computeMrr(subscriptions, new Date("2026-01-01T00:00:00Z"))).toBe(
        99,
      );
      const cancelled: Subscription = {
        ...subscriptions[0],
        canceledAt: "2026-03-01T00:00:00Z",
      };
      expect(computeMrr([cancelled], new Date("2026-04-01T00:00:00Z"))).toBe(0);
    });

    it("counts only the latest subscription per client", () => {
      const upgraded: Subscription = {
        ...subscriptions[0],
        id: "s1b",
        plan: "ENTERPRISE",
        mrr: 299,
        startedAt: "2026-09-01",
      };
      expect(computeMrr([subscriptions[0], upgraded], asOf)).toBe(299);
      expect(computeMrr([upgraded, subscriptions[0]], asOf)).toBe(299);
    });

    it("trend MRR uses the same definition at each month end", () => {
      const trend = buildTrendWithMrr(
        MONTHLY_PLAN_REVENUE,
        subscriptions,
        new Date(2026, 8, 1),
        new Date(2026, 8, 30),
      );
      expect(trend).toHaveLength(1);
      expect(trend[0].mrr).toBe(
        computeMrr(subscriptions, new Date("2026-09-30T23:59:59.999Z")),
      );
      expect(trend[0].revenue).toBe(
        monthTotal(MONTHLY_PLAN_REVENUE[MONTHLY_PLAN_REVENUE.length - 1]),
      );
    });

    it("trend points don't depend on the selected range", () => {
      const wide = buildTrendWithMrr(
        MONTHLY_PLAN_REVENUE,
        subscriptions,
        new Date(2025, 9, 1),
        new Date(2026, 8, 30),
      );
      const narrow = buildTrendWithMrr(
        MONTHLY_PLAN_REVENUE,
        subscriptions,
        new Date(2026, 7, 1),
        new Date(2026, 8, 30),
      );
      expect(narrow).toEqual(wide.slice(-2));
    });
  });

  // PRD-002 SA-5: range days are calendar days compared in UTC
  it("includes transactions late on the range's last UTC day", () => {
    const late: Transaction = {
      ...transactions[0],
      id: "t3",
      date: "2026-09-30T23:30:00Z",
    };
    const early: Transaction = {
      ...transactions[0],
      id: "t4",
      date: "2026-10-01T00:30:00Z",
    };
    const rows = filterTransactionsInRange(
      [late, early],
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
    );
    expect(rows.map((r) => r.id)).toEqual(["t3"]);
  });
});
