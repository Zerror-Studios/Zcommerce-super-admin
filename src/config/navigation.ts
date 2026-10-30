import type { NavItem } from "../components/layout/types";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "../lib/permissions";
import { IconAnalytics, IconAi, IconHome, IconPayments, IconSettings, IconStore } from "../components/ui/icons";

/**
 * The black menu (04 S-00): six items, no sub-items. Subscriptions, Analytics and ZCOM AI are single pages with
 * tabs inside; Payment reminders merged into Subscriptions (its rules are in Settings › Payments & billing rules).
 * Counts: Stores a plain grey total, Subscriptions an orange pill (owed now or due within 7 days), ZCOM AI a blue
 * pill (open top-up requests); DashboardLayout fills them in.
 */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "stores", label: "Stores", to: "/stores", icon: IconStore, countTone: "plain" },
  { key: "subscriptions", label: "Subscriptions", to: "/subscriptions", icon: IconPayments, countTone: "orange" },
  { key: "analytics", label: "Analytics", to: "/analytics/revenue", icon: IconAnalytics },
  // PRD-021 FR-6: shown only with platform:ai:read (`visibleNavItems`).
  { key: "ai", label: "ZCOM AI", to: "/ai", icon: IconAi, countTone: "blue" },
  // A single link: /settings is the settings shell (pages/Settings.tsx), like the store admin.
  { key: "settings", label: "Settings", to: "/settings/profile", icon: IconSettings },
];

/** Settings sections in menu order (04 S-07), for page titles and the command palette. */
export const settingsPages = [
  { label: "Profile & security", to: "/settings/profile" },
  { label: "Team & roles", to: "/settings/team" },
  { label: "General", to: "/settings/general" },
  { label: "Plans & pricing", to: "/settings/plans" },
  { label: "Discounts", to: "/settings/discounts" },
  { label: "Payments & billing rules", to: "/settings/billing" },
  { label: "ZCOM AI settings", to: "/settings/ai" },
  { label: "Audit log", to: "/settings/audit" },
];

/** Every page, for page titles and the command palette (settings pages are listed under Settings). */
export const allNavItems: NavItem[] = mainNavItems.map((item) =>
  item.key === "settings" ? { ...item, children: [...settingsPages, { label: "Settings", to: "/settings" }] } : item,
);

/** Nav entries a role may not open at all; others show a lock page instead. */
const NAV_PERMISSIONS: Partial<Record<string, PlatformPermission>> = {
  ai: PLATFORM_PERMISSIONS.AI_READ,
};

/** `items` without the entries the caller's role can't open (PRD-021 FR-6). */
export function visibleNavItems(
  items: NavItem[],
  can: (permission: PlatformPermission) => boolean,
): NavItem[] {
  return items.filter((item) => {
    const permission = NAV_PERMISSIONS[item.key];
    return !permission || can(permission);
  });
}
