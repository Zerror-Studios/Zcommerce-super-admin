import { describe, expect, it } from "vitest";
import type { PlatformInvoice, PlatformPlan } from "../types/platform-api";
import {
  billingStateView,
  canToggleDunning,
  dunningToDraft,
  invoiceReasonLabel,
  invoiceStatusView,
  isAwaitingReview,
  openInvoicesForApply,
  overLimitLabels,
  parseAmount,
  planChangeOptions,
  planChangeVariables,
  previewRowsOf,
  reactivationNeedsOverride,
  reactivationVariables,
  refundFormError,
  resolveFlaggedVariables,
  toInvoiceActionRow,
  validateDunningDraft,
} from "./platform-billing.util";

const DUNNING = {
  enabled: false,
  pauseOrdersAfterDays: 7,
  suspendAfterDays: 21,
  trialSuspendAfterDays: 14,
};

function invoice(overrides: Partial<PlatformInvoice> = {}): PlatformInvoice {
  return {
    id: "i1",
    tenantId: "t1",
    tenantName: "Acme",
    subscriptionId: "s1",
    number: "ZC-2026-000001",
    planName: "PREMIUM",
    billingCycle: "MONTHLY",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-11-01T00:00:00.000Z",
    amount: 999,
    discount: 0,
    tax: 0,
    total: 999,
    currency: "INR",
    status: "ISSUED",
    issuedAt: "2026-10-01T00:00:00.000Z",
    dueAt: "2026-10-08T00:00:00.000Z",
    paidAt: null,
    couponCode: null,
    voidReason: null,
    billingReason: "PERIOD",
    amountPaid: 0,
    creditApplied: 0,
    amountDue: 999,
    restart: false,
    ...overrides,
  };
}

