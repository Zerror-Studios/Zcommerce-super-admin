/**
 * Small helpers for the settings forms: number fields keep their typed text in the draft and are checked
 * against their range before Save.
 */

export const toDraftNumber = (value: number | null | undefined) => (value == null ? "" : String(value));

/** "Enter a whole number from 1 to 60." when the text isn't a whole number in range; null when it is. */
export function dayError(text: string, range: { min: number; max: number }): string | null {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (!trimmed || !Number.isInteger(value) || value < range.min || value > range.max) {
    return `Enter a whole number from ${range.min} to ${range.max}.`;
  }
  return null;
}

/** One renewal reminder: N days before or after the due date (the API keeps two day lists, each day ≥ 1). */
export interface ReminderRow {
  days: string;
  when: "before" | "after";
}

export const MAX_REMINDERS = 3;

/** The saved day lists as rows, in date order: furthest before first, then after. */
export function remindersToRows(before: readonly number[], after: readonly number[]): ReminderRow[] {
  return [
    ...[...before].sort((a, b) => b - a).map((days) => ({ days: String(days), when: "before" as const })),
    ...[...after].sort((a, b) => a - b).map((days) => ({ days: String(days), when: "after" as const })),
  ];
}

/** Rows back to the API's day lists (deduplicated, sorted like the server). */
export function rowsToReminders(rows: readonly ReminderRow[]): { daysBeforeDue: number[]; daysAfterDue: number[] } {
  const list = (when: ReminderRow["when"]) =>
    [...new Set(rows.filter((row) => row.when === when).map((row) => Number(row.days)))].sort((a, b) => b - a);
  return { daysBeforeDue: list("before"), daysAfterDue: list("after") };
}

/** Field errors per row: a whole number of days from 1 to 365, and no two reminders on the same day. */
export function reminderRowErrors(rows: readonly ReminderRow[]): (string | null)[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const error = dayError(row.days, { min: 1, max: 365 });
    if (error) return error;
    const key = `${row.when}:${Number(row.days)}`;
    if (seen.has(key)) return "Another reminder is already set for this day.";
    seen.add(key);
    return null;
  });
}

const DAY_MS = 86_400_000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const dayMonth = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * "What this means" (04 S-07f): reminders, overdue, pause and suspend dates for a store due on `due`. Overdue
 * starts when grace ends; pause and suspend count from there (06 Q7 default).
 */
export function billingRulesSummary(input: {
  due: Date;
  graceDays: number;
  rows: readonly ReminderRow[];
  pauseDays: number;
  suspendDays: number;
  dunningOn: boolean;
}): string {
  const { due, graceDays, rows, pauseDays, suspendDays, dunningOn } = input;
  const reminderDates = rows
    .map((row) => addDays(due, row.when === "before" ? -Number(row.days) : Number(row.days)))
    .sort((a, b) => a.getTime() - b.getTime())
    .map(dayMonth);
  const overdue = addDays(due, graceDays);
  const reminders =
    reminderDates.length === 0
      ? "gets no reminders"
      : `gets ${reminderDates.length === 1 ? "a reminder" : "reminders"} on ${joinList(reminderDates)}`;
  const grace = graceDays === 0 ? "with no grace days" : `after ${graceDays} grace ${graceDays === 1 ? "day" : "days"}`;
  const pause = dayMonth(addDays(overdue, pauseDays));
  const suspend = dayMonth(addDays(overdue, suspendDays));
  const start = `A store due on ${dayMonth(due)} ${reminders}, counts as overdue from ${dayMonth(overdue)} (${grace})`;
  return dunningOn
    ? `${start}, pauses orders on ${pause} and is suspended on ${suspend}.`
    : `${start}. Once automatic pausing is on, its orders pause on ${pause} and it is suspended on ${suspend}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Placeholders the reminder text can use. */
export const REMINDER_PLACEHOLDERS = ["ownerName", "storeName", "plan", "renewalDate", "days"] as const;

const SAMPLE: Record<(typeof REMINDER_PLACEHOLDERS)[number], string> = {
  ownerName: "Priya",
  storeName: "Kesar & Kin",
  plan: "Starter",
  renewalDate: "15 Nov",
  days: "7",
};

/** The text with the sample store filled in. */
export function previewReminder(text: string): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => SAMPLE[key as keyof typeof SAMPLE] ?? match);
}
