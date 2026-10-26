import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../types";
import {
  daysUntilDue,
  graceDaysFor,
  normaliseLifecycleKey,
  paymentState,
  storeLifecycle,
  storeLifecycleKey,
} from "./storeStatus";

const client = (status: Client["status"], gracePeriodDays?: number): Client => ({ id: "a", status, gracePeriodDays }) as Client;

describe("store status", () => {
  it("maps lifecycle (PRD-024 D4: Live = liveAt)", () => {
    expect(storeLifecycle({ ...client("active"), liveAt: "2026-10-01T00:00:00Z" }).label).toBe("Live");
    expect(storeLifecycle(client("active")).label).toBe("Set up");
    expect(storeLifecycle({ ...client("active"), subscriptionStatus: "ACTIVE" }).label).toBe("Set up");
    expect(storeLifecycle({ ...client("trial"), subscriptionStatus: "TRIAL" }).label).toBe("Trial");
    expect(storeLifecycle({ ...client("active"), subscriptionStatus: "PAST_DUE" }).label).toBe("Past due");
    expect(storeLifecycle({ ...client("active"), subscriptionStatus: "CANCELLED" }).label).toBe("Cancelled");
    expect(storeLifecycle(client("suspended")).tone).toBe("danger");
    // A live store that is suspended shows Suspended, not Live.
    expect(storeLifecycleKey({ ...client("suspended"), liveAt: "2026-10-01T00:00:00Z" })).toBe("suspended");
    // A live store keeps "Live" while its payment is past due (the payment badge says so).
    expect(storeLifecycleKey({ ...client("active"), liveAt: "2026-10-01", subscriptionStatus: "PAST_DUE" })).toBe("live");
    // PRD-018: a deleted store in its grace period
    expect(storeLifecycle({ ...client("suspended"), tenantStatus: "DELETED" }).label).toBe("Deleted");
  });
  it("reads the legacy status=active filter as Live", () => {
    expect(normaliseLifecycleKey("active")).toBe("live");
    expect(normaliseLifecycleKey("past_due")).toBe("past_due");
    expect(normaliseLifecycleKey("bogus")).toBeUndefined();
  });
  it("shows the server's payment badge and 'No plan' without a subscription", () => {
    const sub = { paymentState: { label: "Overdue · 3 days", tone: "danger", detail: "Suspends on 19 Oct" } } as Subscription;
    expect(paymentState(sub)).toEqual({ label: "Overdue · 3 days", tone: "danger", detail: "Suspends on 19 Oct" });
    expect(paymentState(undefined).label).toBe("No plan");
  });
  it("takes overdue days from the server, never from the renewal date (PRD-024 FR-1.7)", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(daysUntilDue({ renewalDate: "2026-10-01", daysOverdue: 4 } as Subscription, now)).toBe(-4);
    expect(daysUntilDue({ renewalDate: "2026-10-01", daysOverdue: 0 } as Subscription, now)).toBe(0);
    expect(daysUntilDue({ renewalDate: "2026-10-27", daysOverdue: 0 } as Subscription, now)).toBe(7);
  });
  it("prefers the store's grace override", () => {
    expect(graceDaysFor(client("active", 10), 3)).toBe(10);
    expect(graceDaysFor(client("active"), 3)).toBe(3);
  });
});
