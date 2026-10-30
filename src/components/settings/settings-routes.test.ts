import { describe, expect, it } from "vitest";
import { SETTINGS_SECTION_KEYS, aiSettingsRedirect, settingsRedirect } from "./settings-routes";

describe("settings routes (04 S-00)", () => {
  it("lists the eight sections in menu order", () => {
    expect(SETTINGS_SECTION_KEYS).toEqual(["profile", "team", "general", "plans", "discounts", "billing", "ai", "audit"]);
  });

  it("keeps current sections and redirects the old ones", () => {
    expect(settingsRedirect("profile")).toBeNull();
    expect(settingsRedirect(undefined)).toBeNull();
    expect(settingsRedirect("payment-gateway")).toBe("/settings/billing#provider");
    expect(settingsRedirect("billing-rules")).toBe("/settings/billing");
    expect(settingsRedirect("health")).toBe("/settings/general");
    expect(settingsRedirect("shortcuts")).toBe("/settings/general#shortcuts");
    expect(settingsRedirect("account")).toBe("/settings");
  });

  it("sends /ai/settings to Settings › ZCOM AI settings with the section as the anchor", () => {
    expect(aiSettingsRedirect("")).toBe("/settings/ai");
    expect(aiSettingsRedirect("?section=spend")).toBe("/settings/ai#spend");
    expect(aiSettingsRedirect("?section=nope")).toBe("/settings/ai");
  });
});
