import { describe, expect, it } from "vitest";

import type { Client, Plan } from "../types";
import {
  addStorePlans,
  clientPlanLabel,
  normaliseCurrency,
  planFilterOptions,
  planOptionLabel,
  planPriceHint,
} from "./plan-identity.util";

const plan = (id: string, extra: Partial<Plan> = {}): Plan =>
  ({
    id,
    name: "PLUS",
    priceMonthly: 4999,
    priceYearly: 48000,
    version: 1,
    status: "ACTIVE",
    tenantId: null,
    features: [],
    clientCount: 0,
    limits: { products: null, storageGb: null, bandwidthGb: null },
    ...extra,
  }) as Plan;

describe("plans by identity (PRD-024 FR-1.3)", () => {
  it("names a version and marks custom plans", () => {
    expect(planOptionLabel(plan("a", { version: 2 }))).toBe("Plus v2");
    expect(planOptionLabel(plan("b", { displayName: "Acme", tenantId: "t-1" }))).toBe("Acme v1 (custom)");
  });

  it("labels a store by its own plan version, else its tier", () => {
    const ref = { id: "a", version: 3, displayName: "Plus", custom: false, limits: { products: null, staff: null } };
    expect(clientPlanLabel({ plan: "PLUS", planRef: ref } as Client)).toBe("Plus v3");
    expect(clientPlanLabel({ plan: "STARTER" } as Client)).toBe("Starter");
  });

  it("lists global plans first in the filter, by id", () => {
    const options = planFilterOptions([plan("custom", { tenantId: "t-1" }), plan("global")]);
    expect(options.map((option) => option.key)).toEqual(["global", "custom"]);
  });

  it("offers only global ACTIVE plans when adding a store", () => {
    const plans = [
      plan("ok"),
      plan("custom", { tenantId: "t-1" }),
      plan("legacy", { status: "LEGACY" }),
    ];
    expect(addStorePlans(plans).map((p) => p.id)).toEqual(["ok"]);
  });
});

describe("Add store price and settings (PRD-024 FR-1.4)", () => {
  const format = (amount: number) => `₹${amount}`;

  it("shows the price for the chosen billing cycle", () => {
    expect(planPriceHint(plan("a"), "MONTHLY", format)).toBe("₹4999 / month");
    expect(planPriceHint(plan("a"), "YEARLY", format)).toBe("₹48000 / year");
    expect(planPriceHint(plan("a", { priceYearly: undefined }), "YEARLY", format)).toBe(
      "No yearly price on this plan",
    );
  });

  it("accepts a three-letter currency code", () => {
    expect(normaliseCurrency(" inr ")).toBe("INR");
    expect(normaliseCurrency("RUPEE")).toBeNull();
  });
});
