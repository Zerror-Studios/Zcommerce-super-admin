import { describe, expect, it } from "vitest";
import {
  ACTION_PREFIX_TOO_LONG_COPY,
  auditFilterOf,
  auditSearchErrorCopy,
  nextActivityLimit,
  tenantActivityFilter,
} from "./audit-filter.util";

describe("audit log search (PRD-014 close-out)", () => {
  it("sends the trimmed search as a prefix", () => {
    expect(auditFilterOf("  coupon. ")).toEqual({ actionPrefix: "coupon." });
  });

  it("sends no filter for an empty search", () => {
    expect(auditFilterOf("   ")).toEqual({});
  });

  it("maps a refused long prefix to inline copy", () => {
    const error = {
      graphQLErrors: [
        { extensions: { code: "BAD_USER_INPUT", reason: "ACTION_PREFIX_TOO_LONG" } },
      ],
    };
    expect(auditSearchErrorCopy(error)).toBe(ACTION_PREFIX_TOO_LONG_COPY);
  });

  it("leaves every other failure to the error state", () => {
    expect(auditSearchErrorCopy(new Error("network"))).toBeNull();
    expect(
      auditSearchErrorCopy({ graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] }),
    ).toBeNull();
  });
});

describe("store activity (PRD-024 FR-1.12)", () => {
  it("filters the audit log on the store as target", () => {
    expect(tenantActivityFilter("t-1")).toEqual({ targetId: "t-1" });
  });

  it("loads 20 more rows at a time, never past the server's cap", () => {
    expect(nextActivityLimit(20)).toBe(40);
    expect(nextActivityLimit(90)).toBe(100);
  });
});
