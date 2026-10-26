import { describe, expect, it } from "vitest";

import type { Subscription } from "../types";
import {
  collectionsPlanIdForTier,
  findLatestSubscription,
  latestSubscriptionByClient,
} from "./subscription-lookup.util";

const subscription = (
  id: string,
  clientId: string,
  startedAt: string,
): Subscription => ({
  id,
  clientId,
  clientName: clientId,
  plan: "PLUS",
  status: "ACTIVE",
  renewalDate: "2026-11-01",
  mrr: 99,
  amountDue: 0,
  startedAt,
});

describe("latestSubscriptionByClient", () => {
  const older = subscription("old", "c1", "2025-01-01");
  const newer = subscription("new", "c1", "2026-01-01");
  const other = subscription("other", "c2", "2025-06-01");

  it("picks the latest by start date regardless of array order", () => {
    expect(latestSubscriptionByClient([older, newer]).get("c1")?.id).toBe(
      "new",
    );
    expect(latestSubscriptionByClient([newer, older]).get("c1")?.id).toBe(
      "new",
    );
  });

  it("keeps one entry per client", () => {
    const map = latestSubscriptionByClient([older, other, newer]);
    expect(map.size).toBe(2);
    expect(map.get("c2")?.id).toBe("other");
  });

  it("ignores subscriptions starting after asOf", () => {
    const map = latestSubscriptionByClient(
      [older, newer],
      new Date("2025-12-31T00:00:00Z"),
    );
    expect(map.get("c1")?.id).toBe("old");
  });

  it("findLatestSubscription returns undefined for unknown clients", () => {
    expect(findLatestSubscription([older], "nope")).toBeUndefined();
    expect(findLatestSubscription([newer, older], "c1")?.id).toBe("new");
  });
});

describe("collections plan filter (PRD-024 FR-1.2)", () => {
  const plans = [
    { id: "plus-v3", name: "PLUS" },
    { id: "plus-v2", name: "PLUS" },
    { id: "starter-v1", name: "STARTER" },
  ];

  it("sends a plan version some store is subscribed to", () => {
    const subs = [{ plan: "PLUS", planId: "plus-v2" } as Subscription];
    expect(collectionsPlanIdForTier("PLUS", subs, plans)).toBe("plus-v2");
  });

  it("falls back to any version of the tier, or null", () => {
    expect(collectionsPlanIdForTier("STARTER", [], plans)).toBe("starter-v1");
    expect(collectionsPlanIdForTier("ENTERPRISE", [], plans)).toBeNull();
  });
});
