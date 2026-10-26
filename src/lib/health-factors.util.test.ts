import { describe, expect, it } from "vitest";
import { healthFactorRows } from "./health-factors.util";

describe("healthFactorRows", () => {
  it("maps each server factor to its area and tone, in area order", () => {
    const rows = healthFactorRows([
      "Quiet lately",
      "Payments healthy",
      "Account active",
      "Low order volume",
      "Strong growth",
    ]);
    expect(rows.map((row) => row.area)).toEqual(["Account", "Orders", "Growth", "Billing", "Activity"]);
    expect(rows.map((row) => row.tone)).toEqual(["success", "warning", "success", "success", "warning"]);
  });

  it("marks problems as danger", () => {
    const rows = healthFactorRows(["Account suspended", "Payment issues", "Inactive store"]);
    expect(rows.every((row) => row.tone === "danger")).toBe(true);
  });

  it("keeps unknown factors as neutral Other rows, last", () => {
    const rows = healthFactorRows(["Not scored yet", "On trial"]);
    expect(rows).toEqual([
      { area: "Account", factor: "On trial", tone: "info" },
      { area: "Other", factor: "Not scored yet", tone: "neutral" },
    ]);
  });
});
