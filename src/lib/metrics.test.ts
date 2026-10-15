import { describe, expect, it } from "vitest";
import type { Client, Subscription, Transaction } from "../types";
import {
  collectionRate,
  earnedIn,
  monthPeriod,
  monthlyBilling,
  outstanding,
  projectedForYear,
  storesPaidIn,
  yearPeriod,
} from "./metrics";
import { paymentState, storeLifecycle } from "./storeStatus";

const client = (id: string, status: Client["status"], mrr: number): Client =>
  ({ id, status, mrr }) as Client;
const txn = (clientId: string, amount: number, date: string, status: Transaction["status"] = "success"): Transaction =>
  ({ id: `${clientId}-${date}`, clientId, amount, date, status }) as Transaction;
const sub = (clientId: string, status: Subscription["status"], renewalDate: string, amountDue = 0): Subscription =>
  ({ id: clientId, clientId, status, renewalDate, amountDue }) as Subscription;

const NOW = new Date(2026, 9, 15); // 15 Oct 2026

describe("monthlyBilling", () => {
  it("sums monthly fees of every store except suspended ones", () => {
    expect(monthlyBilling([client("a", "active", 299), client("b", "trial", 0), client("c", "suspended", 99)])).toBe(299);
  });
});

describe("earnedIn / storesPaidIn", () => {
  const txns = [
    txn("a", 299, "2026-10-02T10:00:00Z"),
    txn("b", 99, "2026-10-05T10:00:00Z"),
    txn("b", 49.5, "2026-10-06T10:00:00Z", "refunded"),
    txn("c", 99, "2026-10-07T10:00:00Z", "failed"),
    txn("a", 299, "2026-09-02T10:00:00Z"),
  ];
  it("counts successful payments in the period minus refunds", () => {
    expect(earnedIn(txns, monthPeriod(NOW))).toBe(299 + 99 - 49.5);
  });
  it("counts stores with a successful payment", () => {
    expect(storesPaidIn(txns, monthPeriod(NOW))).toBe(2);
  });
});

describe("yearPeriod", () => {
  it("financial year starts on 1 April", () => {
    expect(yearPeriod(new Date(2026, 1, 1), "financial").start).toEqual(new Date(2025, 3, 1));
    expect(yearPeriod(NOW, "financial").start).toEqual(new Date(2026, 3, 1));
  });
});

describe("projectedForYear", () => {
  it("adds monthly billing for the months left after this one", () => {
    const clients = [client("a", "active", 100)];
    const txns = [txn("a", 1000, "2026-03-01T00:00:00Z")];
    // Oct is the current month: Nov + Dec remain.
    expect(projectedForYear(clients, txns, NOW)).toBe(1000 + 2 * 100);
  });
});

describe("outstanding / collectionRate", () => {
  it("sums open invoices (pending transactions and due subscriptions) and counts stores", () => {
    const result = outstanding(
      {
        clients: [client("a", "active", 299), client("b", "active", 99), client("c", "active", 99)],
        subscriptions: [sub("a", "past_due", "2026-10-03", 299), sub("b", "pending", "2026-10-20", 99), sub("c", "active", "2026-10-01", 0)],
        transactions: [],
      },
      NOW,
    );
    expect(result).toEqual({ amount: 398, unpaidStores: 2, overdueStores: 1 });
  });
  it("is null when nothing was billed", () => {
    expect(collectionRate(0, 0)).toBeNull();
    expect(collectionRate(300, 100)).toBe(75);
  });
});

describe("store status", () => {
  it("maps lifecycle", () => {
    expect(storeLifecycle(client("a", "active", 0)).label).toBe("Live");
    expect(storeLifecycle(client("a", "suspended", 0)).tone).toBe("danger");
  });
  it("derives overdue with the suspension date from the grace period", () => {
    const state = paymentState(sub("a", "past_due", "2026-10-12", 299), [], 7, NOW);
    expect(state).toMatchObject({ label: "Overdue · 3 days", tone: "danger", detail: "Suspends on 19 Oct" });
  });
  it("shows due dates in the future and paid with the last payment date", () => {
    expect(paymentState(sub("a", "pending", "2026-10-20", 99), [], 3, NOW).label).toBe("Due 20 Oct");
    expect(paymentState(sub("a", "active", "2026-11-02"), [txn("a", 299, "2026-10-02T10:00:00Z")], 3, NOW).label).toBe(
      "Paid · 2 Oct",
    );
  });
});
