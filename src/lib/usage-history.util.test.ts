import { describe, expect, it } from "vitest";
import { monthlyUsage, performanceSeries, type UsageSnapshot } from "./usage-history.util";

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

describe("performanceSeries (PRD-024 FR-1.12)", () => {
  it("charts each month's last snapshot, oldest first", () => {
    const points = performanceSeries([
      { ...snapshot("2026-10-25T00:00:00.000Z", 1), revenue30d: 900, orders30d: 9 },
      { ...snapshot("2026-09-30T00:00:00.000Z", 1), revenue30d: 500, orders30d: 5 },
    ]);
    expect(points.map((point) => [point.month, point.revenue30d, point.orders30d])).toEqual([
      ["2026-09", 500, 5],
      ["2026-10", 900, 9],
    ]);
  });
});
