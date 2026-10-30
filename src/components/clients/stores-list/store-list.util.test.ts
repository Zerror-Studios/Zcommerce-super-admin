import { describe, expect, it } from "vitest";
import type { Client, Subscription } from "../../../types";
import { compareNeedsAction, paymentBadge, reminderForToday, storeStatusBadge } from "./store-list.util";

const sub = (patch: Partial<Subscription>): Subscription =>
  ({ id: "s", clientId: "c", status: "ACTIVE", renewalDate: "2026-11-15", amountDue: 0, mrr: 2999, ...patch }) as Subscription;

const state = (label: string, tone: "success" | "warning" | "danger" | "info" | "neutral", detail: string | null = null) => ({
  paymentState: { label, tone, detail },
});

const client = (patch: Partial<Client>): Client =>
  ({ id: "c", storeName: "Nahara", status: "active", revenue: 0, health: { score: 90, factors: [] }, ...patch }) as Client;

describe("stores list: payment badge", () => {
  it("shortens the server's badge to the S-02 words", () => {
    expect(paymentBadge(sub(state("Paid · 3 Oct", "success")), 7)).toMatchObject({ kind: "paid", label: "Paid" });
    expect(paymentBadge(sub(state("Due 15 Nov", "warning")), 7)).toMatchObject({ kind: "due", label: "Due 15 Nov" });
    expect(paymentBadge(sub(state("Trial", "info")), 7)).toMatchObject({ kind: "none", label: "No fee" });
    expect(paymentBadge(undefined, 7)).toMatchObject({ kind: "none", label: "No fee" });
    expect(paymentBadge(sub({ ...state("Paid", "success"), mrr: 0 }), 7)).toMatchObject({ kind: "none" });
  });

  it("reads an overdue payment inside the grace period as In grace with the days left", () => {
    const badge = paymentBadge(sub({ ...state("Overdue · 5 days", "danger", "Suspends on 20 Nov"), daysOverdue: 5 }), 7);
    expect(badge).toMatchObject({ kind: "grace", label: "In grace", tone: "warning", detail: "2 days left" });
  });

  it("reads a payment past the grace period as Overdue with the days overdue", () => {
    const badge = paymentBadge(sub({ ...state("Overdue · 9 days", "danger", "Past grace period"), daysOverdue: 9 }), 7);
    expect(badge).toMatchObject({ kind: "overdue", label: "Overdue", tone: "danger", detail: "9 days overdue" });
  });
});

describe("stores list: status and order", () => {
  it("uses the S-00b tones", () => {
    expect(storeStatusBadge(client({ subscriptionStatus: "TRIAL" }))).toEqual({ label: "Trial", tone: "neutral" });
    expect(storeStatusBadge(client({ subscriptionStatus: "PAST_DUE" }))).toEqual({ label: "Past due", tone: "danger" });
  });

  it("puts stores that need action first, then higher sales", () => {
    const rows = [
      { client: client({ id: "a", revenue: 900 }), payment: { kind: "paid" as const } },
      { client: client({ id: "b", revenue: 100 }), payment: { kind: "overdue" as const } },
      { client: client({ id: "c", revenue: 500 }), payment: { kind: "due" as const } },
      { client: client({ id: "d", revenue: 50, health: { score: 40, factors: [] } }), payment: { kind: "paid" as const } },
      { client: client({ id: "e", revenue: 1000 }), payment: { kind: "paid" as const } },
    ];
    expect(rows.sort(compareNeedsAction).map((row) => row.client.id)).toEqual(["b", "c", "d", "e", "a"]);
  });
});

describe("send reminder: which reminder matches today", () => {
  const reminders = { daysBeforeDue: [7, 1], daysAfterDue: [3], email: true, sms: false, whatsapp: false };
  it("is Reminder 1 before any time has passed, then the latest one that has", () => {
    expect(reminderForToday(reminders, 20)).toBe("Reminder 1 · 7 days before due");
    expect(reminderForToday(reminders, 1)).toBe("Reminder 2 · 1 day before due");
    expect(reminderForToday(reminders, -5)).toBe("Reminder 3 · 3 days after due");
  });
});
