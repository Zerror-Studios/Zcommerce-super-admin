import { describe, expect, it } from "vitest";
import {
  activityIconKey,
  activityWhen,
  greetingName,
  healthSummary,
  heroChips,
  heroSummary,
  pastDueOf,
  storeCounts,
  summaryCells,
  type SummaryInput,
} from "./sa-home.util";
import type { Client } from "../types";
import type { PlatformMetric } from "../types/platform-insights";

const metric = (key: string, patch: Partial<PlatformMetric> = {}): PlatformMetric => ({
  key,
  label: key,
  unit: "COUNT",
  value: 1,
  previousValue: null,
  changePercent: null,
  status: "OK",
  count: null,
  names: null,
  reason: null,
  fix: null,
  definition: "",
  formula: "",
  ...patch,
});

const client = (id: string, patch: Partial<Client> = {}): Client =>
  ({ id, storeName: id, status: "active", ...patch }) as Client;

const baseInput = (patch: Partial<SummaryInput> = {}): SummaryInput => ({
  gmv: metric("gmv", { unit: "CURRENCY", value: 154215 }),
  orders: metric("orders", { value: 190 }),
  activeStores: 3,
  mrr: metric("mrr", { unit: "CURRENCY", value: 0, count: 0 }),
  collected: metric("collected", { unit: "CURRENCY", value: 2500 }),
  pastDue: { count: 1, amount: 999 },
  health: healthSummary([]),
  totalStores: 3,
  uptime: metric("uptimePct", { status: "UNAVAILABLE", value: null, reason: "Not monitored yet" }),
  checkoutFailures: metric("checkoutFailures7d", { value: 4, count: 2 }),
  paymentFailures: metric("paymentFailures7d", { value: 1 }),
  metricsError: false,
  ...patch,
});

describe("SA Home (design v2 §7)", () => {
  it("greets by first name, else the studio", () => {
    expect(greetingName("Mehak Arora")).toBe("Mehak");
    expect(greetingName("  ")).toBe("Zerror Studios");
    expect(greetingName(undefined)).toBe("Zerror Studios");
  });

  it("counts stores and live ones without deleted stores", () => {
    expect(
      storeCounts([
        client("a", { liveAt: "2026-01-01" }),
        client("b"),
        client("c", { tenantStatus: "DELETED" }),
      ]),
    ).toEqual({ total: 2, live: 1 });
  });

  it("reads past due from the overdue rows of money due", () => {
    expect(pastDueOf(null)).toBeNull();
    const rows = [
      { tenantId: "a", name: "A", slug: "a", amount: 500, dueAt: "", daysOverdue: 3, invoiceCount: 1, overdue: true },
      { tenantId: "b", name: "B", slug: "b", amount: 200, dueAt: "", daysOverdue: 0, invoiceCount: 1, overdue: false },
    ];
    expect(pastDueOf({ total: 700, storeCount: 2, items: rows })).toEqual({ count: 1, amount: 500 });
  });

  it("builds the chips: red dot for past due, arrow only for a change", () => {
    const chips = heroChips({
      stores: { total: 3, live: 2 },
      gmv: metric("gmv", { unit: "CURRENCY", changePercent: 48.7 }),
      pastDue: { count: 1, amount: 500 },
    });
    expect(chips.map((chip) => [chip.key, chip.trend])).toEqual([
      ["stores", "flat"],
      ["gmv", "up"],
      ["past-due", "down"],
    ]);
    expect(chips[1].value).toBe("48.7%");
    expect(chips[2].value).toBeUndefined();
    expect(heroChips({ stores: null, gmv: metric("gmv", { status: "UNAVAILABLE", value: null }), pastDue: null })).toEqual([]);
  });

  it("writes the hero line from the counts", () => {
    expect(heroSummary({ pastDue: { count: 1, amount: 1 }, atRisk: 2, inSetup: 0 })).toBe(
      "This week: 1 payment past due and 2 stores at risk.",
    );
    expect(heroSummary({ pastDue: null, atRisk: 0, inSetup: 0 })).toMatch(/^Nothing needs you today/);
  });

  it("averages the scored stores' health", () => {
    const summary = healthSummary([
      client("Kesar", { health: { score: 94, factors: [] } }),
      client("Nahara", { health: { score: 48, factors: [] } }),
      client("deveshe", { health: { score: 60, factors: [] } }),
      client("unscored"),
    ]);
    expect(summary.average).toBe(67);
    expect(summary.rows.map((row) => row.name)).toEqual(["Kesar", "deveshe", "Nahara"]);
  });

  it("tints Subscriptions red with a payment past due and falls back from uptime to checkout failures", () => {
    const cells = summaryCells(baseInput());
    expect(cells.map((cell) => cell.key)).toEqual(["gmv", "subscriptions", "health", "uptime"]);
    expect(cells[0].note).toBe("190 orders across 3 stores");
    expect(cells[1].tone).toBe("danger");
    expect(cells[1].note).toBe("0 paying · 1 past due");
    expect(cells[2].value).toBe("—");
    expect(cells[3].label).toBe("Checkout failures · 7 days");
    expect(cells[3].value).toBe("4");
    expect(cells[3].tone).toBe("danger");

    const clear = summaryCells(baseInput({ pastDue: { count: 0, amount: 0 }, mrr: null }));
    expect(clear[1].tone).toBe("default");
    expect(clear[1].note).toBe("Needs billing access");

    const monitored = summaryCells(baseInput({ uptime: metric("uptimePct", { unit: "PERCENT", value: 99.98 }) }));
    expect(monitored[3].label).toBe("Uptime");
    expect(monitored[3].value).toBe("99.98%");
  });

  it("picks an activity tile by action area and dates it", () => {
    expect(activityIconKey("tenant.suspend")).toBe("store");
    expect(activityIconKey("invoice.void")).toBe("billing");
    expect(activityIconKey("something")).toBe("other");
    const now = new Date(2026, 10, 5, 12, 0);
    expect(activityWhen(new Date(2026, 10, 4, 18, 0).toISOString(), now)).toBe("Yesterday");
    expect(activityWhen(new Date(2026, 10, 2, 9, 0).toISOString(), now)).toBe("2 Nov");
    expect(activityWhen("nope", now)).toBe("—");
  });
});
