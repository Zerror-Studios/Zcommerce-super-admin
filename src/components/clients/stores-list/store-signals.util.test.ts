import { describe, expect, it } from "vitest";
import type { Client } from "../../../types";
import {
  EMPTY_SERVER_PARAMS,
  countServerFilters,
  profileFilterOptions,
  readServerParams,
  storeExportRow,
  toServerFilter,
  writeServerParams,
  type StoreSignal,
} from "./store-signals.util";
import { fetchAllStoreSignals } from "./use-store-signals";

const signal = (id: string, profile: Partial<NonNullable<StoreSignal["profile"]>> = {}): StoreSignal => ({
  id,
  lifecycleStatus: "LIVE",
  riskScore: 3,
  riskReasons: ["OVERDUE_PAST_GRACE"],
  profile: {
    category: null,
    source: null,
    city: null,
    state: null,
    tags: [],
    accountManager: null,
    ...profile,
  },
});

describe("Stores server filters (PRD-026 guide §6)", () => {
  it("reads every saved view, and development as in-development", () => {
    expect(toServerFilter(readServerParams({ view: "at-risk" }))).toEqual({ atRisk: true });
    expect(toServerFilter(readServerParams({ view: "overdue" }))).toEqual({ overdue: true });
    expect(toServerFilter(readServerParams({ view: "dormant" }))).toEqual({ dormant: true });
    expect(toServerFilter(readServerParams({ view: "in-development" }))).toEqual({
      lifecycleStatus: ["DEVELOPMENT"],
    });
    expect(readServerParams({ view: "development" }).view).toBe("in-development");
    expect(toServerFilter(readServerParams({ view: "churned" }))).toEqual({ lifecycleStatus: ["CHURNED"] });
    expect(readServerParams({ view: "nope" }).view).toBe("");
  });

  it("builds the filter from the URL, merging a view with the drawer", () => {
    const params = readServerParams({
      view: "churned",
      lifecycle: "grace,bogus",
      category: "Fashion",
      city: " Pune ",
      manager: "u1",
      tag: "vip,b2b",
      age: "UNDER_3M,X",
      signal: "overdue,dormant",
    });
    expect(toServerFilter(params)).toEqual({
      lifecycleStatus: ["CHURNED", "GRACE"],
      categories: ["Fashion"],
      city: "Pune",
      accountManagerIds: ["u1"],
      tags: ["vip", "b2b"],
      ageBands: ["UNDER_3M"],
      overdue: true,
      dormant: true,
    });
    expect(countServerFilters(params)).toBe(7);
    expect(toServerFilter(EMPTY_SERVER_PARAMS)).toBeNull();
    expect(readServerParams(writeServerParams(params) as Record<string, string>)).toEqual(params);
  });

  it("offers cities, states, tags and managers from the stores' profiles", () => {
    const options = profileFilterOptions([
      signal("a", { city: "Pune", tags: ["vip"], accountManager: { id: "u1", name: "Rohit" } }),
      signal("b", { city: "Delhi", state: "DL", tags: ["vip", "b2b"] }),
      signal("c", { city: " " }),
    ]);
    expect(options.cities).toEqual(["Delhi", "Pune"]);
    expect(options.states).toEqual(["DL"]);
    expect(options.tags).toEqual(["b2b", "vip"]);
    expect(options.managers).toEqual([{ value: "u1", label: "Rohit" }]);
  });

  it("pages 100 at a time until totalCount", async () => {
    const offsets: number[] = [];
    const all = Array.from({ length: 230 }, (_, i) => signal(`s${i}`));
    const result = await fetchAllStoreSignals(async (offset) => {
      offsets.push(offset);
      return { items: all.slice(offset, offset + 100), totalCount: all.length };
    });
    expect(offsets).toEqual([0, 100, 200]);
    expect(result.items).toHaveLength(230);
    expect(result.truncated).toBe(false);
  });

  it("writes an export row with the lifecycle, risk and profile", () => {
    const client = { storeName: "Nahara", slug: "nahara", domain: "nahara.in", plan: "PLUS", mrr: 4999, revenue: 120000 } as Client;
    const row = storeExportRow(client, signal("x", { city: "Pune", tags: ["vip", "b2b"] }));
    expect(row).toMatchObject({
      store: "Nahara",
      lifecycle: "Live",
      riskScore: 3,
      riskReasons: "Overdue past grace",
      city: "Pune",
      tags: "vip; b2b",
      monthlyFee: 4999,
    });
    expect(storeExportRow(client, undefined)).toMatchObject({ lifecycle: "", riskScore: "" });
  });
});
