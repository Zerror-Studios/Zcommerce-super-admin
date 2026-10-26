/**
 * Platform role → permission map (PRD-005 §3, ADR-001)
 *
 * A mirror of `zcom-backend/packages/core/src/rbac/platform-permissions.ts`,
 * kept byte-for-byte on the permission strings. The backend guard is the
 * real one; this copy only hides or disables actions the role lacks so a
 * READ_ONLY member never sees Suspend, Delete or Record payment.
 */

import type { PlatformRole } from "../types/platform-api";

// ─── Permissions ──────────────────────────────────────────────────────────

export const PLATFORM_PERMISSIONS = {
  TENANTS_READ: "platform:tenants:read",
  TENANTS_MANAGE: "platform:tenants:manage",
  TENANTS_IMPERSONATE: "platform:tenants:impersonate",
  PLANS_READ: "platform:plans:read",
  PLANS_MANAGE: "platform:plans:manage",
  BILLING_READ: "platform:billing:read",
  BILLING_MANAGE: "platform:billing:manage",
  COUPONS_MANAGE: "platform:coupons:manage",
  REPORTS_READ: "platform:reports:read",
  SETTINGS_MANAGE: "platform:settings:manage",
  USERS_MANAGE: "platform:users:manage",
  NOTES_WRITE: "platform:notes:write",
  AUDIT_READ: "platform:audit:read",
  /** PRD-021 FR-6: AI usage, cost, benchmarks and data health */
  AI_READ: "platform:ai:read",
  /** PRD-021 FR-6.4: AI plan limits, top-ups, pause, ai_config */
  AI_MANAGE: "platform:ai:manage",
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

// ─── Roles ────────────────────────────────────────────────────────────────

const ALL_PLATFORM_PERMISSIONS = Object.values(PLATFORM_PERMISSIONS);

const READ_PERMISSIONS = ALL_PLATFORM_PERMISSIONS.filter((permission) =>
  permission.endsWith(":read"),
);

export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly PlatformPermission[]
> = {
  PLATFORM_OWNER: ALL_PLATFORM_PERMISSIONS,
  PLATFORM_ADMIN: ALL_PLATFORM_PERMISSIONS.filter(
    (permission) =>
      permission !== PLATFORM_PERMISSIONS.USERS_MANAGE &&
      permission !== PLATFORM_PERMISSIONS.SETTINGS_MANAGE,
  ),
  BILLING_MANAGER: [
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.BILLING_READ,
    PLATFORM_PERMISSIONS.BILLING_MANAGE,
    PLATFORM_PERMISSIONS.PLANS_READ,
    PLATFORM_PERMISSIONS.COUPONS_MANAGE,
    PLATFORM_PERMISSIONS.REPORTS_READ,
    PLATFORM_PERMISSIONS.AI_READ,
  ],
  SUPPORT_AGENT: [
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE,
    PLATFORM_PERMISSIONS.BILLING_READ,
    PLATFORM_PERMISSIONS.REPORTS_READ,
    PLATFORM_PERMISSIONS.NOTES_WRITE,
  ],
  READ_ONLY: READ_PERMISSIONS,
};

// ─── Checks ───────────────────────────────────────────────────────────────

/** True when `role` holds `permission`; an unknown or missing role holds none. */
export function can(
  role: PlatformRole | null | undefined,
  permission: PlatformPermission,
): boolean {
  if (!role) return false;
  const granted = PLATFORM_ROLE_PERMISSIONS[role];
  return granted ? granted.includes(permission) : false;
}
