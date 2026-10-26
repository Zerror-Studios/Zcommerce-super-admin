/**
 * zcom-super-admin — PRD-024 Phase C history reads
 *
 * Pure helpers for the server's recorded history: MRR days from the daily
 * snapshot job (FR-3.1, shown per month with "Not recorded" where the job
 * had not run yet), payment counts per status (FR-3.5), the reminder send
 * log (FR-3.9) and platform job runs (FR-3.10). Nothing is reconstructed
 * or invented here; a day the server has no row for stays empty.
 */

import type { Tone } from "../components/ui/tones";
import type {
  PlatformInvoiceStatus,
  PlatformMrrDay,
  PlatformStatusCount,
} from "../types/platform-api";

// ─── Constants ────────────────────────────────────────────────────────────

/** What a month or day before the first snapshot shows. */
export const NOT_RECORDED_COPY = "Not recorded";

/** The longest `platformMrrHistory` window the server accepts. */
export const MRR_HISTORY_MAX_DAYS = 731;

const MS_PER_DAY = 86_400_000;

// ─── Types ────────────────────────────────────────────────────────────────

export interface MrrMonthRow {
  /** YYYY-MM. */
  key: string;
  label: string;
  /** MRR on the month's last recorded day; null when no day was recorded. */
  mrr: number | null;
  payingStores: number | null;
  newMrr: number | null;
  expansionMrr: number | null;
  contractionMrr: number | null;
  churnedMrr: number | null;
  recordedDays: number;
}

export interface PaymentStatusCounts {
  success: number;
  pending: number;
  failed: number;
  refunded: number;
}

export interface ChipView {
  label: string;
  tone: Tone;
}

// ─── MRR history (FR-3.1) ─────────────────────────────────────────────────

function dayOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The `platformMrrHistory` window for a picker range: the range's own days,
 * cut to the server's 731-day maximum (the most recent days are kept).
 */
export function mrrHistoryWindow(startDate: Date, endDate: Date): { from: string; to: string } {
  const earliest = new Date(endDate.getTime() - (MRR_HISTORY_MAX_DAYS - 1) * MS_PER_DAY);
  const start = startDate.getTime() < earliest.getTime() ? earliest : startDate;
  return { from: dayOf(start), to: dayOf(endDate) };
}

/** A movement summed over the recorded days; null when no day had one. */
function sumMovement(days: readonly PlatformMrrDay[], pick: (day: PlatformMrrDay) => number | null): number | null {
  const values = days.map(pick).filter((value): value is number => value != null);
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
}

/**
 * One row per month of the revenue report: MRR at the month's last recorded
 * day and the month's movements. A month with no recorded day is "Not
 * recorded" (all null), never 0 and never rebuilt from today's subscriptions.
 */
export function mrrByMonth(
  days: readonly PlatformMrrDay[],
  months: readonly { key: string; label: string }[],
): MrrMonthRow[] {
  return months.map(({ key, label }) => {
    const inMonth = days
      .filter((day) => day.date.startsWith(key))
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = inMonth[inMonth.length - 1];
    return {
      key,
      label,
      mrr: last ? last.mrr : null,
      payingStores: last ? last.payingStores : null,
      newMrr: sumMovement(inMonth, (day) => day.newMrr),
      expansionMrr: sumMovement(inMonth, (day) => day.expansionMrr),
      contractionMrr: sumMovement(inMonth, (day) => day.contractionMrr),
      churnedMrr: sumMovement(inMonth, (day) => day.churnedMrr),
      recordedDays: inMonth.length,
    };
  });
}

/** The first recorded day, for "History starts on …"; null without any. */
export function firstRecordedDay(days: readonly PlatformMrrDay[]): string | null {
  if (days.length === 0) return null;
  return days.reduce((first, day) => (day.date < first ? day.date : first), days[0].date);
}

// ─── Payment counts (FR-3.5) ──────────────────────────────────────────────

/** The server's `countsByStatus` as console counts; a missing status reads 0. */
export function paymentStatusCounts(counts: readonly PlatformStatusCount[] | null | undefined): PaymentStatusCounts {
  const of = (status: string) => counts?.find((entry) => entry.status === status)?.count ?? 0;
  return {
    success: of("SUCCESS"),
    pending: of("PENDING"),
    failed: of("FAILED"),
    refunded: of("REFUNDED"),
  };
}

// ─── Reminder log (FR-3.9) ────────────────────────────────────────────────

const REMINDER_RESULTS: Record<string, ChipView> = {
  SENT: { label: "Sent", tone: "success" },
  QUEUED: { label: "Queued", tone: "info" },
  NOT_SENT_NO_CHANNEL: { label: "Not sent · no platform SMS or WhatsApp account", tone: "neutral" },
};

export function reminderResultView(result: string): ChipView {
  return REMINDER_RESULTS[result] ?? { label: result, tone: "neutral" };
}

const REMINDER_CHANNELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};

export function reminderChannelLabel(channel: string): string {
  return REMINDER_CHANNELS[channel] ?? channel;
}

/** "3 days before due" / "On the due date" / "2 days overdue". */
export function reminderOffsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return "On the due date";
  const days = Math.abs(offsetDays);
  const unit = days === 1 ? "day" : "days";
  return offsetDays < 0 ? `${days} ${unit} before due` : `${days} ${unit} overdue`;
}

// ─── Job runs (FR-3.10) ───────────────────────────────────────────────────

const JOB_RUN_STATUSES: Record<string, ChipView> = {
  RUNNING: { label: "Running", tone: "info" },
  DONE: { label: "Done", tone: "success" },
  DONE_WITH_ERRORS: { label: "Done with errors", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function jobRunStatusView(status: string): ChipView {
  return JOB_RUN_STATUSES[status] ?? { label: status, tone: "neutral" };
}

/** "850 ms" / "12 s" / "3 min 5 s"; "—" while running (no duration). */
export function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return "—";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`;
}

const JOB_NAMES: Record<string, string> = {
  "billing-cycle": "Billing cycle",
  reminders: "Renewal reminders",
  "usage-snapshot": "Usage snapshot",
  "mrr-snapshot": "MRR snapshot",
  "purge-reminders": "Purge reminders",
  "admin-membership": "Admin memberships",
};

/** The server's job key (`usage-snapshot`) as a name; unknown keys stay readable. */
export function jobRunLabel(job: string): string {
  return JOB_NAMES[job] ?? JOB_NAMES[job.replace(/_/g, "-")] ?? job;
}

// ─── Invoice status history (FR-3.8) ──────────────────────────────────────

const INVOICE_STATUS_LABELS: Record<PlatformInvoiceStatus, string> = {
  ISSUED: "Issued",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
  REFUNDED: "Refunded",
};

export function invoiceHistoryLabel(status: PlatformInvoiceStatus | string): string {
  return INVOICE_STATUS_LABELS[status as PlatformInvoiceStatus] ?? status;
}

/** "system" (jobs, webhooks, credits) reads as "Zcom (automatic)". */
export function invoiceActorLabel(actor: string): string {
  return actor === "system" ? "Zcom (automatic)" : actor;
}
