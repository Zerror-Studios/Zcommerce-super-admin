import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import type { GoLiveCheck } from "../types/platform-api";
import {
  blockingChecks,
  deleteBlockers,
  deleteVariables,
  failingChecksFromError,
  isMoneySettled,
  lifecycleFailureCopy,
  markLiveVariables,
  moneyCountsFromError,
  moneyInFlightRows,
  normaliseDomain,
  purgeCountdown,
  storeDetailsDraftOf,
  storeDetailsErrorsFromServer,
  storeDetailsPatch,
  suspendCategoryLabel,
  validateStoreDetails,
} from "./tenant-lifecycle.util";

function failure(code: string, extensions: Record<string, unknown> = {}, message = "Server message") {
  return { message, graphQLErrors: [{ message, extensions: { code, ...extensions } }] };
}

const SETTLED = {
  pendingPayments: 0,
  paidUnfulfilledOrders: 0,
  refundsInProgress: 0,
  needsRefundOrders: 0,
  needsAttentionOrders: 0,
  openReturns: 0,
  activeHolds: 0,
  activeMarketplaceListings: 0,
  openPlatformInvoices: 0,
  partial: false,
};

describe("money in flight (PRD-018 FR-1.2, FR-2.1)", () => {
  it("lists every count and only payment-side ones block a delete", () => {
    const counts = { ...SETTLED, pendingPayments: 2, openReturns: 1, needsRefundOrders: 1 };
    expect(moneyInFlightRows(counts)).toHaveLength(9);
    expect(deleteBlockers(counts).map((row) => row.key)).toEqual([
      "pendingPayments",
      "needsRefundOrders",
    ]);
    expect(isMoneySettled(counts)).toBe(false);
    expect(isMoneySettled(SETTLED)).toBe(true);
  });

  it("reads the counts of a MONEY_IN_FLIGHT refusal", () => {
    const error = failure("CONFLICT", { reason: "MONEY_IN_FLIGHT", counts: { pendingPayments: 3 } });
    expect(moneyCountsFromError(error)).toEqual({ pendingPayments: 3 });
    expect(moneyCountsFromError(failure("CONFLICT", { reason: "OTHER" }))).toBeNull();
    expect(lifecycleFailureCopy(error)).toMatch(/money in flight/);
  });
});

describe("delete and restore (FR-2.1, FR-2.3)", () => {
  const base = { id: "t1", slug: "acme", confirmSlug: "acme", force: false, forceReason: "" };

  it("needs the slug, and a reason only when forced", () => {
    expect(deleteVariables({ ...base, confirmSlug: "acm" }).error).toMatch(/slug/);
    expect(deleteVariables(base).variables).toEqual({
      id: "t1",
      confirmSlug: "acme",
      force: false,
      forceReason: null,
    });
    expect(deleteVariables({ ...base, force: true }).error).toMatch(/reason/);
    expect(deleteVariables({ ...base, force: true, forceReason: " Fraud " }).variables).toMatchObject({
      force: true,
      forceReason: "Fraud",
    });
  });

  it("counts the grace days down to the purge date", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    expect(purgeCountdown("2026-11-25T00:00:00Z", now)).toEqual({ daysLeft: 30, expired: false });
    expect(purgeCountdown("2026-10-25T00:00:00Z", now)).toEqual({ daysLeft: 0, expired: true });
    expect(purgeCountdown(null, now)).toBeNull();
    expect(lifecycleFailureCopy(failure("CONFLICT", { reason: "PURGE_STARTED" }))).toMatch(/can't be restored/);
    // CP2-07: the conditional delete lost a race (CP-19)
    expect(
      lifecycleFailureCopy(failure("CONFLICT", { reason: "TENANT_CHANGED" })),
    ).toMatch(/nothing was deleted/);
    // CP3-02: the rollback missed, so the store stayed deleted
    expect(
      lifecycleFailureCopy(
        failure("CONFLICT", { reason: "TENANT_CHANGED", rollback: "MISSED" }),
      ),
    ).toMatch(/still deleted/);
  });

  it("labels the suspension categories", () => {
    expect(suspendCategoryLabel("OWNER_REQUEST")).toBe("Owner's request");
    expect(suspendCategoryLabel(undefined)).toBe("Not recorded");
  });
});

