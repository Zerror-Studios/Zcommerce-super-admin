import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import { storeSalesByPlan, storeSalesRows, storeSalesSummary } from "./store-sales";

const client = (id: string, plan: Client["plan"], revenue: number, orders30d: number, growthPercent: number): Client =>
  ({ id, storeName: id, ownerEmail: `${id}@x.io`, plan, status: "active", revenue, orders30d, growthPercent }) as Client;

describe("store sales", () => {
  const clients = [
    client("a", "PREMIUM", 1000, 10, 25),
    client("b", "STARTER", 500, 0, -100),
    client("c", "PREMIUM", 250, 5, -50),
  ];

  it("ranks rows by sales and hides unknown change and average order", () => {
    const rows = storeSalesRows(clients);
    expect(rows.map((row) => row.clientId)).toEqual(["a", "b", "c"]);
    expect(rows[0].averageOrder).toBe(100);
    expect(rows[1]).toMatchObject({ averageOrder: null, changePercent: null });
  });

  it("works the previous 30 days back from the growth percent", () => {
    const summary = storeSalesSummary(clients);
    // previous: a 800, b 0 (no previous sales), c 500 → 1300; now 1750
    expect(summary).toMatchObject({ sales: 1750, orders: 15, sellingStores: 2, totalStores: 3 });
    expect(summary.changePercent).toBeCloseTo(((1750 - 1300) / 1300) * 100, 5);
  });

  it("groups by plan with the share of total sales", () => {
    const byPlan = storeSalesByPlan(clients);
    expect(byPlan[0]).toMatchObject({ plan: "PREMIUM", sales: 1250, orders: 15, stores: 2 });
    expect(byPlan[0].sharePercent).toBeCloseTo((1250 / 1750) * 100, 5);
  });
});
