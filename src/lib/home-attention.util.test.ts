import { describe, expect, it } from "vitest";
import {
  bulletStoreLinks,
  knownStoreNames,
  moreCount,
  sortAtRisk,
  summaryState,
  thisMonthCells,
} from "./home-attention.util";
import type { PlatformAttention, PlatformMetric } from "../types/platform-insights";

const metric = (key: string): PlatformMetric => ({
  key,
  label: key,
  unit: "COUNT",
  value: 1,
  previousValue: null,
  changePercent: null,
  status: "OK",
  count: null,
  names: null,
  reason: null,
  fix: null,
  definition: "",
  formula: "",
});

describe("Home (PRD-026 FR-7.1)", () => {
  it("sorts at-risk stores by score and counts the rest", () => {
    const rows = sortAtRisk([
      { tenantId: "a", name: "Asha", slug: "a", score: 1 },
      { tenantId: "b", name: "Bina", slug: "b", score: 5 },
      { tenantId: "c", name: "Chai", slug: "c", score: 5 },
    ]);
    expect(rows.map((r) => r.tenantId)).toEqual(["b", "c", "a"]);
    expect(moreCount(14, 10)).toBe(4);
    expect(moreCount(3, 3)).toBe(0);
  });

  it("leaves out the month's metrics the viewer may not see", () => {
    const cells = thisMonthCells({
      mrr: null,
      collected: null,
      outstanding: null,
      newStoresLive: metric("newStoresLive"),
      churned: metric("churned"),
      aiCostUsd: null,
    });
    expect(cells.map((c) => [c.key, c.label])).toEqual([
      ["newStoresLive", "New stores live"],
      ["churned", "Stores lost"],
    ]);
    expect(thisMonthCells(null)).toEqual([]);
  });

  it("reads the summary: none, nothing today, bullets, an earlier day", () => {
    const now = new Date("2026-11-02T06:00:00Z");
    expect(summaryState(null, now)).toEqual({ kind: "none" });
    expect(summaryState({ date: "2026-11-02", generatedAt: null, bullets: [], items: [] }, now)).toEqual({
      kind: "empty",
      fromDate: null,
    });
    const old = summaryState(
      { date: "2026-11-01", generatedAt: null, bullets: ["x"], items: [{ text: "x", storeIds: ["s1"], metricKeys: [] }] },
      now,
    );
    expect(old.kind).toBe("bullets");
    expect(old.kind === "bullets" && old.fromDate).toBe("2026-11-01");
    const legacy = summaryState({ date: "2026-11-02", generatedAt: null, bullets: ["only text"], items: [] }, now);
    expect(legacy.kind === "bullets" && legacy.items[0].text).toBe("only text");
  });

  it("names a bullet's stores from the lists Home has", () => {
    const attention = {
      moneyDue: { total: 1, storeCount: 1, items: [{ tenantId: "s1", name: "Nahara" }] },
      atRisk: { totalCount: 0, items: [] },
      development: { totalCount: 0, items: [] },
    } as unknown as PlatformAttention;
    const names = knownStoreNames(attention);
    expect(bulletStoreLinks(["s1", "s2", "s1"], names)).toEqual([
      { tenantId: "s1", name: "Nahara" },
      { tenantId: "s2", name: "Open store" },
    ]);
  });
});
