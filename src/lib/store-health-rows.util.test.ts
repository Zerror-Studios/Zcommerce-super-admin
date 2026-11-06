import { describe, expect, it } from "vitest";

import { setupFromIssues, storeHealthLine, storeHealthRows, type StoreHealthFacts } from "./store-health-rows.util";

const now = new Date("2026-11-06T10:00:00");
const facts = (over: Partial<StoreHealthFacts> = {}): StoreHealthFacts => ({
  setup: { done: 11, total: 11 },
  measured: true,
  orders30d: 190,
  ordersTone: "success",
  logins30d: 6,
  staffCount: 7,
  paymentFailures7d: 0,
  unpaidExpiries30d: 0,
  paymentIssues: [],
  analyticsLastSync: "2026-11-05T08:00:00",
  now,
  ...over,
});

describe("store health rows (round 2 §6.3, D11)", () => {
  it("is all Good for a healthy store", () => {
    const rows = storeHealthRows(facts());
    expect(rows.map((row) => row.word)).toEqual(["Good", "Good", "Good", "Good", "Good"]);
    expect(rows[1].detail).toBe("190 orders · 30d");
    expect(storeHealthLine("Healthy", rows)).toBe("Healthy. Everything checked is good.");
  });

  it("never reads all Good with setup 4 of 11 and a retiring payment app", () => {
    const rows = storeHealthRows(
      facts({
        setup: { done: 4, total: 11 },
        paymentFailures7d: 99,
        paymentIssues: ["Setup 4 of 11", "Payment app Nimbbl is being retired"],
        analyticsLastSync: "2026-10-27T08:00:00",
      }),
    );
    expect(rows[0]).toMatchObject({ word: "Failing", detail: "4 of 11" });
    expect(rows[3]).toMatchObject({ word: "Failing", detail: "99 failed · 7d · Payment app Nimbbl is being retired" });
    expect(rows[4]).toMatchObject({ word: "Stale", detail: "Last sync 27 Oct" });
    expect(storeHealthLine("Healthy", rows)).toBe("Healthy, with three things slipping");
  });

  it("reads setup from the server's issues", () => {
    expect(setupFromIssues(["Payment app retiring", "Setup 4 of 11"])).toEqual({ done: 4, total: 11 });
    expect(setupFromIssues([])).toBeNull();
  });

  it("says when nothing was collected", () => {
    const rows = storeHealthRows(facts({ measured: false, logins30d: null, paymentFailures7d: null, unpaidExpiries30d: null, analyticsLastSync: undefined, setup: null }));
    expect(rows.every((row) => row.word === "No data")).toBe(true);
  });
});
