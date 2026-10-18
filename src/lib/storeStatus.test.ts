import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../types";
import { graceDaysFor, paymentState, storeLifecycle } from "./storeStatus";

const client = (status: Client["status"], gracePeriodDays?: number): Client => ({ id: "a", status, gracePeriodDays }) as Client;

describe("store status", () => {
  it("maps lifecycle", () => {
    expect(storeLifecycle(client("active")).label).toBe("Live");
    expect(storeLifecycle(client("suspended")).tone).toBe("danger");
  });
  it("shows the server's payment badge and 'No plan' without a subscription", () => {
    const sub = { paymentState: { label: "Overdue · 3 days", tone: "danger", detail: "Suspends on 19 Oct" } } as Subscription;
    expect(paymentState(sub)).toEqual({ label: "Overdue · 3 days", tone: "danger", detail: "Suspends on 19 Oct" });
    expect(paymentState(undefined).label).toBe("No plan");
  });
  it("prefers the store's grace override", () => {
    expect(graceDaysFor(client("active", 10), 3)).toBe(10);
    expect(graceDaysFor(client("active"), 3)).toBe(3);
  });
});
