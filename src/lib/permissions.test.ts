import { describe, expect, it } from "vitest";
import { PLATFORM_PERMISSIONS, PLATFORM_ROLE_PERMISSIONS, can } from "./permissions";

describe("platform permissions", () => {
  it("gives the owner everything", () => {
    for (const permission of Object.values(PLATFORM_PERMISSIONS)) {
      expect(can("PLATFORM_OWNER", permission)).toBe(true);
    }
  });

  it("keeps users and settings away from admins", () => {
    expect(can("PLATFORM_ADMIN", PLATFORM_PERMISSIONS.TENANTS_MANAGE)).toBe(true);
    expect(can("PLATFORM_ADMIN", PLATFORM_PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(can("PLATFORM_ADMIN", PLATFORM_PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it("matches the backend matrix for the narrower roles", () => {
    expect(can("BILLING_MANAGER", PLATFORM_PERMISSIONS.BILLING_MANAGE)).toBe(true);
    expect(can("BILLING_MANAGER", PLATFORM_PERMISSIONS.COUPONS_MANAGE)).toBe(true);
    expect(can("BILLING_MANAGER", PLATFORM_PERMISSIONS.TENANTS_MANAGE)).toBe(false);
    expect(can("SUPPORT_AGENT", PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE)).toBe(true);
    expect(can("SUPPORT_AGENT", PLATFORM_PERMISSIONS.NOTES_WRITE)).toBe(true);
    expect(can("SUPPORT_AGENT", PLATFORM_PERMISSIONS.BILLING_MANAGE)).toBe(false);
  });

  it("gives read-only members only the read permissions", () => {
    for (const permission of PLATFORM_ROLE_PERMISSIONS.READ_ONLY) {
      expect(permission.endsWith(":read")).toBe(true);
    }
    expect(can("READ_ONLY", PLATFORM_PERMISSIONS.TENANTS_READ)).toBe(true);
    expect(can("READ_ONLY", PLATFORM_PERMISSIONS.TENANTS_MANAGE)).toBe(false);
    expect(can("READ_ONLY", PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE)).toBe(false);
  });

  it("matches the backend matrix for the AI permissions (PRD-021)", () => {
    expect(can("PLATFORM_ADMIN", PLATFORM_PERMISSIONS.AI_MANAGE)).toBe(true);
    expect(can("BILLING_MANAGER", PLATFORM_PERMISSIONS.AI_READ)).toBe(true);
    expect(can("BILLING_MANAGER", PLATFORM_PERMISSIONS.AI_MANAGE)).toBe(false);
    expect(can("SUPPORT_AGENT", PLATFORM_PERMISSIONS.AI_READ)).toBe(false);
    expect(can("READ_ONLY", PLATFORM_PERMISSIONS.AI_READ)).toBe(true);
    expect(can("READ_ONLY", PLATFORM_PERMISSIONS.AI_MANAGE)).toBe(false);
  });

  it("grants nothing without a role", () => {
    expect(can(null, PLATFORM_PERMISSIONS.TENANTS_READ)).toBe(false);
    expect(can(undefined, PLATFORM_PERMISSIONS.TENANTS_READ)).toBe(false);
  });
});
