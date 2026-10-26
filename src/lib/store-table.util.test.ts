import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../types";
import {
  compareByHealthThenDue,
  healthBandOf,
  isStoreTab,
  joinParam,
  matchesFilters,
  matchesTab,
  splitParam,
} from "./store-table.util";

const NOW = new Date("2026-10-24T00:00:00Z");

const client = (id: string, status: Client["status"], score: number, plan = "STARTER"): Client =>
  ({ id, status, plan, health: { score, factors: [] } }) as unknown as Client;

const sub = (clientId: string, renewalDate: string, tone: "success" | "danger" = "success"): Subscription =>
  ({
    id: `s-${clientId}`,
    clientId,
    status: "ACTIVE",
    renewalDate,
    amountDue: 0,
    paymentState: { label: tone === "danger" ? "Overdue · 3 days" : "Paid", tone, detail: null },
  }) as unknown as Subscription;

describe("store table", () => {
  it("knows its tabs, including the saved views", () => {
    expect(isStoreTab("overdue")).toBe(true);
    expect(isStoreTab("trials-week")).toBe(true);
    expect(isStoreTab("nope")).toBe(false);
  });

  it("saved views: overdue and trials ending this week", () => {
    expect(matchesTab("overdue", client("a", "active", 90), sub("a", "2026-10-01", "danger"), NOW)).toBe(true);
    expect(matchesTab("overdue", client("a", "active", 90), sub("a", "2026-11-01"), NOW)).toBe(false);
    expect(matchesTab("trials-week", client("b", "trial", 90), sub("b", "2026-10-28"), NOW)).toBe(true);
    expect(matchesTab("trials-week", client("b", "trial", 90), sub("b", "2026-11-20"), NOW)).toBe(false);
    expect(matchesTab("trials-week", client("b", "active", 90), sub("b", "2026-10-28"), NOW)).toBe(false);
  });

  it("filters by plan, status, health band and overdue", () => {
    const store = client("a", "active", 40, "PLUS");
    const filters = { plans: [], statuses: [], health: [], overdue: false };
    expect(healthBandOf(store)).toBe("critical");
    expect(matchesFilters({ ...filters, plans: ["PLUS"] }, store, undefined)).toBe(true);
    expect(matchesFilters({ ...filters, plans: ["STARTER"] }, store, undefined)).toBe(false);
    expect(matchesFilters({ ...filters, health: ["healthy"] }, store, undefined)).toBe(false);
    expect(matchesFilters({ ...filters, overdue: true }, store, sub("a", "2026-10-01", "danger"))).toBe(true);
  });

  it("tabs and the status filter follow the lifecycle (PRD-024 D4)", () => {
    const live = { ...client("a", "active", 90), liveAt: "2026-10-01", subscriptionStatus: "ACTIVE" } as Client;
    const setUp = { ...client("b", "active", 90), subscriptionStatus: "ACTIVE" } as Client;
    const pastDue = { ...client("c", "active", 90), subscriptionStatus: "PAST_DUE" } as Client;
    expect(matchesTab("live", live, undefined, NOW)).toBe(true);
    expect(matchesTab("live", setUp, undefined, NOW)).toBe(false);
    expect(matchesTab("setup", setUp, undefined, NOW)).toBe(true);
    const filters = { plans: [], statuses: ["past_due"], health: [], overdue: false };
    expect(matchesFilters(filters, pastDue, undefined)).toBe(true);
    expect(matchesFilters(filters, live, undefined)).toBe(false);
    // Older links: status=active means Live.
    expect(matchesFilters({ ...filters, statuses: ["active"] }, live, undefined)).toBe(true);
    expect(matchesFilters({ ...filters, statuses: ["active"] }, setUp, undefined)).toBe(false);
  });

  it("filters plans by version id, and by tier for older links (PRD-024 FR-1.3)", () => {
    const store = {
      ...client("a", "active", 90, "PLUS"),
      planRef: { id: "plan-plus-v2", version: 2, displayName: "Plus", custom: false, limits: { products: null, staff: null } },
    } as Client;
    const filters = { plans: ["plan-plus-v2"], statuses: [], health: [], overdue: false };
    expect(matchesFilters(filters, store, undefined)).toBe(true);
    expect(matchesFilters({ ...filters, plans: ["plan-plus-v1"] }, store, undefined)).toBe(false);
    expect(matchesFilters({ ...filters, plans: ["PLUS"] }, store, undefined)).toBe(true);
  });

  it("sorts by health, then the earliest due date", () => {
    const subs = new Map([
      ["a", sub("a", "2026-11-10")],
      ["b", sub("b", "2026-11-01")],
    ]);
    const list = [client("a", "active", 50), client("b", "active", 50), client("c", "active", 20)];
    expect(list.sort((x, y) => compareByHealthThenDue(x, y, subs)).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("round-trips multi-value params", () => {
    expect(splitParam("a,b")).toEqual(["a", "b"]);
    expect(joinParam([])).toBeUndefined();
  });
});
