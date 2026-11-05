import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../../../types";
import { atRiskReasonsOf, matchesStoresTab, readStoresTabUrl, storesTabEnum } from "./stores-tabs.util";

const client = (patch: Partial<Client>): Client =>
  ({ id: "c", storeName: "Nahara", status: "active", revenue: 0, health: { score: 90, factors: [] }, ...patch }) as Client;

const sub = (patch: Partial<Subscription>): Subscription =>
  ({ id: "s", clientId: "c", status: "ACTIVE", renewalDate: "2026-11-15", amountDue: 0, mrr: 2999, ...patch }) as Subscription;

describe("stores tabs: v2 tabs", () => {
  it("puts live, in setup (set up or trial) and paused stores in their tabs", () => {
    const live = client({ liveAt: "2026-10-01" });
    const setup = client({});
    const trial = client({ subscriptionStatus: "TRIAL" });
    const paused = client({ tenantStatus: "SUSPENDED" });
    expect(matchesStoresTab(storesTabEnum.LIVE, live, undefined, false)).toBe(true);
    expect(matchesStoresTab(storesTabEnum.IN_SETUP, setup, undefined, false)).toBe(true);
    expect(matchesStoresTab(storesTabEnum.IN_SETUP, trial, undefined, false)).toBe(true);
    expect(matchesStoresTab(storesTabEnum.IN_SETUP, live, undefined, false)).toBe(false);
    expect(matchesStoresTab(storesTabEnum.PAUSED, paused, undefined, false)).toBe(true);
  });

  it("puts trials, money owed, past due and warning signs in At risk, sliced by reason", () => {
    const trial = client({ subscriptionStatus: "TRIAL" });
    const owed = client({ liveAt: "2026-10-01" });
    const owedSub = sub({ amountDue: 2999 });
    expect(atRiskReasonsOf(trial, undefined, false)).toEqual(["trial"]);
    expect(atRiskReasonsOf(owed, owedSub, true)).toEqual(["unpaid", "signals"]);
    expect(matchesStoresTab(storesTabEnum.AT_RISK, owed, owedSub, false)).toBe(true);
    expect(matchesStoresTab(storesTabEnum.AT_RISK, owed, owedSub, false, ["trial"])).toBe(false);
    expect(matchesStoresTab(storesTabEnum.AT_RISK, client({ liveAt: "2026-10-01" }), undefined, false)).toBe(false);
  });
});

describe("stores tabs: older links", () => {
  it("reads Trial, Unpaid, Suspended and the At risk view into the new tabs", () => {
    expect(readStoresTabUrl({ tab: "trial" })).toMatchObject({ tab: "at-risk", why: ["trial"], legacy: true });
    expect(readStoresTabUrl({ tab: "unpaid" })).toMatchObject({ tab: "at-risk", why: ["unpaid"] });
    expect(readStoresTabUrl({ status: "unpaid" })).toMatchObject({ tab: "at-risk", why: ["unpaid"], unpaidStatus: true });
    expect(readStoresTabUrl({ tab: "suspended" })).toMatchObject({ tab: "paused", legacy: true });
    expect(readStoresTabUrl({ view: "at-risk" })).toMatchObject({ tab: "at-risk", why: ["signals"], atRiskView: true });
    expect(readStoresTabUrl({ tab: "trials-week" })).toMatchObject({ tab: "at-risk", renewsWithinWeek: true });
    expect(readStoresTabUrl({ tab: "overdue" })).toMatchObject({ tab: "all", overdue: true });
  });

  it("keeps Set up as In setup and opens Deleted", () => {
    expect(readStoresTabUrl({ tab: "setup" })).toMatchObject({ tab: "setup", legacy: false });
    expect(readStoresTabUrl({ tab: "deleted" })).toMatchObject({ deleted: true });
    expect(readStoresTabUrl({ tab: "at-risk", why: "trial,nope" })).toMatchObject({ tab: "at-risk", why: ["trial"] });
  });
});
