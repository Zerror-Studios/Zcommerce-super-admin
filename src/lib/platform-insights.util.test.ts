import { describe, expect, it } from "vitest";
import {
  askErrorMessage,
  changeTone,
  coverageText,
  formatMetricValue,
  isRefreshCoolingDown,
  lastUpdatedText,
  lifecycleLabel,
  moneyDueWhen,
  refreshErrorState,
  runStatusNote,
  smallSampleText,
  FIRST_SNAPSHOT_COPY,
} from "./platform-insights.util";

const gqlError = (extensions: Record<string, unknown>) => ({ graphQLErrors: [{ extensions }] });

describe("platform insights (PRD-026 guide)", () => {
  it("formats each unit (§1)", () => {
    expect(formatMetricValue(120000, "CURRENCY")).toBe("₹1,20,000");
    expect(formatMetricValue(12.5, "PERCENT")).toBe("12.5%");
    expect(formatMetricValue(1, "DAYS")).toBe("1 day");
    expect(formatMetricValue(14, "DAYS")).toBe("14 days");
    expect(formatMetricValue(3.21, "USD")).toContain("3.21");
    expect(formatMetricValue(null, "COUNT")).toBe("—");
  });

  it("names a small sample and never computes a rate from count (§1)", () => {
    expect(smallSampleText({ count: 2, names: ["Nahara", "Kesar & Kin"], label: "Churned" })).toBe(
      "2 stores: Nahara, Kesar & Kin",
    );
    expect(smallSampleText({ count: 1, names: null, label: "x" })).toBe("1 store");
  });

  it("shows coverage and lifecycle labels in either case (§1, §7)", () => {
    expect(coverageText({ covered: 12, total: 15 })).toBe("Based on 12 of 15 stores");
    expect(coverageText(null)).toBeNull();
    expect(lifecycleLabel("grace")).toBe("In grace");
    expect(lifecycleLabel("DEVELOPMENT")).toBe("In development");
  });

  it("reads lower-is-better metrics the right way round", () => {
    expect(changeTone({ key: "mrr", changePercent: 5 })).toBe("success");
    expect(changeTone({ key: "churned", changePercent: 5 })).toBe("danger");
    expect(changeTone({ key: "mrr", changePercent: null })).toBe("neutral");
  });

  it("says first run, stale and fresh apart (§1)", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(lastUpdatedText(null, false, now)).toBe(FIRST_SNAPSHOT_COPY);
    expect(lastUpdatedText("2026-11-01T06:00:00Z", true, now)).toBe("Last updated 30 h ago");
    expect(lastUpdatedText("2026-11-02T03:01:00Z", false, now)).toMatch(/^Last updated 2 Nov/);
  });

  it("handles Refresh now's cooldown and failure (§5)", () => {
    const now = new Date("2026-11-02T10:00:00Z");
    expect(isRefreshCoolingDown("2026-11-02T10:30:00Z", now)).toBe(true);
    expect(isRefreshCoolingDown("2026-11-02T09:30:00Z", now)).toBe(false);
    const cooldown = refreshErrorState(
      gqlError({ code: "CONFLICT", reason: "REFRESH_COOLDOWN", refreshAvailableAt: "2026-11-02T10:12:00Z" }),
    );
    expect(cooldown.refreshAvailableAt).toBe("2026-11-02T10:12:00Z");
    expect(cooldown.message).toMatch(/^Refreshed recently/);
    expect(refreshErrorState(gqlError({ code: "CONFLICT", reason: "REFRESH_FAILED" })).refreshAvailableAt).toBeNull();
  });

  it("words money due and the chat's states (§3, §12)", () => {
    expect(moneyDueWhen({ daysOverdue: 3, dueAt: "2026-10-30T00:00:00Z" })).toBe("3 days overdue");
    expect(moneyDueWhen({ daysOverdue: 0, dueAt: "2026-11-05T00:00:00Z" })).toBe("Due on 5 Nov");
    expect(askErrorMessage(gqlError({ code: "CONFLICT", reason: "CONVERSATION_FULL" }))).toMatch(/Start a new/);
    expect(askErrorMessage(gqlError({ code: "PLAN_LIMIT_EXCEEDED", reason: "AI_TOKEN_BUDGET_EXHAUSTED" }))).toMatch(
      /budget/,
    );
    expect(runStatusNote("COMPLETED_PARTIAL", "TIME_LIMIT")).toMatch(/narrower/);
    expect(runStatusNote("FAILED", "RUN_INTERRUPTED")).toMatch(/interrupted/);
    expect(runStatusNote("COMPLETED")).toBeNull();
  });
});
