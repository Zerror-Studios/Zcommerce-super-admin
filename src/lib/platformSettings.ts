import type { PlatformSettings } from "../types";

/** Defaults shown until `platformSettings` has loaded (PRD-005 FR-7.1). */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  health: {
    expiringWithinDays: 7,
    inactiveAfterDays: 14,
  },
  gracePeriodDays: 3,
  reminders: {
    daysBeforeDue: [7, 3, 1],
    daysAfterDue: [1, 3, 7],
    email: true,
    sms: false,
    whatsapp: false,
  },
};

// The SettingsProvider stores the server's settings here, so every screen
// reads one copy through `loadPlatformSettings()` without learning the API.
let serverSettings: PlatformSettings | null = null;

export function setServerPlatformSettings(settings: PlatformSettings | null): void {
  serverSettings = settings;
}

export function loadPlatformSettings(): PlatformSettings {
  return serverSettings ?? DEFAULT_PLATFORM_SETTINGS;
}

/**
 * PRD-024 FR-1.1 (D-01): the settings forms are editable only once the
 * server copy has loaded. A failed load must never leave the defaults in an
 * enabled form, or Save would overwrite the server with them.
 */
export function isPlatformSettingsLoaded(settings: PlatformSettings | null): settings is PlatformSettings {
  return settings !== null;
}

/** Whether a settings form may be edited and saved (PRD-024 FR-1.1, D-07). */
export function canEditPlatformSettings(input: { loaded: boolean; readOnly: boolean }): boolean {
  return input.loaded && !input.readOnly;
}
