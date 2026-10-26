import { describe, expect, it } from "vitest";

import {
  canEditPlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
  isPlatformSettingsLoaded,
} from "./platformSettings";

describe("settings guard (PRD-024 FR-1.1, D-01)", () => {
  it("counts settings as loaded only once the server copy exists", () => {
    expect(isPlatformSettingsLoaded(null)).toBe(false);
    expect(isPlatformSettingsLoaded(DEFAULT_PLATFORM_SETTINGS)).toBe(true);
  });

  it("never lets a form save before the server copy loaded", () => {
    // A failed load keeps `loaded` false: the defaults can't overwrite the server.
    expect(canEditPlatformSettings({ loaded: false, readOnly: false })).toBe(false);
    expect(canEditPlatformSettings({ loaded: true, readOnly: true })).toBe(false);
    expect(canEditPlatformSettings({ loaded: true, readOnly: false })).toBe(true);
  });
});
