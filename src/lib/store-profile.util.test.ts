import { describe, expect, it } from "vitest";
import type { StoreProfile } from "../types/platform-api";
import {
  addStoreTag,
  billingStateReasonLabel,
  humaniseConstant,
  isoDayOf,
  MAX_STORE_TAGS,
  normaliseStoreTag,
  paymentProviderLabel,
  removeStoreTag,
  storeProfileDraftOf,
  storeProfileErrorsFromServer,
  storeProfileOptionLabel,
  storeProfilePatch,
  TAG_RULE_COPY,
  TOO_MANY_TAGS_COPY,
  validateStoreProfile,
} from "./store-profile.util";

function failure(code: string, extensions: Record<string, unknown> = {}, message = "Server message") {
  return { message, graphQLErrors: [{ message, extensions: { code, ...extensions } }] };
}

const PROFILE: StoreProfile = {
  category: "FOOD_BEVERAGE",
  city: "Pune",
  state: "Maharashtra",
  source: "REFERRAL",
  accountManager: { id: "u1", name: "Asha", email: "asha@zerror.in" },
  tags: ["vip", "launch-2026"],
  plannedLiveAt: "2026-11-15T00:00:00.000Z",
};

describe("profile labels (PRD-025 FR-2.2, FR-1.1)", () => {
  it("humanises the constants, with the hand-written exceptions", () => {
    expect(humaniseConstant("FASHION")).toBe("Fashion");
    expect(humaniseConstant("MOVED_PLATFORM")).toBe("Moved platform");
    expect(humaniseConstant("FOOD_BEVERAGE")).toBe("Food & beverage");
    expect(storeProfileOptionLabel("HOME_DECOR")).toBe("Home décor");
    expect(storeProfileOptionLabel(null)).toBe("—");
  });

  it("names the payment app and hides a missing provider", () => {
    expect(paymentProviderLabel("RAZORPAY")).toBe("Razorpay");
    expect(paymentProviderLabel("CASHFREE")).toBe("Cashfree");
    expect(paymentProviderLabel(null)).toBeNull();
    expect(paymentProviderLabel("")).toBeNull();
  });

  it("humanises a constant billing-state reason and passes text through", () => {
    expect(billingStateReasonLabel("INVOICE_OVERDUE")).toBe("Invoice overdue");
    expect(billingStateReasonLabel("Owner asked for a pause")).toBe("Owner asked for a pause");
    expect(billingStateReasonLabel(null)).toBeNull();
  });
});

describe("profile draft and tags (FR-2.3)", () => {
  it("builds the draft from the profile, on the UTC day", () => {
    const draft = storeProfileDraftOf(PROFILE);
    expect(draft).toEqual({
      category: "FOOD_BEVERAGE",
      city: "Pune",
      state: "Maharashtra",
      source: "REFERRAL",
      accountManagerId: "u1",
      tags: ["vip", "launch-2026"],
      plannedLiveAt: "2026-11-15",
    });
    expect(storeProfileDraftOf(null).tags).toEqual([]);
    expect(isoDayOf("2026-11-15T23:30:00+05:30")).toBe("2026-11-15");
    expect(isoDayOf("not a date")).toBe("");
  });

  it("normalises a tag like the server and refuses bad ones", () => {
    expect(normaliseStoreTag("  VIP  Client ")).toBe("vip client");
    expect(normaliseStoreTag("launch-2026")).toBe("launch-2026");
    expect(normaliseStoreTag("")).toBeNull();
    expect(normaliseStoreTag("-leading")).toBeNull();
    expect(normaliseStoreTag("emoji 🎉")).toBeNull();
    expect(normaliseStoreTag("x".repeat(31))).toBeNull();
  });

  it("adds, dedupes, caps at 20 and removes tags", () => {
    expect(addStoreTag(["vip"], "VIP")).toEqual({ tags: ["vip"] });
    expect(addStoreTag(["vip"], "New Client")).toEqual({ tags: ["vip", "new client"] });
    expect(addStoreTag(["vip"], "bad!")).toEqual({ tags: ["vip"], error: TAG_RULE_COPY });
    const full = Array.from({ length: MAX_STORE_TAGS }, (_, i) => `tag-${i}`);
    expect(addStoreTag(full, "one-more")).toEqual({ tags: full, error: TOO_MANY_TAGS_COPY });
    expect(removeStoreTag(["vip", "launch-2026"], "vip")).toEqual(["launch-2026"]);
  });
});

describe("profile validation and patch (FR-2.4)", () => {
  const initial = storeProfileDraftOf(PROFILE);

  it("flags a bad planned date, a long place name and a tag over the cap", () => {
    expect(validateStoreProfile(initial)).toEqual({});
    expect(validateStoreProfile({ ...initial, plannedLiveAt: "2026-13-45" }).plannedLiveAt).toBe(
      "Enter a valid date.",
    );
    expect(validateStoreProfile({ ...initial, city: "x".repeat(121) }).city).toMatch(/120/);
    expect(validateStoreProfile({ ...initial, tags: ["Bad Tag!"] }).tags).toBe(TAG_RULE_COPY);
  });

  it("sends only the changed fields and null to clear one", () => {
    expect(storeProfilePatch(initial, initial)).toEqual({});
    expect(
      storeProfilePatch(initial, {
        ...initial,
        category: "",
        city: " Pune ",
        state: "Goa",
        accountManagerId: "",
        tags: [],
        plannedLiveAt: "",
      }),
    ).toEqual({
      category: null,
      state: "Goa",
      accountManagerId: null,
      tags: null,
      plannedLiveAt: null,
    });
    expect(storeProfilePatch(initial, { ...initial, tags: ["vip"] })).toEqual({ tags: ["vip"] });
    expect(storeProfilePatch(initial, { ...initial, source: "DIRECT", plannedLiveAt: "2027-01-01" })).toEqual({
      source: "DIRECT",
      plannedLiveAt: "2027-01-01",
    });
  });

  it("lands a server INVALID_* answer on its field, by field or by reason", () => {
    expect(storeProfileErrorsFromServer(failure("BAD_USER_INPUT", { field: "tags", reason: "INVALID_TAG" }))).toEqual({
      tags: "Server message",
    });
    expect(storeProfileErrorsFromServer(failure("BAD_USER_INPUT", { reason: "INVALID_ACCOUNT_MANAGER" }))).toEqual({
      accountManagerId: "Server message",
    });
    expect(storeProfileErrorsFromServer(failure("BAD_USER_INPUT", { reason: "INVALID_DATE" }))).toEqual({
      plannedLiveAt: "Server message",
    });
    expect(storeProfileErrorsFromServer(failure("BAD_USER_INPUT", { field: "ownerEmail" }))).toEqual({
      form: "Server message",
    });
    expect(storeProfileErrorsFromServer(failure("FORBIDDEN"))).toBeNull();
    expect(storeProfileErrorsFromServer(new Error("network"))).toBeNull();
  });
});
