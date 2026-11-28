/**
 * Backend PRD-051 W3 (console, FR-11, Q6): the WhatsApp number's monthly fee
 * field (rupees ↔ paise, 0–₹10,000), the fee list's month and status filters
 * and the "still due" words.
 */
import { describe, expect, it } from "vitest";

import { formatPaise } from "./platform-messaging-balance.util";
import {
  WHATSAPP_NUMBER_FEE_MAX_PAISE,
  isNumberFeeTab,
  numberFeeError,
  numberFeeErrorText,
  numberFeeVariables,
  paiseToRupees,
  rupeesToPaise,
  validNumberFeeMonth,
} from "./platform-messaging.util";

describe("WhatsApp number fee field", () => {
  it("accepts 0 to ₹10,000 in rupees", () => {
    expect(numberFeeError("0")).toBeNull();
    expect(numberFeeError("99.50")).toBeNull();
    expect(numberFeeError("10000")).toBeNull();
    expect(numberFeeError("10000.01")).toBe("At most ₹10,000 a month");
    expect(numberFeeError("-1")).toMatch(/Enter rupees/);
    expect(numberFeeError("abc")).toMatch(/Enter rupees/);
  });

  it("round-trips paise", () => {
    expect(rupeesToPaise("99.5")).toBe(9950);
    expect(paiseToRupees(9950)).toBe("99.50");
    expect(rupeesToPaise(paiseToRupees(WHATSAPP_NUMBER_FEE_MAX_PAISE))).toBe(WHATSAPP_NUMBER_FEE_MAX_PAISE);
    expect(formatPaise(9950)).toContain("99.50");
  });
});

describe("number fee list filters", () => {
  it("validates YYYY-MM months", () => {
    expect(validNumberFeeMonth("2026-11")).toBe("2026-11");
    expect(validNumberFeeMonth(" 2026-01 ")).toBe("2026-01");
    expect(validNumberFeeMonth("2026-13")).toBeNull();
    expect(validNumberFeeMonth("2026-1")).toBeNull();
    expect(validNumberFeeMonth("")).toBeNull();
    expect(validNumberFeeMonth(null)).toBeNull();
  });

  it("builds the query variables", () => {
    expect(numberFeeVariables("2026-11", "DUE", 20, 40)).toEqual({ month: "2026-11", status: "DUE", limit: 20, offset: 40 });
    expect(numberFeeVariables(null, "ALL", 20, 0)).toEqual({ month: null, status: null, limit: 20, offset: 0 });
    expect(numberFeeVariables("nope", "CHARGED", 20, 0).month).toBeNull();
  });

  it("knows its tabs", () => {
    expect(isNumberFeeTab("DUE")).toBe(true);
    expect(isNumberFeeTab("ALL")).toBe(true);
    expect(isNumberFeeTab("PAID")).toBe(false);
    expect(isNumberFeeTab(null)).toBe(false);
  });

  it("says why a fee is due", () => {
    expect(numberFeeErrorText("MESSAGE_BALANCE_EMPTY")).toMatch(/balance couldn't cover it/);
    expect(numberFeeErrorText("Something else")).toBe("Something else");
    expect(numberFeeErrorText(null)).toBeNull();
  });
});
