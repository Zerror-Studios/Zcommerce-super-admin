/**
 * Create and edit discount form rules (PRD-014 UX-24, PLT-13)
 *
 * The form validates locally, then waits for the server: the modal closes
 * and the success toast shows only after the mutation answers. A server
 * `CONFLICT` (duplicate code) or `BAD_USER_INPUT` lands on the field named
 * in `extensions.field`, and the form keeps what the operator typed.
 */

import type { Coupon, PlanName } from "../types";
import type { PlatformPlan } from "../types/platform-api";
import { planVersionLabel } from "./plan-catalog.util";

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
  | "appliesToPlanIds"
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
  /** PRD-017 FR-4.4: plan versions by id; empty = the tier above applies. */
  appliesToPlanIds: string[];
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
  "appliesToPlanIds",
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
    appliesToPlanIds: [],
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
    appliesToPlanIds: [...(coupon.appliesToPlanIds ?? [])],
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
      // Always sent, so an emptied list goes back to the tier rule
      appliesToPlanIds: [...new Set(draft.appliesToPlanIds)],
      maxRedemptions: max,
      expiresAt: draft.expiresAt,
      active: draft.active,
    },
    errors: null,
  };
}

// ─── Plan scope (PRD-017 FR-4.4) ──────────────────────────────────────────

/**
 * Plans a coupon can be limited to: every version (ACTIVE, LEGACY and
 * archived) and every store's custom plan, global plans first, then by
 * tier name and version, newest version first.
 */
export function couponPlanOptions(
  plans: readonly PlatformPlan[],
): Array<{ id: string; label: string }> {
  return [...plans]
    .sort((a, b) => {
      const scope = Number(!!a.tenantId) - Number(!!b.tenantId);
      if (scope !== 0) return scope;
      const name = a.name.localeCompare(b.name);
      if (name !== 0) return name;
      return (b.version ?? 1) - (a.version ?? 1);
    })
    .map((plan) => ({
      id: plan.id,
      label:
        `${planVersionLabel(plan)}` +
        `${plan.tenantId ? " (custom)" : ""}` +
        `${plan.status && plan.status !== "ACTIVE" ? ` · ${plan.status.toLowerCase()}` : ""}`,
    }));
}

/**
 * The "Applies to" text: the picked plan versions when the coupon lists
 * any (they win on the server), else the tier rule.
 */
export function couponScopeLabel(
  coupon: Pick<Coupon, "appliesTo" | "appliesToPlanIds">,
  plans: readonly PlatformPlan[],
  tierLabel: (tier: PlanName) => string,
): string {
  const ids = coupon.appliesToPlanIds ?? [];
  if (ids.length === 0) {
    return coupon.appliesTo === "All" ? "All plans" : tierLabel(coupon.appliesTo);
  }
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const labels = ids.map((id) => {
    const plan = byId.get(id);
    return plan ? planVersionLabel(plan) : "Unknown plan";
  });
  return labels.length <= 2
    ? labels.join(", ")
    : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
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
