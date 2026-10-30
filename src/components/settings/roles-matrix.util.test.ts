import { describe, expect, it } from "vitest";
import { ROLE_AREAS, roleAccess } from "./roles-matrix.util";

const area = (key: string) => ROLE_AREAS.find((entry) => entry.key === key)!;

describe("roles matrix (04 S-07b)", () => {
  it("reads the permission map", () => {
    expect(roleAccess("PLATFORM_OWNER", area("team"))).toBe("edit");
    expect(roleAccess("PLATFORM_ADMIN", area("team"))).toBe("none");
    expect(roleAccess("PLATFORM_ADMIN", area("settings"))).toBe("view");
    expect(roleAccess("BILLING_MANAGER", area("plans"))).toBe("edit");
    expect(roleAccess("SUPPORT_AGENT", area("billing"))).toBe("view");
    expect(roleAccess("SUPPORT_AGENT", area("audit"))).toBe("none");
    expect(roleAccess("READ_ONLY", area("audit"))).toBe("view");
    expect(roleAccess("READ_ONLY", area("stores"))).toBe("view");
  });
});
