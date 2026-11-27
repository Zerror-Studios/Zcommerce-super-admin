import { describe, expect, it } from "vitest";
import {
  BALANCE_ADJUST_MAX_PAISE,
  adjustDirectionEnum,
  adjustDraftOf,
  balanceAfter,
  balanceFailureCopy,
  balanceFieldErrorsFromServer,
  balanceLevelChip,
  balanceListVariables,
  formatPaise,
  ledgerByLabel,
  ledgerKindLabel,
  shouldReloadBalanceAfter,
  topUpListVariables,
  validateAdjustDraft,
  validateTopUpReference,
  validateWithdrawReason,
  type AdjustDraft,
} from "./platform-messaging-balance.util";

function gqlError(code: string, reason: string, field?: string, message = "Server says no") {
  return Object.assign(new Error(message), {
    graphQLErrors: [{ message, extensions: { code, reason, ...(field ? { field } : {}) } }],
  });
}

function draft(patch: Partial<AdjustDraft>): AdjustDraft {
  return { ...adjustDraftOf(), reason: "Goodwill for the outage", ...patch };
}

describe("formatPaise", () => {
  it("shows rupees with two decimals", () => {
    expect(formatPaise(123450)).toBe("₹1,234.50");
    expect(formatPaise(25)).toBe("₹0.25");
    expect(formatPaise(10000)).toBe("₹100.00");
  });

  it("shows zero and missing values as ₹0.00", () => {
    expect(formatPaise(0)).toBe("₹0.00");
    expect(formatPaise(null)).toBe("₹0.00");
    expect(formatPaise(Number.NaN)).toBe("₹0.00");
  });

  it("signs ledger movements with + and the minus sign", () => {
    expect(formatPaise(5000, { showSign: true })).toBe("+₹50.00");
    expect(formatPaise(-5000, { showSign: true })).toBe("−₹50.00");
  });
});

describe("validateAdjustDraft", () => {
  it("turns a grant in rupees into positive whole paise", () => {
    const check = validateAdjustDraft(draft({ amount: "250.29" }), 0);
    expect(check.errors).toEqual({});
    expect(check.amountPaise).toBe(25029);
  });

  it("turns a correction into negative paise", () => {
    const check = validateAdjustDraft(
      draft({ direction: adjustDirectionEnum.CORRECTION, amount: "₹10" }),
      5000,
    );
    expect(check.amountPaise).toBe(-1000);
  });

  it("refuses a correction above the available balance", () => {
    const check = validateAdjustDraft(
      draft({ direction: adjustDirectionEnum.CORRECTION, amount: "50.01" }),
      5000,
    );
    expect(check.amountPaise).toBeNull();
    expect(check.errors.amount).toBe("Only ₹50.00 is available to remove");
  });

  it("lets a grant go above the available balance", () => {
    expect(validateAdjustDraft(draft({ amount: "50.01" }), 0).amountPaise).toBe(5001);
  });

  it("refuses empty, zero, negative, three-decimal and too-large amounts", () => {
    expect(validateAdjustDraft(draft({ amount: "" }), 0).errors.amount).toBe("Enter an amount");
    for (const amount of ["0", "0.00", "-5", "1.005", "abc"]) {
      expect(validateAdjustDraft(draft({ amount }), 0).errors.amount).toMatch(/above zero/);
    }
    const tooMuch = validateAdjustDraft(draft({ amount: "100000.01" }), 0);
    expect(tooMuch.errors.amount).toMatch(/or less/);
    expect(validateAdjustDraft(draft({ amount: "100000" }), 0).amountPaise).toBe(BALANCE_ADJUST_MAX_PAISE);
  });

  it("needs a reason, up to 500 characters", () => {
    expect(validateAdjustDraft(draft({ amount: "1", reason: "  " }), 0).errors.reason).toBe(
      "Say why the balance changes",
    );
    expect(validateAdjustDraft(draft({ amount: "1", reason: "x".repeat(501) }), 0).errors.reason).toMatch(/500/);
  });
});

describe("balanceAfter", () => {
  it("adds the signed movement and never goes below zero", () => {
    expect(balanceAfter(1000, 500)).toBe(1500);
    expect(balanceAfter(1000, -400)).toBe(600);
    expect(balanceAfter(100, -400)).toBe(0);
  });
});

describe("top-up forms", () => {
  it("needs a bank reference up to 200 characters", () => {
    expect(validateTopUpReference(" ")).toBe("Enter the bank transfer's reference");
    expect(validateTopUpReference("x".repeat(201))).toMatch(/200/);
    expect(validateTopUpReference("UTR123")).toBeUndefined();
  });

  it("needs a withdraw reason", () => {
    expect(validateWithdrawReason("")).toBe("Say why the top-up is withdrawn");
    expect(validateWithdrawReason("Store asked to cancel")).toBeUndefined();
  });
});

describe("labels and list variables", () => {
  it("maps levels to chips", () => {
    expect(balanceLevelChip("EMPTY")).toEqual({ label: "Empty", tone: "danger" });
    expect(balanceLevelChip("LOW")).toEqual({ label: "Low", tone: "warning" });
    expect(balanceLevelChip(null)).toBeNull();
  });

  it("labels ledger kinds and actors", () => {
    expect(ledgerKindLabel("ADJUSTMENT")).toBe("Correction");
    expect(ledgerKindLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(ledgerByLabel("SYSTEM")).toBe("System");
    expect(ledgerByLabel(null)).toBe("—");
  });

  it("builds the server's list variables", () => {
    expect(balanceListVariables("LOW", 20, 40)).toEqual({ lowOnly: true, limit: 20, offset: 40 });
    expect(balanceListVariables("ALL", 20, 0)).toEqual({ lowOnly: false, limit: 20, offset: 0 });
    expect(topUpListVariables("ALL", 20, 0)).toEqual({ status: null, tenantId: null, limit: 20, offset: 0 });
    expect(topUpListVariables("PENDING", 10, 10, "t1")).toEqual({
      status: "PENDING",
      tenantId: "t1",
      limit: 10,
      offset: 10,
    });
  });
});

describe("server errors", () => {
  it("maps INVALID_AMOUNT on amountPaise to the amount field", () => {
    expect(
      balanceFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "INVALID_AMOUNT", "amountPaise", "Too much")),
    ).toEqual({ amount: "Too much" });
  });

  it("keeps REASON_REQUIRED on its field (reason or reference)", () => {
    expect(balanceFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "REASON_REQUIRED", "reference", "Ref"))).toEqual({
      reference: "Ref",
    });
  });

  it("ignores other codes and reasons", () => {
    expect(balanceFieldErrorsFromServer(gqlError("CONFLICT", "TOPUP_NOT_PENDING"))).toBeNull();
    expect(balanceFieldErrorsFromServer(gqlError("BAD_USER_INPUT", "SOMETHING_ELSE", "x"))).toBeNull();
  });

  it("explains TOPUP_NOT_PENDING and reloads after it", () => {
    const error = gqlError("CONFLICT", "TOPUP_NOT_PENDING");
    expect(balanceFailureCopy(error)).toMatch(/isn't waiting for payment/);
    expect(shouldReloadBalanceAfter(error)).toBe(true);
    expect(shouldReloadBalanceAfter(gqlError("CONFLICT", "OTHER"))).toBe(false);
  });
});
