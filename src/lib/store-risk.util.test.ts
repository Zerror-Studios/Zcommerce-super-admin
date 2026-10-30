import { describe, expect, it } from "vitest";
import type { PlatformStoreAtRisk } from "../types/platform-api";
import { atRiskOffset, atRiskPage, riskFigures, riskReasonChips } from "./store-risk.util";

const ROW: PlatformStoreAtRisk = {
  tenantId: "t1",
  slug: "kesar-kin",
  name: "Kesar & Kin",
  status: "ACTIVE",
  reasons: ["INVOICE_OVERDUE_PAST_GRACE", "NO_ORDERS_14D"],
  snapshotDate: "2026-10-29",
  overdueInvoices: 2,
  checkoutFailures7d: null,
  dlqDepth: 0,
  orders14d: 0,
  lastActiveAt: "2026-10-01T00:00:00.000Z",
};

describe("stores at risk (PRD-025 FR-5.2, FR-6.5)", () => {
  it("turns the reasons into labelled, toned chips in the server's order", () => {
    expect(riskReasonChips(ROW.reasons)).toEqual([
      { key: "INVOICE_OVERDUE_PAST_GRACE", label: "Invoice overdue past grace", tone: "danger" },
      { key: "NO_ORDERS_14D", label: "No orders in 14 days", tone: "warning" },
    ]);
    expect(riskReasonChips(["ORDERS_PAUSED", "DLQ_DEPTH", "CHECKOUT_FAILURES_7D"]).map((chip) => chip.tone)).toEqual([
      "danger",
      "danger",
      "warning",
    ]);
  });

  it("humanises an unknown reason instead of hiding it", () => {
    expect(riskReasonChips(["NEW_RULE"])).toEqual([{ key: "NEW_RULE", label: "New rule", tone: "neutral" }]);
  });

  it("lists the figures behind the reasons and leaves uncollected ones out", () => {
    expect(riskFigures(ROW)).toEqual([
      { key: "overdueInvoices", label: "overdue", value: 2 },
      { key: "dlqDepth", label: "dead letters", value: 0 },
      { key: "orders14d", label: "orders · 14d", value: 0 },
    ]);
  });

  it("pages from totalCount and keeps a stale page inside the list", () => {
    // An explicit page size: the default follows the kit's DEFAULT_PAGE_SIZE.
    expect(atRiskPage(1, 0, 10)).toBe(1);
    expect(atRiskPage(3, 25, 10)).toBe(3);
    expect(atRiskPage(9, 25, 10)).toBe(3);
    expect(atRiskPage(0, 25, 10)).toBe(1);
    expect(atRiskOffset(1, 10)).toBe(0);
    expect(atRiskOffset(3, 10)).toBe(20);
  });
});
