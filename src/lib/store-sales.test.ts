import { describe, expect, it } from "vitest";
import type { PlatformStoreSales } from "../types/platform-api";
import { storesNeedingALook, toStoreSalesView } from "./store-sales";

const rollup: PlatformStoreSales = {
  rangeStart: "2026-09-28",
  rangeEnd: "2026-10-27",
  previousStart: "2026-08-29",
  previousEnd: "2026-09-27",
  totals: [
    { currency: "USD", revenue: 300, orders: 3, previousRevenue: 0, previousOrders: 0, growthPercent: null, stores: 1 },
    { currency: "INR", revenue: 1250, orders: 15, previousRevenue: 1000, previousOrders: 9, growthPercent: 25, stores: 3 },
  ],
  stores: [
    {
      tenantId: "a",
      slug: "a",
      name: "A",
      currency: "INR",
      revenue: 1000,
      orders: 10,
      previousRevenue: 800,
      previousOrders: 8,
      growthPercent: 25,
      averageOrderValue: 100,
    },
    {
      tenantId: "u",
      slug: "u",
      name: "U",
      currency: "USD",
      revenue: 300,
      orders: 3,
      previousRevenue: 0,
      previousOrders: 0,
      growthPercent: null,
      averageOrderValue: 100,
    },
    {
      tenantId: "c",
      slug: "c",
      name: "C",
      currency: "INR",
      revenue: 250,
      orders: 5,
      previousRevenue: 500,
      previousOrders: 1,
      growthPercent: -50,
      averageOrderValue: 50,
    },
    {
      tenantId: "b",
      slug: "b",
      name: "B",
      currency: "INR",
      revenue: 0,
      orders: 0,
      previousRevenue: 0,
      previousOrders: 0,
      growthPercent: null,
      averageOrderValue: null,
    },
  ],
  totalCount: 4,
};

describe("store sales (PRD-024 FR-3.4)", () => {
  it("keeps the server's rows and order, with null growth as no comparison", () => {
    const view = toStoreSalesView(rollup);
    expect(view.rows.map((row) => row.clientId)).toEqual(["a", "u", "c", "b"]);
    expect(view.rows[0]).toMatchObject({ sales: 1000, previousSales: 800, changePercent: 25, averageOrder: 100 });
    expect(view.rows[1].changePercent).toBeNull();
    expect(view.rows[3]).toMatchObject({ averageOrder: null, changePercent: null });
    expect(view.totalCount).toBe(4);
  });

  it("reports totals per currency, largest first, never summed across currencies", () => {
    const view = toStoreSalesView(rollup);
    expect(view.totals.map((total) => total.currency)).toEqual(["INR", "USD"]);
    expect(view.totals[0]).toMatchObject({ sales: 1250, orders: 15, previousSales: 1000, changePercent: 25, stores: 3 });
    expect(view.totals[0].averageOrder).toBeCloseTo(1250 / 15, 5);
    expect(view.totals[1].changePercent).toBeNull();
  });

  it("flags stores with no orders or a sharp drop", () => {
    const flagged = storesNeedingALook(toStoreSalesView(rollup).rows).map((row) => row.clientId);
    expect(flagged).toEqual(["c", "b"]);
  });
});
