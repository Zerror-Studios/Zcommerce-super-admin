import { describe, expect, it } from "vitest";
import { mainNavItems } from "../../config/navigation";
import { STORES_MAX_WINDOW_DAYS, STORES_SUB_TABS, isStoresSubTab } from "./analytics-tab.util";

describe("Analytics Level 1 §3.7 (Super Admin)", () => {
  it("menu: Analytics is Revenue · Stores · AI usage, with no System item", () => {
    const analytics = mainNavItems.find((item) => item.key === "analytics");
    expect(analytics?.children?.map((child) => child.label)).toEqual(["Revenue", "Stores", "AI usage"]);
    expect(analytics?.children?.some((child) => child.to === "/analytics/performance")).toBe(false);
    expect(mainNavItems.some((item) => item.key === "system-health" && item.to === "/system-health")).toBe(true);
  });

  it("Stores sub-tabs: Overview · Top stores · Needs a look, read from ?tab=", () => {
    expect(STORES_SUB_TABS.map((tab) => tab.label)).toEqual(["Overview", "Top stores", "Needs a look"]);
    expect(isStoresSubTab("top")).toBe(true);
    expect(isStoresSubTab("needs-look")).toBe(true);
    expect(isStoresSubTab("performance")).toBe(false);
    expect(isStoresSubTab(null)).toBe(false);
  });

  it("the picker stays inside the window the store queries accept", () => {
    expect(STORES_MAX_WINDOW_DAYS).toBe(366);
  });
});
