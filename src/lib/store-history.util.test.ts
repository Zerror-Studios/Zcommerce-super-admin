import { describe, expect, it } from "vitest";
import type { TenantStatusEvent } from "../types/platform-api";
import {
  statusEventLabel,
  statusEventTone,
  statusHistoryRows,
  SYSTEM_ACTOR_LABEL,
} from "./store-history.util";

const EVENTS: TenantStatusEvent[] = [
  {
    kind: "CREATED",
    at: "2026-01-10T09:00:00.000Z",
    by: { id: "u1", name: "Asha" },
    category: null,
    reason: null,
    note: null,
    estimated: false,
  },
  {
    kind: "SUSPENDED",
    at: "2026-03-02T09:00:00.000Z",
    by: null,
    category: "BILLING",
    reason: "Invoice overdue",
    note: null,
    estimated: false,
  },
  {
    kind: "LIVE",
    at: "2026-02-01T09:00:00.000Z",
    by: null,
    category: null,
    reason: null,
    note: "From the liveAt field",
    estimated: true,
  },
];

describe("status history rows (PRD-025 FR-3.3, FR-6.2)", () => {
  it("lists newest first with a label and tone per kind", () => {
    const rows = statusHistoryRows(EVENTS);
    expect(rows.map((row) => row.kind)).toEqual(["SUSPENDED", "LIVE", "CREATED"]);
    expect(rows[0].label).toBe("Suspended");
    expect(rows[0].tone).toBe("warning");
    expect(rows[2].label).toBe("Created");
    expect(statusEventLabel("PURGED")).toBe("Purged");
    expect(statusEventTone("PURGED")).toBe("danger");
    expect(statusEventTone("SOMETHING_NEW")).toBe("neutral");
  });

  it("shows System when the server sends no actor, and the name otherwise", () => {
    const rows = statusHistoryRows(EVENTS);
    expect(rows[0].by).toBe(SYSTEM_ACTOR_LABEL);
    expect(rows[2].by).toBe("Asha");
  });

  it("carries the estimated marker only on inferred rows", () => {
    const rows = statusHistoryRows(EVENTS);
    expect(rows.find((row) => row.kind === "LIVE")?.estimated).toBe(true);
    expect(rows.find((row) => row.kind === "SUSPENDED")?.estimated).toBe(false);
  });

  it("puts the category label, reason and note in the details", () => {
    const rows = statusHistoryRows(EVENTS);
    expect(rows[0].details).toEqual(["Billing", "Invoice overdue"]);
    expect(rows[1].details).toEqual(["From the liveAt field"]);
    expect(rows[2].details).toEqual([]);
  });

  it("answers an empty list for no history", () => {
    expect(statusHistoryRows(undefined)).toEqual([]);
    expect(statusHistoryRows([])).toEqual([]);
  });
});
