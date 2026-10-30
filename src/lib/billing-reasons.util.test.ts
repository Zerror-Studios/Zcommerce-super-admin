import { describe, expect, it } from "vitest";
import {
  CANCEL_NOTE_MAX_LENGTH,
  CANCEL_NOTE_TOO_LONG_COPY,
  CANCEL_REASON_OPTIONS,
  CANCEL_REASON_REQUIRED_COPY,
  cancelReasonLabel,
  cancelSubscriptionVariables,
  reasonFormFieldOf,
  VOID_REASON_OPTIONS,
  VOID_REASON_REQUIRED_COPY,
  voidInvoiceVariables,
  voidReasonLabel,
} from "./billing-reasons.util";

function failure(code: string, extensions: Record<string, unknown> = {}, message = "Server message") {
  return { message, graphQLErrors: [{ message, extensions: { code, ...extensions } }] };
}

describe("cancel subscription dialog (PRD-025 FR-4.2, FR-6.4)", () => {
  it("offers the five reasons and labels them", () => {
    expect(CANCEL_REASON_OPTIONS.map((option) => option.key)).toEqual([
      "PRICE",
      "CLOSED_BUSINESS",
      "MOVED_PLATFORM",
      "UNHAPPY_WITH_SERVICE",
      "OTHER",
    ]);
    expect(cancelReasonLabel("MOVED_PLATFORM")).toBe("Moved to another platform");
    expect(cancelReasonLabel("SOMETHING_ELSE")).toBe("Something else");
    expect(cancelReasonLabel(null)).toBeNull();
  });

  it("requires a reason before anything is sent", () => {
    expect(cancelSubscriptionVariables("t1", { immediate: false, reason: "", note: "" })).toEqual({
      error: CANCEL_REASON_REQUIRED_COPY,
      field: "reason",
    });
    expect(cancelSubscriptionVariables("t1", { immediate: false, reason: "NOPE", note: "" }).field).toBe("reason");
  });

  it("sends the reason, the flag and a trimmed note (null when empty)", () => {
    expect(cancelSubscriptionVariables("t1", { immediate: true, reason: "PRICE", note: "  " })).toEqual({
      variables: { tenantId: "t1", immediate: true, reason: "PRICE", note: null },
    });
    expect(cancelSubscriptionVariables("t1", { immediate: false, reason: "OTHER", note: " Moving abroad " })).toEqual({
      variables: { tenantId: "t1", immediate: false, reason: "OTHER", note: "Moving abroad" },
    });
  });

  it("caps the note at 500 characters", () => {
    const note = "x".repeat(CANCEL_NOTE_MAX_LENGTH + 1);
    expect(cancelSubscriptionVariables("t1", { immediate: false, reason: "PRICE", note })).toEqual({
      error: CANCEL_NOTE_TOO_LONG_COPY,
      field: "note",
    });
  });
});

describe("void invoice dialog (PRD-025 FR-4.4, FR-6.4)", () => {
  it("offers the four void reasons and labels them", () => {
    expect(VOID_REASON_OPTIONS.map((option) => option.key)).toEqual([
      "WRITTEN_OFF",
      "ISSUED_IN_ERROR",
      "SUPERSEDED",
      "OTHER",
    ]);
    expect(voidReasonLabel("WRITTEN_OFF")).toBe("Written off (bad debt)");
    expect(voidReasonLabel(null)).toBeNull();
  });

  it("requires the enum and keeps the free text as the reason argument", () => {
    expect(voidInvoiceVariables("inv1", { voidReason: "", note: "dup" })).toEqual({
      error: VOID_REASON_REQUIRED_COPY,
      field: "reason",
    });
    expect(voidInvoiceVariables("inv1", { voidReason: "SUPERSEDED", note: " Reissued as INV-9 " })).toEqual({
      variables: { id: "inv1", reason: "Reissued as INV-9", voidReason: "SUPERSEDED" },
    });
  });
});

describe("server refusals", () => {
  it("maps INVALID_CANCEL_REASON and the note field, nothing else", () => {
    expect(reasonFormFieldOf(failure("BAD_USER_INPUT", { reason: "INVALID_CANCEL_REASON", field: "reason" }))).toBe(
      "reason",
    );
    expect(reasonFormFieldOf(failure("BAD_USER_INPUT", { field: "voidReason" }))).toBe("reason");
    expect(reasonFormFieldOf(failure("BAD_USER_INPUT", { field: "note" }))).toBe("note");
    expect(reasonFormFieldOf(failure("BAD_USER_INPUT", { reason: "OPEN_INVOICE" }))).toBeNull();
    expect(reasonFormFieldOf(failure("FORBIDDEN", { reason: "INVALID_CANCEL_REASON" }))).toBeNull();
  });
});
