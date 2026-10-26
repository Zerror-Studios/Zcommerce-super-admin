import { describe, expect, it } from "vitest";
import type { PlatformPlan } from "../types/platform-api";
import {
  emptyPlanDraft,
  groupPlans,
  isPlanInUse,
  parseNoticeDays,
  planErrorsFromServer,
  planToDraft,
  planVersionLabel,
  replacementOptionsFor,
  toPlanUpdateInput,
  validatePlanDraft,
  versioningNoticeOf,
} from "./plan-catalog.util";

function plan(overrides: Partial<PlatformPlan> = {}): PlatformPlan {
  return {
    id: "p1",
    tenantId: null,
    name: "PREMIUM",
    price: { monthly: 999, yearly: 9990, currency: "INR" },
    limits: {
      maxSkus: 500,
      emailsPerMonth: 0,
      smsPerMonth: 0,
      whatsappPerMonth: 0,
      maxStaffAccounts: 5,
      internationalMarkets: 0,
      developmentHours: 0,
    },
    features: {
      onlineStore: true,
      blogSystem: "STANDARD",
      lookCreation: false,
      analytics: "STANDARD",
      salesChannels: false,
      prioritySupport: "24_HOURS",
      unlimitedWebHosting: true,
      sslCertificate: true,
    },
    isActive: true,
    createdAt: null,
    version: 2,
    status: "ACTIVE",
    isPublic: true,
    displayName: "Premium",
    description: null,
    sortOrder: 0,
    tenantCount: 12,
    subscriberCount: 12,
    pendingCount: 0,
    ...overrides,
  };
}

describe("plan editor draft (PRD-017 FR-4.1)", () => {
  it("round-trips a plan, with 0 limits shown as Unlimited", () => {
    const draft = planToDraft(plan());
    expect(draft.limits.maxSkus).toEqual({ unlimited: false, value: "500" });
    expect(draft.limits.emailsPerMonth).toEqual({ unlimited: true, value: "" });
    const result = validatePlanDraft(draft);
    expect(result.errors).toBeNull();
    expect(result.input?.limits.emailsPerMonth).toBe(0);
    expect(result.input?.limits.maxSkus).toBe(500);
  });

  it("returns field errors keyed like the server's extensions.field", () => {
    const result = validatePlanDraft({
      ...emptyPlanDraft(),
      priceMonthly: "-1",
      limits: {
        ...emptyPlanDraft().limits,
        maxSkus: { unlimited: false, value: "0" },
      },
    });
    expect(result.input).toBeNull();
    expect(result.errors).toMatchObject({
      displayName: "Enter the name stores see.",
      "price.monthly": "Enter 0 or more.",
      "price.yearly": "Enter 0 or more.",
      "limits.maxSkus": "Enter a whole number above 0, or Unlimited.",
    });
  });

  it("never makes a custom plan public", () => {
    const draft = { ...emptyPlanDraft("t1"), isPublic: true };
    const result = validatePlanDraft({
      ...draft,
      displayName: "Acme special",
      priceMonthly: "500",
      priceYearly: "5000",
    });
    expect(result.input?.tenantId).toBe("t1");
    expect(result.input?.isPublic).toBe(false);
  });
});

describe("plan updates and the versioning notice (PRD-017 FR-1.4, FR-7.3)", () => {
  it("sends nothing when nothing changed", () => {
    const current = plan();
    const input = validatePlanDraft(planToDraft(current)).input!;
    expect(toPlanUpdateInput(current, input)).toBeNull();
  });

  it("sends display fields alone when only they change", () => {
    const current = plan();
    const input = validatePlanDraft({
      ...planToDraft(current),
      displayName: "Premium (new)",
    }).input!;
    expect(toPlanUpdateInput(current, input)).toEqual({
      displayName: "Premium (new)",
    });
  });

  it("sends price, limits and features together on a commercial change", () => {
    const current = plan();
    const input = validatePlanDraft({
      ...planToDraft(current),
      priceMonthly: "1099",
    }).input!;
    const patch = toPlanUpdateInput(current, input);
    expect(patch?.price).toEqual({ monthly: 1099, yearly: 9990 });
    expect(patch?.limits).toBeDefined();
    expect(patch?.features).toBeDefined();
  });

  it("says the next version and the store count for a plan in use", () => {
    expect(isPlanInUse(plan())).toBe(true);
    expect(versioningNoticeOf(plan())).toBe(
      "Price, limits and features are locked while stores use this plan. " +
        "Saving a change to them creates version 3. The 12 stores on " +
        "version 2 keep their price until you migrate them.",
    );
  });

  it("counts a plan that is only pending as in use, and an unused one not", () => {
    expect(isPlanInUse(plan({ tenantCount: 0, pendingCount: 1 }))).toBe(true);
    expect(versioningNoticeOf(plan({ tenantCount: 0, pendingCount: 0 }))).toBeNull();
  });
});

describe("plan lists (PRD-017 FR-4.1)", () => {
  it("groups global plans first, then custom plans per store", () => {
    const groups = groupPlans(
      [
        plan({ id: "c1", tenantId: "t1", name: "STARTER" }),
        plan({ id: "g2", name: "PLUS" }),
        plan({ id: "g1", name: "STARTER" }),
        plan({ id: "g0", name: "STARTER", version: 3 }),
      ],
      (id) => (id === "t1" ? "Acme" : id),
    );
    expect(groups.map((group) => group.title)).toEqual([
      "Global plans",
      "Custom plans · Acme",
    ]);
    expect(groups[0].plans.map((row) => row.id)).toEqual(["g0", "g1", "g2"]);
  });

  it("offers only ACTIVE plans in the same scope as replacements", () => {
    const current = plan({ id: "a" });
    const options = replacementOptionsFor(current, [
      current,
      plan({ id: "b" }),
      plan({ id: "c", status: "LEGACY" }),
      plan({ id: "d", tenantId: "t1" }),
    ]);
    expect(options.map((row) => row.id)).toEqual(["b"]);
  });

  it("labels a version", () => {
    expect(planVersionLabel(plan())).toBe("Premium v2");
  });

  it("reads notice days from 0 to 365", () => {
    expect(parseNoticeDays("30")).toBe(30);
    expect(parseNoticeDays("0")).toBe(0);
    expect(parseNoticeDays("366")).toBeNull();
    expect(parseNoticeDays("1.5")).toBeNull();
    expect(parseNoticeDays("")).toBeNull();
  });
});

describe("plan server errors", () => {
  it("puts a known reason's copy on the field", () => {
    const errors = planErrorsFromServer({
      graphQLErrors: [
        {
          message: "In use",
          extensions: { code: "CONFLICT", reason: "PLAN_IN_USE" },
        },
      ],
    });
    expect(errors?.form).toMatch(/Pick a replacement/);
  });

  it("puts a validation message on extensions.field", () => {
    const errors = planErrorsFromServer({
      graphQLErrors: [
        {
          message: "Bad price",
          extensions: { code: "BAD_USER_INPUT", field: "price.yearly" },
        },
      ],
    });
    expect(errors).toEqual({ "price.yearly": "Bad price" });
  });

  it("returns null for anything else", () => {
    expect(
      planErrorsFromServer({ graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] }),
    ).toBeNull();
  });
});
