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

  it("adds the server's issues as Setup / Payments rows (round 2 D11)", () => {
    const rows = healthFactorRows(
      ["Account active", "Strong order volume", "Payments healthy"],
      ["Setup 4 of 11", "Payment app Nimbbl is being retired", "22 unpaid orders expired in 30 days"],
    );
    expect(rows.filter((row) => row.area === "Setup")).toEqual([{ area: "Setup", factor: "Setup 4 of 11", tone: "warning" }]);
    expect(rows.filter((row) => row.area === "Payments").map((row) => row.tone)).toEqual(["danger", "danger"]);
    expect(healthFactorRows(["Setup complete"])).toEqual([{ area: "Setup", factor: "Setup complete", tone: "success" }]);
  });
});
