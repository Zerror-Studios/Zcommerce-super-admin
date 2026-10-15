import { describe, expect, it } from "vitest";
import { clients, subscriptions, transactions } from "./mockData";
import {
  applyDrillToPayments,
  applyDrillToShops,
  buildPaymentReportRows,
  buildShopReportRows,
  buildSubscriptionReportOverview,
} from "./subscriptionReports";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";

const asOf = new Date("2026-10-06T12:00:00Z");
const rangeStart = new Date(2026, 9, 1);
const rangeEnd = new Date(2026, 9, 6, 23, 59, 59, 999);

const baseInput = {
  clients,
  subscriptions,
  transactions,
  asOf,
  rangeStart,
  rangeEnd,
  settings: DEFAULT_PLATFORM_SETTINGS,
};

describe("subscriptionReports", () => {
  it("overview healthy + at_risk + unhealthy equals total shops", () => {
    const overview = buildSubscriptionReportOverview(baseInput);
    expect(
      overview.healthyCount + overview.atRiskCount + overview.unhealthyCount,
    ).toBe(overview.totalShops);
  });

  it("drill unhealthy shops count matches overview card", () => {
    const overview = buildSubscriptionReportOverview(baseInput);
    const shops = buildShopReportRows(baseInput);
    const drilled = applyDrillToShops(shops, "unhealthy", asOf);
    expect(drilled.length).toBe(overview.unhealthyCount);
  });

  it("drill pending payments count matches overview card", () => {
    const overview = buildSubscriptionReportOverview(baseInput);
    const payments = buildPaymentReportRows(baseInput);
    const drilled = applyDrillToPayments(
      payments,
      "pending",
      rangeStart,
      rangeEnd,
      asOf,
    );
    expect(drilled.length).toBe(overview.pendingPayments.count);
  });

  it("drill paid_month payments count matches overview card", () => {
    const overview = buildSubscriptionReportOverview(baseInput);
    const payments = buildPaymentReportRows(baseInput);
    const drilled = applyDrillToPayments(
      payments,
      "paid_month",
      rangeStart,
      rangeEnd,
      asOf,
    );
    expect(drilled.length).toBe(overview.paidThisMonth.count);
  });
});
