import { describe, expect, it } from "vitest";
import { monthlyUsage, type UsageSnapshot } from "./usage-history.util";

const snapshot = (date: string, products: number): UsageSnapshot => ({
  date,
  products,
  orders30d: 0,
  revenue30d: 0,
  storageMb: 0,
  staffCount: 1,
  sessions30d: 0,
});

describe("monthlyUsage (PLT-13)", () => {
  it("keeps the last snapshot of each month, newest month first", () => {
    const rows = monthlyUsage([
      snapshot("2026-10-25T00:00:00.000Z", 40),
      snapshot("2026-10-01T00:00:00.000Z", 30),
      snapshot("2026-09-30T00:00:00.000Z", 25),
      snapshot("2026-09-02T00:00:00.000Z", 20),
      snapshot("not a date", 99),
    ]);
    expect(rows.map((row) => [row.month, row.products])).toEqual([
      ["2026-10", 40],
      ["2026-09", 25],
    ]);
  });

  it("returns nothing for no snapshots", () => {
    expect(monthlyUsage([])).toEqual([]);
  });
});
