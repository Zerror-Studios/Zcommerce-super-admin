import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../types";
import { platformBrief } from "./aiSamples";

const client = (id: string, score = 90): Client =>
  ({ id, storeName: `Store ${id}`, status: "active", health: { score, factors: [] } }) as unknown as Client;

const sub = (clientId: string, tone: "success" | "warning" | "danger", detail: string | null = null): Subscription =>
  ({ id: `s-${clientId}`, clientId, status: "ACTIVE", renewalDate: "2026-10-01", paymentState: { label: "x", tone, detail } }) as unknown as Subscription;

describe("platform brief", () => {
  it("is null when every store is paid and healthy", () => {
    expect(platformBrief({ clients: [client("a")], subscriptions: [sub("a", "success")] })).toBeNull();
  });

  it("puts the most urgent line first and leads with the overdue action", () => {
    const brief = platformBrief({
      clients: [client("a"), client("b"), client("c", 30)],
      subscriptions: [sub("a", "danger", "Past grace period"), sub("b", "warning"), sub("c", "success")],
    });
    expect(brief?.lines.map((line) => line.what)).toEqual([
      "Decide on 1 store past the grace period",
      "Send reminders for 1 payment due soon",
      "Check in with 1 store with critical health",
    ]);
    expect(brief?.actions[0].href).toBe("/stores?tab=overdue");
  });
});
