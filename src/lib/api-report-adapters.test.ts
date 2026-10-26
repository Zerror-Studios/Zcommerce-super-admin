import { describe, expect, it } from "vitest";

import type { PlatformPayment } from "../types/platform-api";
import { couponStatusesOf, paymentsFilterOf, toTransaction } from "./api-report-adapters";

describe("payments filter (PRD-024 FR-1.6)", () => {
  it("sends search and status to the server", () => {
    expect(paymentsFilterOf({ search: "  acme ", statuses: ["success", "pending"] })).toEqual({
      search: "acme",
      status: ["SUCCESS", "PENDING"],
    });
  });

  it("keeps the store filter and drops unknown statuses", () => {
    expect(paymentsFilterOf({ tenantId: "t-1", statuses: ["bogus"] })).toEqual({ tenantId: "t-1" });
    expect(paymentsFilterOf({})).toBeNull();
  });

  it("shows the payment's own plan (B-09)", () => {
    const payment = {
      id: "p-1",
      tenantId: "t-1",
      tenantName: "Acme",
      amount: 10,
      currency: "INR",
      provider: "MANUAL",
      type: "SUBSCRIPTION",
      status: "SUCCESS",
      planName: "PREMIUM",
      transactionId: null,
      periodStart: null,
      periodEnd: null,
      createdAt: null,
    } as PlatformPayment;
    expect(toTransaction(payment).planName).toBe("PREMIUM");
  });
});

describe("coupon status filter (PRD-024 FR-3.5)", () => {
  it("maps console statuses to the API enum and drops unknown values", () => {
    expect(couponStatusesOf(["active", "expired", "bogus"])).toEqual(["ACTIVE", "EXPIRED"]);
  });

  it("sends no filter when nothing is chosen", () => {
    expect(couponStatusesOf([])).toBeNull();
    expect(couponStatusesOf(["bogus"])).toBeNull();
  });
});
