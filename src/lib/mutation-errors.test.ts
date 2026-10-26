import { describe, expect, it } from "vitest";
import { billingFailureCopy } from "./mutation-errors";

function failure(code: string, reason?: string, message = "Server message") {
  return { message, graphQLErrors: [{ message, extensions: { code, reason } }] };
}

describe("billing failure copy (PRD-016 / PRD-017 reasons)", () => {
  it("explains PAYMENT_REQUIRED as pay-or-override on billing screens", () => {
    expect(billingFailureCopy(failure("FORBIDDEN", "PAYMENT_REQUIRED"))).toMatch(
      /override and a reason/,
    );
  });

  it("uses the console's copy for proration and review reasons", () => {
    expect(billingFailureCopy(failure("CONFLICT", "OPEN_INVOICE"))).toMatch(/open invoice/);
    expect(billingFailureCopy(failure("CONFLICT", "PAYMENT_ALREADY_RESOLVED"))).toMatch(
      /already resolved/,
    );
    expect(billingFailureCopy(failure("CONFLICT", "PLAN_IN_USE"))).toMatch(/replacement/);
  });

  it("falls back to the usual rules", () => {
    expect(billingFailureCopy(failure("BAD_USER_INPUT"))).toBe("Server message");
    expect(billingFailureCopy(failure("FORBIDDEN"))).toBeNull();
  });
});
