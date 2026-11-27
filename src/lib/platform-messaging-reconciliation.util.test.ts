import { describe, expect, it } from "vitest";
import {
  RECONCILIATION_STATUS_LABEL,
  RECONCILIATION_STATUS_TABS,
  RECONCILIATION_STATUS_TONE,
  differenceText,
  formatReconcileMonth,
  isReconciliationStatusTab,
  purposeSummary,
  reconciliationFailureCopy,
  reconciliationStatusEnum,
  reconciliationVariables,
} from "./platform-messaging-reconciliation.util";

function gqlError(code: string, reason: string, message = "Server says no") {
  return Object.assign(new Error(message), {
    graphQLErrors: [{ message, extensions: { code, reason } }],
  });
}

describe("messaging usage reconciliation helpers (PRD-050 D20)", () => {
  it("labels and colours every status, differences first in the tabs", () => {
    for (const status of Object.values(reconciliationStatusEnum)) {
      expect(RECONCILIATION_STATUS_LABEL[status]).toBeTruthy();
      expect(RECONCILIATION_STATUS_TONE[status]).toBeTruthy();
    }
    expect(RECONCILIATION_STATUS_TONE.MISMATCH).toBe("danger");
    expect(RECONCILIATION_STATUS_TABS[1].value).toBe("MISMATCH");
    expect(isReconciliationStatusTab("MISMATCH")).toBe(true);
    expect(isReconciliationStatusTab("NOPE")).toBe(false);
    expect(isReconciliationStatusTab(null)).toBe(false);
  });

  it("formats the month and the list variables", () => {
    expect(formatReconcileMonth("2026-10")).toBe("Oct 2026");
    expect(formatReconcileMonth("2026-13")).toBe("—");
    expect(formatReconcileMonth(null)).toBe("—");
    expect(reconciliationVariables(null, "ALL", 20, 0)).toEqual({ month: null, status: null, limit: 20, offset: 0 });
    expect(reconciliationVariables("2026-10", "MISMATCH", 20, 40)).toEqual({
      month: "2026-10",
      status: "MISMATCH",
      limit: 20,
      offset: 40,
    });
  });

  it("writes the difference and the purpose split", () => {
    expect(differenceText({ difference: 30, differencePct: 60 })).toBe("+30 (60 %)");
    expect(differenceText({ difference: -3, differencePct: 1 })).toBe("−3 (1 %)");
    expect(differenceText({ difference: 0, differencePct: 0 })).toBe("0 (0 %)");
    expect(differenceText({ difference: null, differencePct: null })).toBe("—");
    expect(purposeSummary({ TRANSACTIONAL: 60, MARKETING: 30, SERVICE: 0 })).toBe("Transactional 60 · Marketing 30");
    expect(purposeSummary(null)).toBe("");
  });

  it("explains the server's reasons", () => {
    expect(reconciliationFailureCopy(gqlError("BAD_USER_INPUT", "INVALID_MONTH"))).toBe("Choose a month as YYYY-MM.");
  });
});