function plan(id: string, overrides: Partial<PlatformPlan> = {}): PlatformPlan {
  return {
    id,
    tenantId: null,
    name: "PREMIUM",
    price: { monthly: 999, yearly: 9990, currency: "INR" },
    limits: {
      maxSkus: 0,
      emailsPerMonth: 0,
      smsPerMonth: 0,
      whatsappPerMonth: 0,
      maxStaffAccounts: 0,
      internationalMarkets: 0,
      developmentHours: 0,
      aiQuestionsPerWeek: 0,
      aiConnectorCallsPerWeek: 0,
      aiMonthlyTokenBudget: 0,
    },
    features: {
      onlineStore: true,
      blogSystem: "NONE",
      lookCreation: false,
      analytics: "BASIC",
      salesChannels: false,
      prioritySupport: "24_HOURS",
      unlimitedWebHosting: true,
      sslCertificate: true,
      aiEnabled: false,
      aiDailySummary: false,
    },
    isActive: true,
    createdAt: null,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("invoices (PRD-016 FR-20, PRD-017 FR-4.3)", () => {
  it("shows Partially paid for an open invoice with a payment", () => {
    expect(invoiceStatusView(invoice({ amountPaid: 300 }))).toEqual({
      label: "Partially paid",
      tone: "warning",
    });
    expect(invoiceStatusView(invoice()).label).toBe("Due");
    expect(invoiceStatusView(invoice({ status: "PAID", amountPaid: 999 })).label).toBe(
      "Paid",
    );
    expect(invoiceStatusView(invoice({ status: "OVERDUE" })).tone).toBe("danger");
  });

  it("labels proration and restart invoices", () => {
    expect(invoiceReasonLabel(invoice())).toBe("Plan period");
    expect(invoiceReasonLabel(invoice({ billingReason: "PRORATION" }))).toBe("Proration");
    expect(invoiceReasonLabel(invoice({ restart: true }))).toBe("Restart");
  });

  it("maps an invoice onto the existing row actions, owing amountDue", () => {
    expect(toInvoiceActionRow(invoice({ status: "OVERDUE", amountDue: 699 }))).toEqual({
      id: "i1",
      amount: 699,
      status: "overdue",
      transactionId: "ZC-2026-000001",
    });
    expect(toInvoiceActionRow(invoice({ status: "VOID" })).status).toBe("failed");
  });

  it("offers only the store's open invoices for APPLY, oldest due first", () => {
    const rows = openInvoicesForApply(
      [
        invoice({ id: "late", dueAt: "2026-10-20T00:00:00.000Z" }),
        invoice({ id: "paid", status: "PAID" }),
        invoice({ id: "other", tenantId: "t2" }),
        invoice({ id: "early", status: "OVERDUE", dueAt: "2026-09-20T00:00:00.000Z" }),
      ],
      "t1",
    );
    expect(rows.map((row) => row.id)).toEqual(["early", "late"]);
  });
});

describe("store billing state (PRD-016 FR-15, FR-16)", () => {
  const day = (value: string) => value.slice(0, 10);

  it("explains paused orders and the suspension date", () => {
    expect(
      billingStateView(
        { billingState: "ORDERS_PAUSED", suspendsAt: "2026-11-20T00:00:00Z" },
        day,
      ),
    ).toEqual({
      label: "Orders paused",
      tone: "danger",
      detail: "Suspended on 2026-11-20 unless paid.",
    });
  });

  it("warns before the pause and is calm otherwise", () => {
    expect(billingStateView({ ordersPauseAt: "2026-11-05" }, day).tone).toBe("warning");
    expect(billingStateView(undefined, day)).toEqual({
      label: "Taking orders",
      tone: "success",
      detail: null,
    });
  });
});

describe("plan change (PRD-016 FR-2..FR-6, PRD-017 FR-4.2)", () => {
  it("offers ACTIVE plans in scope and the current LEGACY version only", () => {
    const options = planChangeOptions(
      [
        plan("active"),
        plan("legacy-current", { status: "LEGACY", isActive: false }),
        plan("legacy-other", { status: "LEGACY", isActive: false }),
        plan("draft", { status: "DRAFT", isActive: false }),
        plan("archived", { status: "ARCHIVED", isActive: false }),
        plan("mine", { tenantId: "t1" }),
        plan("theirs", { tenantId: "t2" }),
      ],
      "t1",
      "legacy-current",
    );
    expect(options.map((row) => row.id)).toEqual(["active", "legacy-current", "mine"]);
  });

  it("lists the preview rows the server sent, untouched", () => {
    const rows = previewRowsOf({
      effective: "NOW",
      effectiveAt: "2026-10-26T00:00:00Z",
      credit: 500.5,
      charge: 900.25,
      amountDueNow: 399.75,
      nextInvoiceAmount: 1999,
      currency: "INR",
      overLimits: [],
    });
    expect(rows.map((row) => row.amount)).toEqual([500.5, 900.25, 399.75, 1999]);
    // A forced downgrade preview (override: true) adds the credit it issues
    const forced = previewRowsOf({
      effective: "NOW",
      effectiveAt: "2026-10-26T00:00:00Z",
      credit: 900,
      charge: 300,
      amountDueNow: 0,
      nextInvoiceAmount: 999,
      currency: "INR",
      overLimits: [],
      creditIssued: 600,
    });
    expect(forced.map((row) => row.key)).toEqual(["credit", "charge", "due", "next", "creditIssued"]);
  });

  it("words the over-limit warnings", () => {
    expect(overLimitLabels(["SKU_LIMIT", "OTHER"])).toEqual([
      "more products than the new plan allows",
      "OTHER",
    ]);
  });

  it("needs a reason for the downgrade override and sends none otherwise", () => {
    const base = {
      tenantId: "t1",
      planId: "p1",
      billingCycle: "MONTHLY" as const,
      effective: "NOW" as const,
    };
    expect(planChangeVariables({ ...base, override: true, reason: " " }).error).toMatch(
      /reason/,
    );
    expect(
      planChangeVariables({ ...base, override: true, reason: " agreed " }).variables,
    ).toMatchObject({ override: true, reason: "agreed" });
    expect(
      planChangeVariables({ ...base, override: false, reason: "ignored" }).variables,
    ).toMatchObject({ override: null, reason: null });
  });
});

describe("reactivation (PRD-016 FR-18)", () => {
  it("always sends override and requires a reason with it", () => {
    expect(reactivationVariables(true, "").error).toMatch(/reason/);
    expect(reactivationVariables(true, " paid by cheque ").variables).toEqual({
      override: true,
      reason: "paid by cheque",
    });
    expect(reactivationVariables(false, "").variables).toEqual({
      override: false,
      reason: null,
    });
  });

  it("starts on the override for a cancelled or suspended subscription", () => {
    expect(reactivationNeedsOverride("CANCELLED")).toBe(true);
    expect(reactivationNeedsOverride("SUSPENDED")).toBe(true);
    expect(reactivationNeedsOverride("ACTIVE")).toBe(false);
  });
});

describe("review queue (PRD-016 FR-19)", () => {
  it("requires a note and sends an invoice only for APPLY", () => {
    expect(
      resolveFlaggedVariables({
        paymentId: "p1",
        action: "DISMISS",
        invoiceId: "i1",
        note: "  ",
      }).error,
    ).toMatch(/reason/);
    expect(
      resolveFlaggedVariables({
        paymentId: "p1",
        action: "DISMISS",
        invoiceId: "i1",
        note: "test payment",
      }).variables,
    ).toEqual({ id: "p1", action: "DISMISS", invoiceId: null, note: "test payment" });
    expect(
      resolveFlaggedVariables({
        paymentId: "p1",
        action: "APPLY",
        invoiceId: "i1",
        note: "short by ₹10",
      }).variables?.invoiceId,
    ).toBe("i1");
  });

  it("keeps a resolved payment out of the queue", () => {
    expect(isAwaitingReview({ flagged: true, resolution: null })).toBe(true);
    expect(isAwaitingReview({ flagged: true, resolution: "DISMISSED" })).toBe(false);
    expect(isAwaitingReview({ flagged: false, resolution: null })).toBe(false);
  });
});

describe("credits and refunds (PRD-016 FR-5, FR-21)", () => {
  it("reads a positive amount with at most two decimals", () => {
    expect(parseAmount("250.50")).toBe(250.5);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("checks the refund form before sending", () => {
    const ok = { amount: "100", paymentAmount: 999, reference: "UTR1", reason: "dup" };
    expect(refundFormError(ok)).toBeNull();
    expect(refundFormError({ ...ok, amount: "1000" })).toMatch(/more than the payment/);
    expect(refundFormError({ ...ok, reference: "" })).toMatch(/reference/);
    expect(refundFormError({ ...ok, reason: "" })).toMatch(/reason/);
  });
});

describe("dunning settings (PRD-016 FR-16, D6/D7 gate)", () => {
  it("never sends enabled: true, and the switch is locked while off", () => {
    const draft = { ...dunningToDraft(DUNNING), enabled: true };
    const result = validateDunningDraft(draft, DUNNING);
    expect(result.patch).toEqual({
      pauseOrdersAfterDays: 7,
      suspendAfterDays: 21,
      trialSuspendAfterDays: 14,
    });
    expect(canToggleDunning(DUNNING)).toBe(false);
  });

  it("can switch a running dunning off", () => {
    const saved = { ...DUNNING, enabled: true };
    expect(canToggleDunning(saved)).toBe(true);
    const result = validateDunningDraft({ ...dunningToDraft(saved), enabled: false }, saved);
    expect(result.patch?.enabled).toBe(false);
  });

  it("keeps the pause before the suspension", () => {
    const result = validateDunningDraft(
      { ...dunningToDraft(DUNNING), pauseOrdersAfterDays: "30", suspendAfterDays: "10" },
      DUNNING,
    );
    expect(result.errors?.suspendAfterDays).toMatch(/on or after/);
  });

  it("rejects days outside 0–365", () => {
    const result = validateDunningDraft(
      { ...dunningToDraft(DUNNING), trialSuspendAfterDays: "400" },
      DUNNING,
    );
    expect(result.errors?.trialSuspendAfterDays).toMatch(/0 to 365/);
  });
});
