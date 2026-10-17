import { afterEach, describe, expect, it, vi } from "vitest";
import { clients, subscriptions, transactions } from "./mockData";
import {
  applyDrillToPayments,
  applyDrillToShops,
  buildPaymentReportRows,
  buildShopReportRows,
  buildSubscriptionReportOverview,
  CSV_REVOKE_DELAY_MS,
  downloadCsv,
  escapeCsvCell,
  rowsToCsv,
} from "./subscriptionReports";
import { DEFAULT_PLATFORM_SETTINGS } from "./platformSettings";
import type { Client, Subscription, Transaction } from "../types";

const asOf = new Date("2026-10-06T12:00:00Z");
const rangeStart = new Date(2026, 9, 1);
const rangeEnd = new Date(2026, 9, 6, 23, 59, 59, 999);
/** Calendar-month input (no range), as the month-only callers pass it. */
const month = new Date(2026, 9, 1);

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

  it("drill overdue_grace shops count matches overview card", () => {
    const overview = buildSubscriptionReportOverview(baseInput);
    const shops = buildShopReportRows(baseInput);
    const drilled = applyDrillToShops(shops, "overdue_grace", asOf, month);
    expect(drilled.length).toBe(overview.overdueInGraceCount);
    expect(drilled.every((shop) => shop.health === "at_risk")).toBe(true);
  });
});

// ─── Fixtures for focused cases ───────────────────────────────────────────

const client: Client = {
  id: "c1",
  storeName: "Test Store",
  ownerName: "Owner",
  ownerEmail: "o@test.com",
  plan: "PLUS",
  status: "active",
  mrr: 99,
  orders30d: 50,
  revenue: 1000,
  growthPercent: 5,
  lastActive: "2026-10-05T12:00:00Z",
  joinedDate: "2025-01-01",
  usage: { products: 10, storageGb: 1, bandwidthGb: 1 },
  notes: "",
};

const sub = (overrides: Partial<Subscription>): Subscription => ({
  id: "s1",
  clientId: "c1",
  clientName: "Test Store",
  plan: "PLUS",
  status: "ACTIVE",
  renewalDate: "2026-11-01",
  mrr: 99,
  amountDue: 0,
  startedAt: "2025-11-01",
  ...overrides,
});

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: "t1",
  clientId: "c1",
  clientName: "Test Store",
  amount: 99,
  currency: "INR",
  gateway: "RAZORPAY",
  status: "success",
  date: "2026-09-01T10:00:00Z",
  dueDate: "2026-09-01",
  transactionId: "pay_1",
  ...overrides,
});

// PRD-002 SA-3
describe("month snapshots", () => {
  it("previous month is built from that month's rows, not current state", () => {
    const input = {
      clients: [client],
      // Today the client owes nothing for October…
      subscriptions: [sub({ renewalDate: "2026-11-01", amountDue: 0 })],
      transactions: [
        // …but September's invoice was only paid in October.
        txn({ id: "t1", dueDate: "2026-09-01", date: "2026-10-02T10:00:00Z" }),
        txn({ id: "t2", dueDate: "2026-10-01", date: "2026-10-01T10:00:00Z" }),
      ],
      asOf,
      month,
    };
    const overview = buildSubscriptionReportOverview(input);

    expect(overview.previousMonth.collectedAmount).toBe(0);
    expect(overview.previousMonth.pendingAmount).toBe(99);
    expect(overview.previousMonth.pendingCount).toBe(1);
    expect(overview.previousMonth.expectedAmount).toBe(99);
    expect(overview.previousMonth.collectedPercent).toBe(0);

    expect(overview.currentMonth.collectedAmount).toBe(198);
    expect(overview.currentMonth.pendingAmount).toBe(0);
    expect(overview.currentMonth.expectedAmount).toBe(99);
  });

  it("current amounts due don't leak into the previous month", () => {
    const input = {
      clients: [client],
      subscriptions: [
        sub({ status: "PAST_DUE", renewalDate: "2026-10-02", amountDue: 99 }),
      ],
      transactions: [txn({ dueDate: "2026-09-02", date: "2026-09-02T09:00:00Z" })],
      asOf,
      month,
    };
    const overview = buildSubscriptionReportOverview(input);

    expect(overview.previousMonth.pendingAmount).toBe(0);
    expect(overview.previousMonth.collectedPercent).toBe(100);
    expect(overview.currentMonth.pendingAmount).toBe(99);
  });
});

// PRD-002 SA-5
describe("UTC month bounds and multiple subscriptions", () => {
  it("counts a payment at 23:30Z on the month's last day in that month", () => {
    const payments = buildPaymentReportRows({
      clients: [client],
      subscriptions: [sub({})],
      transactions: [txn({ date: "2026-09-30T23:30:00Z" })],
      asOf,
    });
    const september = applyDrillToPayments(
      payments,
      "paid_month",
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
      asOf,
    );
    const october = applyDrillToPayments(
      payments,
      "paid_month",
      month,
      new Date(2026, 9, 31),
      asOf,
    );
    expect(september).toHaveLength(1);
    expect(october).toHaveLength(0);
  });

  it("uses the latest subscription when a client has several", () => {
    const old = sub({
      id: "s-old",
      status: "CANCELLED",
      startedAt: "2025-01-01",
      renewalDate: "2026-01-01",
      canceledAt: "2026-01-01",
      mrr: 0,
    });
    const current = sub({ id: "s-new", startedAt: "2026-01-02" });

    for (const order of [
      [old, current],
      [current, old],
    ]) {
      const [row] = buildShopReportRows({
        clients: [client],
        subscriptions: order,
        transactions: [],
        asOf,
      });
      expect(row.subscriptionStatus).toBe("ACTIVE");
      expect(row.health).not.toBe("unhealthy");
    }
  });
});

// PRD-002 SA-6
describe("CSV export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["=SUM(A1)", "+1", "-1+2", "@cmd", "\tx", "\rx"])(
    "neutralises formula-like cell %j",
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, "")).toMatch(/^'/);
    },
  );

  it("leaves numbers and plain text alone", () => {
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell("Aura Apparel")).toBe("Aura Apparel");
    expect(escapeCsvCell(null)).toBe("");
  });

  it("still quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("=1,2")).toBe(`"'=1,2"`);
  });

  it("rowsToCsv applies the escaping to every cell", () => {
    const csv = rowsToCsv(
      [{ name: "=HYPERLINK(\"x\")", amount: 10 }],
      [
        { key: "name", label: "Name" },
        { key: "amount", label: "Amount" },
      ],
    );
    expect(csv).toBe(`Name,Amount\n"'=HYPERLINK(""x"")",10`);
  });

  it("revokes the object URL only after a delay", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ click, href: "", download: "" }),
    });
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");

    downloadCsv("x.csv", "a,b");

    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CSV_REVOKE_DELAY_MS);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
