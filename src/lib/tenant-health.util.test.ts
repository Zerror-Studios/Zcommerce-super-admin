import { describe, expect, it } from "vitest";
import type { TenantHealth } from "../types/platform-api";
import { latestHealthSnapshot, tenantHealthRows } from "./tenant-health.util";

const HEALTH: TenantHealth = {
  logins30d: 12,
  checkoutFailures7d: 3,
  paymentFailures7d: 0,
  repeatCustomerRate: 18.5,
  unpaidExpiries30d: null,
  returns30d: 2,
  refunds30d: { count: 1, amount: 1200 },
  stockOutVariants: null,
  outboxPending: 0,
  dlqDepth: 4,
  orders14d: 0,
};

describe("store health rows (PRD-025 FR-5, FR-6.3)", () => {
  it("formats each figure, refunds as count and amount, nulls as not collected", () => {
    const rows = tenantHealthRows(HEALTH);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.logins30d.value).toBe("12");
    expect(byKey.repeatCustomerRate.value).toBe("18.5%");
    expect(byKey.refunds30d.value).toBe("1 · ₹1,200");
    expect(byKey.unpaidExpiries30d.value).toBeNull();
    expect(byKey.stockOutVariants.value).toBeNull();
  });

  it("tones the figures that deserve a look", () => {
    const rows = tenantHealthRows(HEALTH);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    expect(byKey.checkoutFailures7d.tone).toBe("warning");
    expect(byKey.paymentFailures7d.tone).toBe("neutral");
    expect(byKey.dlqDepth.tone).toBe("danger");
    expect(byKey.orders14d.tone).toBe("warning");
    expect(byKey.unpaidExpiries30d.tone).toBe("neutral");
  });

  it("lists every row as not collected without a health block", () => {
    const rows = tenantHealthRows(null);
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.value === null)).toBe(true);
  });

  it("picks the newest snapshot", () => {
    const older = { date: "2026-10-28", health: HEALTH };
    const newer = { date: "2026-10-29", health: null };
    expect(latestHealthSnapshot([older, newer])).toBe(newer);
    expect(latestHealthSnapshot([newer, older])).toBe(newer);
    expect(latestHealthSnapshot([])).toBeNull();
  });
});
