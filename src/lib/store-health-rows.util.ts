/**
 * Store page › Store health (round 2 §6.3, board 60): the ring and five rows,
 * each with a Good / Failing / Stale chip and the fact behind it on the right.
 *
 *   Setup complete     11 of 11              (setup checks, platformStoreSetup)
 *   Selling regularly  190 orders · 30d      (usage snapshot + the server's order factor)
 *   Team signs in      6 sign-ins · 30d      (health snapshot logins30d)
 *   Payments           99 failed · Nimbbl retiring (health snapshot, healthIssues)
 *   Google Analytics   Last sync 27 Oct      (the store's analytics app; stale after 3 days)
 *
 * Health includes setup and payments (D11): a store with setup 4 of 11 or a
 * retiring payment app never reads "all Good". Pure; every fact is passed in.
 */

import { formatDate } from "../components/ui/format-date";
import type { Tone } from "../components/ui/tones";

export interface StoreHealthRow {
  key: "setup" | "selling" | "team" | "payments" | "analytics";
  label: string;
  /** Good, Failing, Stale, or "No data" when nothing was collected. */
  word: string;
  tone: Tone;
  detail: string;
}

export interface StoreHealthFacts {
  setup: { done: number; total: number } | null;
  /** The usage snapshot was taken (orders30d is real). */
  measured: boolean;
  orders30d: number;
  /** The server's order factor tone ("Low order volume" → warning). */
  ordersTone?: Tone | null;
  logins30d: number | null | undefined;
  staffCount?: number | null;
  paymentFailures7d: number | null | undefined;
  unpaidExpiries30d: number | null | undefined;
  /** The server's payment issues (healthIssues: "Payment app Nimbbl is being retired", …). */
  paymentIssues: string[];
  /** undefined: no analytics app; null: never synced; else the last successful sync. */
  analyticsLastSync: string | null | undefined;
  now?: Date;
}

/** Google Analytics counts as stale after this many days (the backend's ANALYTICS_STALE_DAYS). */
export const ANALYTICS_STALE_DAYS = 3;
/** Expired unpaid orders in 30 days that mark payments as failing (the backend's EXPIRED_UNPAID_ALERT). */
export const EXPIRED_UNPAID_ALERT = 5;

const GOOD = { word: "Good", tone: "success" as Tone };
const FAILING = { word: "Failing", tone: "danger" as Tone };
const STALE = { word: "Stale", tone: "warning" as Tone };
const NO_DATA = { word: "No data", tone: "neutral" as Tone };

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en-IN")} ${count === 1 ? one : many}`;

/** Parses "Setup 4 of 11" from the server's health issues, when the setup checks aren't loaded. */
export function setupFromIssues(issues: readonly string[]): { done: number; total: number } | null {
  for (const issue of issues) {
    const match = /^setup\D*(\d+)\s+of\s+(\d+)/i.exec(issue);
    if (match) return { done: Number(match[1]), total: Number(match[2]) };
  }
  return null;
}

export function storeHealthRows(facts: StoreHealthFacts): StoreHealthRow[] {
  const now = facts.now ?? new Date();
  const rows: StoreHealthRow[] = [];

  // Setup complete
  const setup = facts.setup;
  rows.push(
    !setup || setup.total === 0
      ? { key: "setup", label: "Setup complete", ...NO_DATA, detail: "Not checked yet" }
      : { key: "setup", label: "Setup complete", ...(setup.done >= setup.total ? GOOD : FAILING), detail: `${setup.done} of ${setup.total}` },
  );

  // Selling regularly
  if (!facts.measured) {
    rows.push({ key: "selling", label: "Selling regularly", ...NO_DATA, detail: "No usage snapshot yet" });
  } else if (facts.orders30d <= 0) {
    rows.push({ key: "selling", label: "Selling regularly", ...FAILING, detail: "No orders in 30 days" });
  } else {
    const slow = facts.ordersTone === "warning" || facts.ordersTone === "danger";
    rows.push({ key: "selling", label: "Selling regularly", ...(slow ? STALE : GOOD), detail: `${plural(facts.orders30d, "order", "orders")} · 30d` });
  }

  // Team signs in
  if (facts.logins30d == null) {
    rows.push({ key: "team", label: "Team signs in", ...NO_DATA, detail: "Not collected yet" });
  } else {
    const team = facts.staffCount ? ` · ${plural(facts.staffCount, "person", "people")} on the team` : "";
    rows.push(
      facts.logins30d > 0
        ? { key: "team", label: "Team signs in", ...GOOD, detail: `${plural(facts.logins30d, "sign-in", "sign-ins")} · 30d${team}` }
        : { key: "team", label: "Team signs in", ...STALE, detail: "No sign-ins in 30 days" },
    );
  }

  // Payments
  const failed = facts.paymentFailures7d ?? 0;
  const expired = facts.unpaidExpiries30d ?? 0;
  const paymentParts = [
    failed > 0 ? `${plural(failed, "failed", "failed")} · 7d` : null,
    expired >= EXPIRED_UNPAID_ALERT ? `${plural(expired, "unpaid order", "unpaid orders")} expired` : null,
    ...facts.paymentIssues.filter((issue) => !/^setup\b/i.test(issue) && !/unpaid/i.test(issue)),
  ].filter((part): part is string => Boolean(part));
  if (paymentParts.length) {
    rows.push({ key: "payments", label: "Payments", ...FAILING, detail: paymentParts.join(" · ") });
  } else if (facts.paymentFailures7d == null && facts.unpaidExpiries30d == null) {
    rows.push({ key: "payments", label: "Payments", ...NO_DATA, detail: "Not collected yet" });
  } else {
    rows.push({ key: "payments", label: "Payments", ...GOOD, detail: "No failed payments" });
  }

  // Google Analytics
  if (facts.analyticsLastSync === undefined) {
    rows.push({ key: "analytics", label: "Google Analytics", ...NO_DATA, detail: "Not connected" });
  } else if (facts.analyticsLastSync === null) {
    rows.push({ key: "analytics", label: "Google Analytics", ...FAILING, detail: "Never synced" });
  } else {
    const last = new Date(facts.analyticsLastSync);
    const days = Number.isNaN(last.getTime()) ? Infinity : (now.getTime() - last.getTime()) / 86_400_000;
    rows.push({
      key: "analytics",
      label: "Google Analytics",
      ...(days > ANALYTICS_STALE_DAYS ? STALE : GOOD),
      detail: `Last sync ${formatDate(last, now)}`,
    });
  }

  return rows;
}

/** "Healthy, with two things slipping" under the card title. */
export function storeHealthLine(bandLabel: string, rows: readonly StoreHealthRow[]): string {
  const slipping = rows.filter((row) => row.tone === "danger" || row.tone === "warning").length;
  if (slipping === 0) return `${bandLabel}. Everything checked is good.`;
  const words = ["", "one thing", "two things", "three things", "four things", "five things"];
  return `${bandLabel}, with ${words[slipping] ?? `${slipping} things`} slipping`;
}
