import { describe, expect, it } from "vitest";
import { legacyAiRedirect, legacyBillingRedirect, legacySubscriptionStoreRedirect } from "./legacy-routes.util";

describe("old billing addresses (04 S-00)", () => {
  it("sends every billing page to Subscriptions with the period", () => {
    expect(legacyBillingRedirect("subscriptions", "?from=2026-10-01&to=2026-10-31&show=overdue")).toBe(
      "/subscriptions?from=2026-10-01&to=2026-10-31",
    );
    expect(legacyBillingRedirect(undefined, "")).toBe("/subscriptions");
  });

  it("maps invoice statuses", () => {
    expect(legacyBillingRedirect("invoices", "?status=OVERDUE")).toBe("/subscriptions?tab=due");
    expect(legacyBillingRedirect("invoices", "?status=ISSUED&from=2026-10-01")).toBe("/subscriptions?from=2026-10-01&tab=due");
    expect(legacyBillingRedirect("invoices", "?status=PAID")).toBe("/subscriptions?payment=paid");
    expect(legacyBillingRedirect("invoices", "?status=VOID")).toBe("/subscriptions");
    expect(legacyBillingRedirect("invoices", "?status=REFUNDED")).toBe("/subscriptions");
  });

  it("maps transaction views and statuses", () => {
    expect(legacyBillingRedirect("transactions", "?view=flagged")).toBe("/subscriptions?issue=flagged");
    expect(legacyBillingRedirect("transactions", "?view=stuck")).toBe("/subscriptions?issue=stuck");
    expect(legacyBillingRedirect("transactions", "?status=success")).toBe("/subscriptions?payment=paid");
    expect(legacyBillingRedirect("flagged", "")).toBe("/subscriptions?issue=flagged");
  });

  it("sends reminders to Due & overdue", () => {
    expect(legacyBillingRedirect("reminders", "")).toBe("/subscriptions?tab=due");
  });

  it("opens a store's billing for ?store=", () => {
    expect(legacySubscriptionStoreRedirect("?store=t-1")).toBe("/stores/t-1/billing?from=subscriptions");
    expect(legacySubscriptionStoreRedirect("?tab=due")).toBeNull();
  });
});

describe("old ZCOM AI addresses (04 S-00)", () => {
  it("maps overview and usage views to tabs", () => {
    expect(legacyAiRedirect("overview", "")).toBe("/ai");
    expect(legacyAiRedirect("usage", "")).toBe("/ai?tab=usage");
    expect(legacyAiRedirect("usage", "?view=top-ups")).toBe("/ai?tab=top-ups");
    expect(legacyAiRedirect("usage", "?view=data-health")).toBe("/ai?tab=data-health");
    expect(legacyAiRedirect("usage", "?view=benchmarks&q=acme")).toBe("/ai?q=acme&tab=benchmarks");
    expect(legacyAiRedirect("benchmarks", "")).toBe("/ai?tab=benchmarks");
  });
});