describe("domains and go-live (FR-4)", () => {
  it("normalises a typed domain and rejects what can't be one", () => {
    expect(normaliseDomain(" https://Shop.Example.com/path ")).toBe("shop.example.com");
    expect(normaliseDomain("shop.example.com.")).toBe("shop.example.com");
    expect(normaliseDomain("localhost")).toBeNull();
    expect(normaliseDomain("-bad.example.com")).toBeNull();
  });

  const checks: GoLiveCheck[] = [
    { key: "domain_verified", label: "Domain", required: true, state: "PASS", detail: null },
    { key: "payment_app", label: "Payment", required: true, state: "FAIL", detail: null },
    { key: "https_root", label: "HTTPS", required: true, state: "UNKNOWN", detail: null },
    { key: "shipping_app", label: "Shipping", required: false, state: "FAIL", detail: null },
  ];

  it("lets only payment and legal checks be waived", () => {
    expect(blockingChecks(checks).map((check) => check.key)).toEqual(["payment_app", "https_root"]);
    expect(blockingChecks(checks, ["payment_app", "https_root"]).map((check) => check.key)).toEqual([
      "https_root",
    ]);
  });

  it("needs a reason for waivers and drops unknown keys", () => {
    expect(markLiveVariables("t1", ["payment_app"], " ").error).toMatch(/reason/);
    expect(markLiveVariables("t1", [], "").variables).toEqual({
      tenantId: "t1",
      waive: null,
      waiveReason: null,
    });
    expect(markLiveVariables("t1", ["payment_app", "https_root"], "Pilot").variables).toEqual({
      tenantId: "t1",
      waive: ["payment_app"],
      waiveReason: "Pilot",
    });
  });

  it("reads the failing keys and maps the domain reasons", () => {
    const error = failure("CONFLICT", { reason: "CHECKLIST_FAILED", failing: ["https_root"] });
    expect(failingChecksFromError(error)).toEqual(["https_root"]);
    expect(lifecycleFailureCopy(failure("CONFLICT", { reason: "DOMAIN_TAKEN" }))).toMatch(/Another store/);
    expect(lifecycleFailureCopy(failure("BAD_USER_INPUT", { reason: "USE_DOMAIN_VERIFICATION" }))).toMatch(
      /verification/,
    );
  });
});

describe("store details form (PRD-017 FR-4.5)", () => {
  const client = {
    id: "t1",
    storeName: "Acme",
    ownerName: "Asha",
    ownerEmail: "asha@acme.in",
    gstin: "29ABCDE1234F1Z5",
    timezone: "Asia/Kolkata",
    currency: "INR",
  } as Client;

  it("sends only changed fields, clears optional ones with null and never the domain", () => {
    const before = storeDetailsDraftOf(client);
    expect(before.ownerPhone).toBe("");
    const after = { ...before, name: "Acme Store ", gstin: "", ownerPhone: "+91 90000 00000" };
    expect(storeDetailsPatch(before, after)).toEqual({
      name: "Acme Store",
      gstin: null,
      ownerPhone: "+91 90000 00000",
    });
    expect(storeDetailsPatch(before, { ...before, currency: "" })).toEqual({});
    expect("domain" in storeDetailsPatch(before, after)).toBe(false);
  });

  it("validates locally and puts server errors on their field", () => {
    const draft = storeDetailsDraftOf(client);
    expect(validateStoreDetails({ ...draft, name: " ", ownerEmail: "x", currency: "RUPEE" })).toEqual({
      name: "Enter a store name.",
      ownerEmail: "Enter a valid email.",
      currency: "Use a three-letter code, like INR.",
    });
    expect(
      storeDetailsErrorsFromServer(failure("BAD_USER_INPUT", { field: "billingContactEmail" }, "Bad email")),
    ).toEqual({ billingContactEmail: "Bad email" });
    expect(storeDetailsErrorsFromServer(failure("FORBIDDEN"))).toBeNull();
  });
});
