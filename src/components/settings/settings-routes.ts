/**
 * Settings routes (04 S-00): the eight sections in menu order, and where the old section URLs go now.
 * Pure, so the redirects are tested without rendering.
 */

export type SettingsSectionKey = "profile" | "team" | "general" | "plans" | "discounts" | "billing" | "ai" | "audit";

/** Menu order (04 S-07 change 1). */
export const SETTINGS_SECTION_KEYS: readonly SettingsSectionKey[] = [
  "profile",
  "team",
  "general",
  "plans",
  "discounts",
  "billing",
  "ai",
  "audit",
];

/** The first section; `/settings` opens it from 768px up. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionKey = "profile";

/** Old section → new URL (04 S-00 "Redirects"). */
const LEGACY_SECTIONS: Record<string, string> = {
  "payment-gateway": "/settings/billing#provider",
  "billing-rules": "/settings/billing",
  health: "/settings/general",
  shortcuts: "/settings/general#shortcuts",
};

export function isSettingsSection(value: string | undefined): value is SettingsSectionKey {
  return value != null && (SETTINGS_SECTION_KEYS as readonly string[]).includes(value);
}

/**
 * Where `/settings/:section` should go instead, or null when the section is current. Unknown sections go back
 * to `/settings`.
 */
export function settingsRedirect(section: string | undefined): string | null {
  if (section == null || isSettingsSection(section)) return null;
  return LEGACY_SECTIONS[section] ?? "/settings";
}

/** AI card anchors on Settings › ZCOM AI settings (04 S-07g). */
export const AI_SETTINGS_ANCHORS = ["assistant", "spend", "limits", "night", "prices"] as const;

/** `/ai/settings?section=spend` → `/settings/ai#spend` (04 S-00). */
export function aiSettingsRedirect(search: string): string {
  const section = new URLSearchParams(search).get("section");
  return section && (AI_SETTINGS_ANCHORS as readonly string[]).includes(section) ? `/settings/ai#${section}` : "/settings/ai";
}
