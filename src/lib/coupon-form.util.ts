/**
 * Create and edit discount form rules (PRD-014 UX-24, PLT-13)
 *
 * The form validates locally, then waits for the server: the modal closes
 * and the success toast shows only after the mutation answers. A server
 * `CONFLICT` (duplicate code) or `BAD_USER_INPUT` lands on the field named
 * in `extensions.field`, and the form keeps what the operator typed.
 */

import type { Coupon, PlanName } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────

/** A new code expires this many days from today unless changed. */
export const DEFAULT_COUPON_VALIDITY_DAYS = 90;

const MS_PER_DAY = 86_400_000;

/** Server error codes that carry a message the form shows on a field. */
const FORM_ERROR_CODES = new Set(["CONFLICT", "BAD_USER_INPUT"]);

// ─── Types ────────────────────────────────────────────────────────────────

export type CouponField =
  | "code"
  | "discountType"
  | "discountValue"
  | "appliesTo"
  | "maxRedemptions"
  | "expiresAt";

/** Field errors; `form` holds one that belongs to no single field. */
export type CouponFormErrors = Partial<Record<CouponField | "form", string>>;

/** What the inputs hold (numbers as typed). */
export interface CouponDraft {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  appliesTo: PlanName | "All";
  maxRedemptions: string;
  expiresAt: string;
  active: boolean;
}

/** A coupon ready to send; the server assigns the id and counts uses. */
export type CouponWrite = Omit<Coupon, "id" | "redemptions">;

const COUPON_FIELDS: readonly CouponField[] = [
  "code",
  "discountType",
  "discountValue",
  "appliesTo",
  "maxRedemptions",
  "expiresAt",
];

// ─── Draft ────────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` for a date `days` after `now` (UTC calendar day). */
export function defaultCouponExpiry(
  now: Date = new Date(),
  days: number = DEFAULT_COUPON_VALIDITY_DAYS,
): string {
  return new Date(now.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function emptyCouponDraft(now: Date = new Date()): CouponDraft {
  return {
    code: "",
    discountType: "percent",
    discountValue: "10",
    appliesTo: "All",
    maxRedemptions: "100",
    expiresAt: defaultCouponExpiry(now),
    active: true,
  };
}

export function couponToDraft(coupon: Coupon): CouponDraft {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    appliesTo: coupon.appliesTo,
    maxRedemptions: String(coupon.maxRedemptions),
    expiresAt: coupon.expiresAt.slice(0, 10),
    active: coupon.active,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────

/** The coupon to send, or the field errors that stop it. */
export function validateCouponDraft(
  draft: CouponDraft,
): { coupon: CouponWrite; errors: null } | { coupon: null; errors: CouponFormErrors } {
  const errors: CouponFormErrors = {};
  const code = draft.code.trim().toUpperCase();
  const value = Number(draft.discountValue);
  const max = Number(draft.maxRedemptions);

  if (!code) errors.code = "Enter a code.";
  if (!draft.discountValue.trim() || !Number.isFinite(value) || value <= 0) {
    errors.discountValue = "Enter a discount above 0.";
  } else if (draft.discountType === "percent" && value > 100) {
    errors.discountValue = "A percentage can't be more than 100.";
  }
  if (!draft.maxRedemptions.trim() || !Number.isInteger(max) || max <= 0) {
    errors.maxRedemptions = "Enter a whole number above 0.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiresAt)) {
    errors.expiresAt = "Pick an expiry date.";
  }

  if (Object.keys(errors).length > 0) return { coupon: null, errors };
  return {
    coupon: {
      code,
      discountType: draft.discountType,
      discountValue: value,
      appliesTo: draft.appliesTo,
      maxRedemptions: max,
      expiresAt: draft.expiresAt,
      active: draft.active,
    },
    errors: null,
  };
}

// ─── Server errors ────────────────────────────────────────────────────────

/**
 * Form errors for a failed create or update: `CONFLICT` / `BAD_USER_INPUT`
 * on `extensions.field` (or `form`). `null` means "not a form error"; the
 * caller shows the usual toast and still keeps the form open.
 */
export function couponErrorsFromServer(error: unknown): CouponFormErrors | null {
  const first = (
    error as {
      graphQLErrors?: Array<{ message?: string; extensions?: Record<string, unknown> }>;
    }
  )?.graphQLErrors?.[0];
  const code = String(first?.extensions?.code ?? "");
  if (!FORM_ERROR_CODES.has(code)) return null;
  const message = first?.message || "Check this value.";
  const field = String(first?.extensions?.field ?? "");
  const key = (COUPON_FIELDS as readonly string[]).includes(field)
    ? (field as CouponField)
    : "form";
  return { [key]: message };
}
