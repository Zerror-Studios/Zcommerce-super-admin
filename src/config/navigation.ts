import type { NavItem } from "../components/layout/types";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "../lib/permissions";
import { IconAnalytics, IconHome, IconPayments, IconSettings, IconStore, IconStoreHealth, IconSupport } from "../components/ui/icons";

/**
 * The black menu (docs/design-v2/README.md §3.1, 5 Nov 2026): Home, Stores, Billing, Analytics ▸ (Revenue, Stores,
 * AI usage), then Notifications and Settings at the bottom. Analytics' sub-pages are the existing pages and tabs:
 * Revenue and Stores are /analytics tabs, AI usage is the ZCOM AI page (/ai, its other tabs stay inside it).
 * Analytics Level 1 §3.7 (2026-11-11): the "System" item (store performance) is merged into Stores; platform health
 * is the System health item. Counts: Stores a plain grey total, Billing an orange pill (owed now or due within 7
 * days), Analytics a blue pill (open AI top-up requests); DashboardLayout fills them in.
 *
 * Round 2 §4 (PRD-036 R2-8/R2-9, 2026-11-06): Support ▸ (Tickets, Announcements, Guides & videos) after Billing and
 * System health after Analytics. PRD-049 FR-A33 (2026-11-19) adds Support › Settings and step A3 (2026-11-20) Feature requests. Billing is one page today, so it has no sub-items until §7 adds them.
 */
export const mainNavItems: NavItem[] = [
  { key: "home", label: "Home", to: "/", end: true, icon: IconHome },
  { key: "stores", label: "Stores", to: "/stores", icon: IconStore, countTone: "plain" },
  { key: "subscriptions", label: "Billing", to: "/subscriptions", icon: IconPayments, countTone: "orange" },
  {
    key: "support",
    label: "Support",
    icon: IconSupport,
    children: [
      { to: "/support/tickets", label: "Tickets" },
      // PRD-049 step A3: shown with platform:support:read or platform:feedback:manage.
      { to: "/support/features", label: "Feature requests" },
      { to: "/support/announcements", label: "Announcements" },
      { to: "/support/guides", label: "Guides & videos" },
      // PRD-049 FR-A33: shown only with platform:support:read (`visibleNavItems`).
      { to: "/support/settings", label: "Settings" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: IconAnalytics,
    countTone: "blue",
    children: [
      { to: "/analytics/revenue", label: "Revenue" },
      { to: "/analytics/store-sales", label: "Stores" },
      // PRD-021 FR-6: shown only with platform:ai:read (`visibleNavItems`).
      { to: "/ai", label: "AI usage" },
    ],
  },
  { key: "system-health", label: "System health", to: "/system-health", icon: IconStoreHealth },
];

/** Settings: at the bottom of the menu, after Notifications (v2 §3.1). A single link to the settings shell. */
export const settingsNavItem: NavItem = { key: "settings", label: "Settings", to: "/settings/profile", icon: IconSettings };

/** Settings sections in menu order (04 S-07), for page titles and the command palette. */
export const settingsPages = [
  { label: "Profile & security", to: "/settings/profile" },
  { label: "Team & roles", to: "/settings/team" },
  { label: "General", to: "/settings/general" },
  { label: "Plans & pricing", to: "/settings/plans" },
  { label: "Discounts", to: "/settings/discounts" },
  { label: "Payments & billing rules", to: "/settings/billing" },
  { label: "Zcom AI settings", to: "/settings/ai" },
  { label: "Audit log", to: "/settings/audit" },
];

/** Every page, for page titles and the command palette (settings pages are listed under Settings). */
export const allNavItems: NavItem[] = [
  ...mainNavItems,
  { ...settingsNavItem, children: [...settingsPages, { label: "Settings", to: "/settings" }] },
];

/**
 * Nav entries (by key) and sub-items (by path) a role may not open at all; others show a lock page instead. A list
 * means any one of them is enough.
 */
const NAV_PERMISSIONS: Partial<Record<string, PlatformPermission | PlatformPermission[]>> = {
  ai: PLATFORM_PERMISSIONS.AI_READ,
  "/ai": PLATFORM_PERMISSIONS.AI_READ,
  // PRD-049 FR-A34: the ticket queue and its settings need platform:support:read.
  "/support/tickets": PLATFORM_PERMISSIONS.SUPPORT_READ,
  "/support/settings": PLATFORM_PERMISSIONS.SUPPORT_READ,
  // PRD-049 step A3: the feature board reads with either permission.
  "/support/features": [PLATFORM_PERMISSIONS.SUPPORT_READ, PLATFORM_PERMISSIONS.FEEDBACK_MANAGE],
};

/** `items` without the entries and sub-items the caller's role can't open (PRD-021 FR-6). */
export function visibleNavItems(
  items: NavItem[],
  can: (permission: PlatformPermission) => boolean,
): NavItem[] {
  const allowed = (key: string) => {
    const permission = NAV_PERMISSIONS[key];
    if (!permission) return true;
    return Array.isArray(permission) ? permission.some((one) => can(one)) : can(permission);
  };
  return items
    .filter((item) => allowed(item.key))
    .map((item) => (item.children ? { ...item, children: item.children.filter((child) => allowed(child.to)) } : item));
}
