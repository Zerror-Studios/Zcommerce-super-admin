import { describe, expect, it } from "vitest";
import type { PlatformMetric } from "../../../types/platform-insights";
import {
  chunkCells,
  cohortMonthLabel,
  cohortRows,
  isSnapshotTab,
  isTabAvailable,
  itemDisplay,
  listValueText,
  mrrMovementRows,
  splitMetrics,
  tabMetrics,
} from "./snapshot-tabs.util";

const metric = (fields: Partial<PlatformMetric>): PlatformMetric => ({
  key: "k",
  label: "K",
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
  ...fields,
});

describe("snapshot tabs (PRD-026 FR-7.3)", () => {
  it("knows its tab keys", () => {
    expect(isSnapshotTab("money")).toBe(true);
    expect(isSnapshotTab("revenue")).toBe(false);
  });

  it("shows a tab only when its section came back (guide §2)", () => {
    const snapshot = { sections: [{ key: "RETENTION", metrics: [] }, { key: "PORTFOLIO", metrics: [] }] };
    expect(isTabAvailable(snapshot, "retention")).toBe(true);
    expect(isTabAvailable(snapshot, "money")).toBe(false);
    expect(isTabAvailable(snapshot, "ai-cost")).toBe(false);
    // Before the first snapshot every tab shows (it says when the snapshot runs)
    expect(isTabAvailable(null, "money")).toBe(true);
  });

  it("adds the portfolio pair to Retention, once", () => {
    const snapshot = {
      sections: [
        { key: "RETENTION", metrics: [metric({ key: "churned" })] },
        { key: "PORTFOLIO", metrics: [metric({ key: "newStoresLive" }), metric({ key: "developmentPipeline" }), metric({ key: "activeStores" })] },
      ],
    };
    expect(tabMetrics(snapshot, "retention").map((m) => m.key)).toEqual(["churned", "newStoresLive", "developmentPipeline"]);
  });

  it("splits cells from breakdowns, keeping small samples and figures as cells", () => {
    const { cells, breakdowns } = splitMetrics([
      metric({ key: "mrr" }),
      metric({ key: "storesByPlan", value: null, items: [{ label: "Pro", value: 3, total: null, tenantId: null, values: null }] }),
      metric({ key: "aiCostUsd", value: 12, items: [{ label: "A", value: 2, total: null, tenantId: "t1", values: null }] }),
      metric({ key: "retentionBands", status: "SMALL_SAMPLE", value: null, items: [{ label: "3 months", value: 2, total: 3, tenantId: null, values: null }] }),
      metric({ key: "uptimePct", status: "UNAVAILABLE", value: null, items: [] }),
    ]);
    expect(cells.map((m) => m.key)).toEqual(["mrr", "aiCostUsd", "retentionBands", "uptimePct"]);
    expect(breakdowns.map((m) => m.key)).toEqual(["storesByPlan", "aiCostUsd", "retentionBands"]);
    expect(chunkCells([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
  });

  it("shows a base as 'N of M', never a computed rate", () => {
    expect(itemDisplay({ label: "3 months", value: 5, total: 7, tenantId: null, values: null }, "COUNT")).toBe("5 of 7");
    expect(itemDisplay({ label: "A", value: 1500, total: null, tenantId: null, values: null }, "CURRENCY")).toBe("₹1,500");
  });

  it("signs the MRR movement and reads cohorts (null = not reached)", () => {
    const rows = mrrMovementRows(
      metric({
        key: "netNewMrr",
        items: [
          { label: "New", value: 5000, total: null, tenantId: null, values: null },
          { label: "Churned", value: -2000, total: null, tenantId: null, values: null },
        ],
      }),
    );
    expect(rows.map((row) => row.direction)).toEqual(["up", "down"]);
    const cohorts = cohortRows(
      metric({
        key: "tenureCohorts",
        items: [{ label: "2026-08", value: 4, total: null, tenantId: null, values: [{ key: "m1", value: 4 }, { key: "m3", value: null }] }],
      }),
    );
    expect(cohorts[0]).toEqual({ label: "2026-08", stores: 4, cells: [4, null, null, null] });
    expect(cohortMonthLabel("2026-08")).toBe("Aug 2026");
  });

  it("reads list values by list", () => {
    expect(listValueText(25000, "currency")).toBe("₹25,000");
    expect(listValueText(-34.5, "percent-change")).toBe("−34.5%");
    expect(listValueText(40, "percent-change")).toBe("+40%");
    expect(listValueText(null, "percent-change")).toBe("—");
  });
});
