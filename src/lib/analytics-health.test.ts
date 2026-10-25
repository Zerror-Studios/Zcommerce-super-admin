import { describe, expect, it } from "vitest";
import {
  analyticsHealthChip,
  backfillPercent,
  changePercent,
  changePoints,
  errorPreview,
  humanize,
  integrationStatusChip,
  lastDaysRange,
} from "./analytics-health";

describe("analytics health chips", () => {
  it("maps every backend health value to a label and tone", () => {
    expect(analyticsHealthChip("OK")).toEqual({ label: "Synced", tone: "success" });
    expect(analyticsHealthChip("ERROR")).toEqual({ label: "Error", tone: "danger" });
    expect(analyticsHealthChip("QUOTA_PAUSED")).toEqual({ label: "Quota paused", tone: "warning" });
    expect(analyticsHealthChip("BACKFILLING")).toEqual({ label: "Importing history", tone: "info" });
    expect(analyticsHealthChip("NOT_CONNECTED")).toEqual({ label: "Not connected", tone: "neutral" });
  });

  it("treats a missing health as no analytics app and humanises unknown values", () => {
    expect(analyticsHealthChip(null)).toEqual({ label: "No analytics", tone: "neutral" });
    expect(analyticsHealthChip("SOME_NEW_STATE")).toEqual({ label: "Some new state", tone: "neutral" });
  });

  it("maps integration statuses", () => {
    expect(integrationStatusChip("ACTIVE").tone).toBe("success");
    expect(integrationStatusChip("INACTIVE").tone).toBe("neutral");
    expect(integrationStatusChip("ERROR").tone).toBe("danger");
    expect(integrationStatusChip(undefined)).toEqual({ label: "Unknown", tone: "neutral" });
  });

  it("humanises enum values", () => {
    expect(humanize("GA4")).toBe("Ga4");
    expect(humanize("QUOTA_PAUSED")).toBe("Quota paused");
    expect(humanize("")).toBe("");
  });
});

describe("ranges and deltas", () => {
  it("builds an inclusive N-day range ending today", () => {
    const now = new Date(2026, 9, 22, 15, 30);
    const range = lastDaysRange(30, now);
    expect(range.endDate).toEqual(new Date(2026, 9, 22));
    expect(range.startDate).toEqual(new Date(2026, 8, 23));
    expect(lastDaysRange(1, now).startDate).toEqual(new Date(2026, 9, 22));
  });

  it("hides the change when the previous period is zero", () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(10, 0)).toBeNull();
    expect(changePercent(Number.NaN, 5)).toBeNull();
  });

  it("gives conversion deltas in points", () => {
    expect(changePoints(2.5, 2)).toBeCloseTo(0.5, 10);
    expect(changePoints(2, Number.NaN)).toBeNull();
  });
});

describe("formatting", () => {
  it("previews long errors on one line with an ellipsis", () => {
    expect(errorPreview(null)).toBeNull();
    expect(errorPreview("short")).toBe("short");
    expect(errorPreview("a\n  b")).toBe("a b");
    const long = "x".repeat(100);
    const preview = errorPreview(long, 20);
    expect(preview).toHaveLength(20);
    expect(preview?.endsWith("…")).toBe(true);
  });

  it("clamps backfill progress to 0–100 and hides it without a plan", () => {
    expect(backfillPercent(7, 13)).toBeCloseTo((7 / 13) * 100, 10);
    expect(backfillPercent(20, 13)).toBe(100);
    expect(backfillPercent(0, 0)).toBeNull();
  });
});
