/**
 * Settings › Team & roles › Roles (04 S-07b change 3): what each role can do per area, read from the console's
 * mirror of the backend permission map (lib/permissions.ts, PLATFORM_ROLE_PERMISSIONS; 06 Q13).
 */
import { PLATFORM_PERMISSIONS, PLATFORM_ROLE_PERMISSIONS, type PlatformPermission } from "../../lib/permissions";
import type { PlatformRole } from "../../types/platform-api";

export type RoleAccess = "edit" | "view" | "none";

export const ROLE_ACCESS_LABELS: Record<RoleAccess, string> = {
  edit: "Can edit",
  view: "Can view",
  none: "No access",
};

interface Area {
  key: string;
  label: string;
  /** Any of these grants "Can edit". */
  edit: PlatformPermission[];
  /** Any of these grants "Can view"; empty = every role can view. */
  view: PlatformPermission[] | "everyone";
}

const P = PLATFORM_PERMISSIONS;

export const ROLE_AREAS: Area[] = [
  { key: "stores", label: "Stores and logging in", edit: [P.TENANTS_MANAGE], view: [P.TENANTS_READ] },
  { key: "billing", label: "Subscriptions and billing", edit: [P.BILLING_MANAGE], view: [P.BILLING_READ] },
  { key: "plans", label: "Plans and discounts", edit: [P.PLANS_MANAGE, P.COUPONS_MANAGE], view: [P.PLANS_READ] },
  { key: "ai", label: "ZCOM AI", edit: [P.AI_MANAGE], view: [P.AI_READ] },
  // Every role can open Settings; only settings:manage changes the platform rules.
  { key: "settings", label: "Settings", edit: [P.SETTINGS_MANAGE], view: "everyone" },
  // The member list itself needs users:manage.
  { key: "team", label: "Team", edit: [P.USERS_MANAGE], view: [] },
  { key: "audit", label: "Audit log", edit: [], view: [P.AUDIT_READ] },
];

/** Column order (04 S-07b). */
export const MATRIX_ROLES: PlatformRole[] = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "BILLING_MANAGER", "SUPPORT_AGENT", "READ_ONLY"];

/** One line per role for the tooltip on its column head. */
export const ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "Everything, including the team and platform settings.",
  PLATFORM_ADMIN: "Everything except the team and platform settings.",
  BILLING_MANAGER: "Subscriptions, billing and discounts; sees stores and plans.",
  SUPPORT_AGENT: "Helps stores: logs in to them and adds notes; sees billing.",
  READ_ONLY: "Sees everything it may read; changes nothing.",
};

export function roleAccess(role: PlatformRole, area: Area): RoleAccess {
  const granted = PLATFORM_ROLE_PERMISSIONS[role] ?? [];
  if (area.edit.some((permission) => granted.includes(permission))) return "edit";
  if (area.view === "everyone" || area.view.some((permission) => granted.includes(permission))) return "view";
  return "none";
}
