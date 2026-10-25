import { describe, expect, it } from "vitest";
import {
  ACTION_PREFIX_TOO_LONG_COPY,
  auditFilterOf,
  auditSearchErrorCopy,
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
