import { describe, expect, it } from "vitest";
import {
  couponErrorsFromServer,
  couponToDraft,
  defaultCouponExpiry,
  emptyCouponDraft,
  validateCouponDraft,
} from "./coupon-form.util";

describe("coupon form (UX-24)", () => {
  it("builds the coupon from a valid draft, upper-casing the code", () => {
    const result = validateCouponDraft({ ...emptyCouponDraft(), code: " save20 " });
    expect(result.errors).toBeNull();
    expect(result.coupon?.code).toBe("SAVE20");
    expect(result.coupon?.discountValue).toBe(10);
  });

  it("returns field errors instead of a coupon", () => {
    const result = validateCouponDraft({
      ...emptyCouponDraft(),
      code: "",
      discountValue: "120",
      maxRedemptions: "1.5",
    });
    expect(result.coupon).toBeNull();
    expect(result.errors).toMatchObject({
      code: "Enter a code.",
      discountValue: "A percentage can't be more than 100.",
      maxRedemptions: "Enter a whole number above 0.",
    });
  });

  it("puts a duplicate-code CONFLICT on the code field", () => {
    const error = {
      graphQLErrors: [
        { message: "That code already exists", extensions: { code: "CONFLICT", field: "code" } },
      ],
    };
    expect(couponErrorsFromServer(error)).toEqual({ code: "That code already exists" });
  });

  it("puts an unknown field on the form and ignores other codes", () => {
    const badInput = {
      graphQLErrors: [{ message: "Bad", extensions: { code: "BAD_USER_INPUT", field: "x" } }],
    };
    expect(couponErrorsFromServer(badInput)).toEqual({ form: "Bad" });
    expect(
      couponErrorsFromServer({ graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] }),
    ).toBeNull();
    expect(couponErrorsFromServer(new TypeError("Failed to fetch"))).toBeNull();
  });

  it("defaults the expiry 90 days out and round-trips a coupon", () => {
    expect(defaultCouponExpiry(new Date("2026-10-25T10:00:00Z"))).toBe("2027-01-23");
    const draft = couponToDraft({
      id: "c1",
      code: "SAVE",
      discountType: "fixed",
      discountValue: 500,
      appliesTo: "PLUS",
      redemptions: 2,
      maxRedemptions: 10,
      expiresAt: "2026-12-31",
      active: false,
    });
    expect(validateCouponDraft(draft).coupon).toMatchObject({ code: "SAVE", active: false });
  });
});
