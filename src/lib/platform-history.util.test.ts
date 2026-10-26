import { describe, expect, it } from "vitest";
import type { PlatformMrrDay } from "../types/platform-api";
import {
  NOT_RECORDED_COPY,
  firstRecordedDay,
  formatDurationMs,
  invoiceActorLabel,
  jobRunLabel,
  jobRunStatusView,
  mrrByMonth,
  mrrHistoryWindow,
  paymentStatusCounts,
  reminderOffsetLabel,
  reminderResultView,
} from "./platform-history.util";

const day = (date: string, mrr: number, movement: Partial<PlatformMrrDay> = {}): PlatformMrrDay => ({
  date,
  mrr,
  payingStores: 2,
  newMrr: 0,
  expansionMrr: 0,
  contractionMrr: 0,
  churnedMrr: 0,
  byPlan: [],
  ...movement,
});

const months = [
  { key: "2026-08", label: "Aug 2026" },
  { key: "2026-09", label: "Sep 2026" },
  { key: "2026-10", label: "Oct 2026" },
];

describe("MRR history (PRD-024 FR-3.1)", () => {
  const days = [
    // The first recorded day has no movements (null), never 0.
    day("2026-09-20", 5000, { newMrr: null, expansionMrr: null, contractionMrr: null, churnedMrr: null }),
    day("2026-09-30", 6000, { newMrr: 1000 }),
    day("2026-10-01", 6000),
    day("2026-10-27", 5500, { churnedMrr: 500, payingStores: 1 }),
  ];

  it("shows months before the first snapshot as not recorded, never 0", () => {
    const [august] = mrrByMonth(days, months);
    expect(august).toMatchObject({ key: "2026-08", mrr: null, payingStores: null, newMrr: null, recordedDays: 0 });
    expect(NOT_RECORDED_COPY).toBe("Not recorded");
  });

  it("takes MRR from the month's last recorded day and sums its movements", () => {
    const [, september, october] = mrrByMonth(days, months);
    expect(september).toMatchObject({ mrr: 6000, newMrr: 1000, churnedMrr: 0, recordedDays: 2 });
    expect(october).toMatchObject({ mrr: 5500, payingStores: 1, churnedMrr: 500, recordedDays: 2 });
  });

  it("keeps a movement null when no recorded day had one", () => {
    const [, september] = mrrByMonth([days[0]], months);
    expect(september).toMatchObject({ mrr: 5000, newMrr: null, churnedMrr: null, recordedDays: 1 });
  });

  it("finds the first recorded day", () => {
    expect(firstRecordedDay([days[2], days[0]])).toBe("2026-09-20");
    expect(firstRecordedDay([])).toBeNull();
  });

  it("cuts the window to the server's 731 days", () => {
    const end = new Date(2026, 9, 27);
    expect(mrrHistoryWindow(new Date(2026, 4, 1), end)).toEqual({ from: "2026-05-01", to: "2026-10-27" });
    expect(mrrHistoryWindow(new Date(2020, 0, 1), end).from).toBe("2024-10-27");
  });
});

describe("payment counts by status (PRD-024 FR-3.5)", () => {
  it("reads the server counts and treats a missing status as 0", () => {
    expect(
      paymentStatusCounts([
        { status: "SUCCESS", count: 12 },
        { status: "FAILED", count: 2 },
      ]),
    ).toEqual({ success: 12, pending: 0, failed: 2, refunded: 0 });
    expect(paymentStatusCounts(undefined)).toEqual({ success: 0, pending: 0, failed: 0, refunded: 0 });
  });
});

describe("reminder log (PRD-024 FR-3.9)", () => {
  it("labels each server result", () => {
    expect(reminderResultView("SENT")).toEqual({ label: "Sent", tone: "success" });
    expect(reminderResultView("QUEUED")).toEqual({ label: "Queued", tone: "info" });
    expect(reminderResultView("NOT_SENT_NO_CHANNEL").label).toMatch(/^Not sent/);
    expect(reminderResultView("SOMETHING_NEW")).toEqual({ label: "SOMETHING_NEW", tone: "neutral" });
  });

  it("labels the SMS and WhatsApp results (FR-4.2.3)", () => {
    expect(reminderResultView("FAILED")).toEqual({ label: "Failed", tone: "danger" });
    expect(reminderResultView("NOT_SENT_NO_PHONE").label).toBe("Not sent · store has no owner phone");
    expect(reminderResultView("NOT_SENT_NOT_CONFIGURED").label).toBe("Not sent · channel not configured");
  });

  it("says when the reminder was due", () => {
    expect(reminderOffsetLabel(-3)).toBe("3 days before due");
    expect(reminderOffsetLabel(0)).toBe("On the due date");
    expect(reminderOffsetLabel(1)).toBe("1 day overdue");
  });
});

describe("job runs (PRD-024 FR-3.10)", () => {
  it("names jobs and statuses", () => {
    expect(jobRunLabel("usage-snapshot")).toBe("Usage snapshot");
    expect(jobRunLabel("usage_snapshot")).toBe("Usage snapshot");
    expect(jobRunLabel("new-job")).toBe("new-job");
    expect(jobRunStatusView("DONE_WITH_ERRORS")).toEqual({ label: "Done with errors", tone: "warning" });
  });

  it("formats durations, with none while running", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(850)).toBe("850 ms");
    expect(formatDurationMs(12_400)).toBe("12 s");
    expect(formatDurationMs(185_000)).toBe("3 min 5 s");
  });
});

describe("invoice history (PRD-024 FR-3.8)", () => {
  it("names automatic changes", () => {
    expect(invoiceActorLabel("system")).toBe("Zcom (automatic)");
    expect(invoiceActorLabel("ops@zerrorstudios.com")).toBe("ops@zerrorstudios.com");
  });
});
