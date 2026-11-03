import { describe, expect, it } from "vitest";
import {
  EMPTY_BUSINESS_DETAILS,
  businessDetailsErrorsFromServer,
  businessDetailsInput,
  hasBusinessDetailsErrors,
  provisioningStepLabel,
  sortStoreSetupChecks,
  storeSetupDoneCount,
  storeSetupLabel,
  storeSetupTone,
  validateBusinessDetails,
} from "./store-setup.util";

const gqlError = (extensions: Record<string, unknown>, message = "Bad") => ({
  graphQLErrors: [{ message, extensions }],
});

describe("store setup (backend PRD-031)", () => {
  it("labels checks and provisioning steps (FR-D1, FR-C)", () => {
    expect(storeSetupLabel("payment_app")).toBe("Payment app");
    expect(storeSetupLabel("new_check")).toBe("new check");
    expect(provisioningStepLabel("notifications")).toBe("Standard shopper emails");
    expect(provisioningStepLabel("storeSettings")).toBe("Invoice settings");
    expect(provisioningStepLabel("channels")).not.toMatch(/Nimbbl/);
    expect(storeSetupTone("MISSING")).toBe("warning");
    expect(storeSetupTone("WARNING")).toBe("neutral");
    expect(storeSetupTone("OK")).toBe("success");
  });

  it("lists missing first, then warnings, then done, keeping the server order (FR-D3)", () => {
    const checks = [
      { key: "a", status: "OK", detail: "" },
      { key: "b", status: "WARNING", detail: "" },
      { key: "c", status: "MISSING", detail: "" },
      { key: "d", status: "MISSING", detail: "" },
    ] as const;
    expect(sortStoreSetupChecks(checks).map((check) => check.key)).toEqual(["c", "d", "b", "a"]);
    expect(storeSetupDoneCount(checks)).toBe(1);
  });

  it("sends only the business fields filled in (FR-B1)", () => {
    expect(businessDetailsInput(EMPTY_BUSINESS_DETAILS)).toEqual({});
    expect(
      businessDetailsInput({
        billingContactEmail: " Accounts@Store.IN ",
        gstin: "27abcde1234f1z5",
        businessName: " Kesar & Kin Pvt Ltd ",
        profile: { ...EMPTY_BUSINESS_DETAILS.profile, category: "FASHION", tags: ["vip"] },
      }),
    ).toEqual({
      billingContactEmail: "accounts@store.in",
      gstin: "27ABCDE1234F1Z5",
      businessName: "Kesar & Kin Pvt Ltd",
      profile: { category: "FASHION", tags: ["vip"] },
    });
  });

  it("checks email and GSTIN locally; a cleared error no longer counts", () => {
    const errors = validateBusinessDetails({ ...EMPTY_BUSINESS_DETAILS, billingContactEmail: "nope", gstin: "123" });
    expect(errors.billingContactEmail).toBeTruthy();
    expect(errors.gstin).toBeTruthy();
    expect(hasBusinessDetailsErrors({ profile: { category: undefined } })).toBe(false);
  });

  it("puts server field errors on this section's inputs only", () => {
    expect(businessDetailsErrorsFromServer(gqlError({ code: "BAD_USER_INPUT", field: "gstin" }, "Bad GSTIN"))).toEqual({
      gstin: "Bad GSTIN",
      profile: {},
    });
    expect(
      businessDetailsErrorsFromServer(gqlError({ code: "BAD_USER_INPUT", field: "category", reason: "INVALID_CATEGORY" })),
    ).toEqual({ profile: { category: "Bad" } });
    expect(businessDetailsErrorsFromServer(gqlError({ code: "BAD_USER_INPUT", field: "slug" }))).toBeNull();
    expect(businessDetailsErrorsFromServer(gqlError({ code: "CONFLICT", field: "gstin" }))).toBeNull();
  });
});
