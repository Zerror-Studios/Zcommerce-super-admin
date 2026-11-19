/**
 * Support › Settings form (PRD-049 FR-A33)
 *
 * Zerror's support calendar (time zone, weekly hours, holidays), the
 * first-reply promise per priority, and the auto-close, reminder and
 * reopen windows. The form keeps text drafts; `supportSettingsPatch` checks
 * them the way the server does (`platform-support-settings.service.ts`) and
 * sends only the groups that changed, with `expectedVersion`. Server
 * errors land on `extensions.field`.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type SupportReplyPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface PlatformSupportSettings {
  calendar: {
    timezone: string;
    /** Sunday first; null = closed */
    weekly: ({ open: string; close: string } | null)[];
    holidays: string[];
  };
  firstReplyHours: Record<SupportReplyPriority, number>;
  reopenReplyHours: number;
  autoCloseDays: number;
  reminderDays: number[];
  reopenDays: number;
  waitingReminderWorkingDays: number;
  version: number;
  updatedAt?: string | null;
}

export interface SupportDayDraft {
  isOpen: boolean;
  open: string;
  close: string;
}

export interface SupportSettingsDraft {
  timezone: string;
  days: SupportDayDraft[];
  holidays: string[];
  firstReplyHours: Record<SupportReplyPriority, string>;
  reopenReplyHours: string;
  autoCloseDays: string;
  /** "3, 6" */
  reminderDays: string;
  reopenDays: string;
  waitingReminderWorkingDays: string;
}

/** Field → message; `calendar.weekly.<0-6>` for one day, `form` for the whole form. */
export type SupportSettingsErrors = Partial<Record<string, string>>;

export interface SupportSettingsInput {
  calendar?: {
    timezone: string;
    weekly: ({ open: string; close: string } | null)[];
    holidays: string[];
  };
  firstReplyHours?: Partial<Record<SupportReplyPriority, number>>;
  reopenReplyHours?: number;
  autoCloseDays?: number;
  reminderDays?: number[];
  reopenDays?: number;
  waitingReminderWorkingDays?: number;
  expectedVersion?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Sunday first, as the API stores the week. */
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const REPLY_PRIORITIES: { key: SupportReplyPriority; label: string; description: string }[] = [
  { key: "URGENT", label: "Urgent", description: "Calendar hours: the clock runs nights and holidays too." },
  { key: "HIGH", label: "High", description: "Working hours." },
  { key: "NORMAL", label: "Normal", description: "Working hours." },
  { key: "LOW", label: "Low", description: "Working hours." },
];

/** The server's limits (core `SUPPORT_SETTINGS_LIMITS`). */
export const SUPPORT_SETTINGS_LIMITS = {
  replyHoursMax: 24 * 14,
  autoCloseDaysMin: 1,
  autoCloseDaysMax: 30,
  reminderDayMax: 30,
  reopenDaysMax: 90,
  waitingReminderDaysMax: 30,
  holidaysMax: 100,
} as const;

/** The hours a day gets when it is switched open for the first time. */
const DEFAULT_DAY = { open: "10:00", close: "19:00" } as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Fields the server names in `extensions.field` that the form shows. */
const SERVER_FIELDS = new Set([
  "calendar",
  "calendar.holidays",
  "firstReplyHours.URGENT",
  "firstReplyHours.HIGH",
  "firstReplyHours.NORMAL",
  "firstReplyHours.LOW",
  "reopenReplyHours",
  "autoCloseDays",
  "reminderDays",
  "reopenDays",
  "waitingReminderWorkingDays",
]);

// ─── Draft ────────────────────────────────────────────────────────────────

/** "3, 6" ⇄ [3, 6]. */
export function reminderDaysText(days: readonly number[]): string {
  return days.join(", ");
}

export function supportSettingsDraft(settings: PlatformSupportSettings): SupportSettingsDraft {
  const weekly = settings.calendar.weekly;
  return {
    timezone: settings.calendar.timezone,
    days: WEEKDAY_LABELS.map((_, index) => {
      const day = weekly[index];
      return day ? { isOpen: true, open: day.open, close: day.close } : { isOpen: false, ...DEFAULT_DAY };
    }),
    holidays: [...settings.calendar.holidays].sort(),
    firstReplyHours: {
      URGENT: String(settings.firstReplyHours.URGENT),
      HIGH: String(settings.firstReplyHours.HIGH),
      NORMAL: String(settings.firstReplyHours.NORMAL),
      LOW: String(settings.firstReplyHours.LOW),
    },
    reopenReplyHours: String(settings.reopenReplyHours),
    autoCloseDays: String(settings.autoCloseDays),
    reminderDays: reminderDaysText(settings.reminderDays),
    reopenDays: String(settings.reopenDays),
    waitingReminderWorkingDays: String(settings.waitingReminderWorkingDays),
  };
}

/** True when a save lost to someone else's (the form reloads their version). */
export function isSupportSettingsConflict(error: unknown): boolean {
  const first = (error as { graphQLErrors?: GraphQLErrorLike[] })?.graphQLErrors?.[0];
  return first?.extensions?.reason === "VERSION_CONFLICT";
}

/**
 * After a version conflict: the newer saved settings with this person's own
 * edits on top. A value counts as edited when it differs from the version the
 * form was opened on, per day and per priority, so their colleague's changes
 * to anything else are kept.
 */
export function rebaseSupportSettingsDraft(
  opened: PlatformSupportSettings,
  edited: SupportSettingsDraft,
  latest: PlatformSupportSettings,
): SupportSettingsDraft {
  const before = supportSettingsDraft(opened);
  const next = supportSettingsDraft(latest);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const pick = <T,>(mine: T, base: T, theirs: T): T => (same(mine, base) ? theirs : mine);
  return {
    timezone: pick(edited.timezone, before.timezone, next.timezone),
    days: next.days.map((day, index) => pick(edited.days[index], before.days[index], day)),
    holidays: pick(edited.holidays, before.holidays, next.holidays),
    firstReplyHours: {
      URGENT: pick(edited.firstReplyHours.URGENT, before.firstReplyHours.URGENT, next.firstReplyHours.URGENT),
      HIGH: pick(edited.firstReplyHours.HIGH, before.firstReplyHours.HIGH, next.firstReplyHours.HIGH),
      NORMAL: pick(edited.firstReplyHours.NORMAL, before.firstReplyHours.NORMAL, next.firstReplyHours.NORMAL),
      LOW: pick(edited.firstReplyHours.LOW, before.firstReplyHours.LOW, next.firstReplyHours.LOW),
    },
    reopenReplyHours: pick(edited.reopenReplyHours, before.reopenReplyHours, next.reopenReplyHours),
    autoCloseDays: pick(edited.autoCloseDays, before.autoCloseDays, next.autoCloseDays),
    reminderDays: pick(edited.reminderDays, before.reminderDays, next.reminderDays),
    reopenDays: pick(edited.reopenDays, before.reopenDays, next.reopenDays),
    waitingReminderWorkingDays: pick(
      edited.waitingReminderWorkingDays,
      before.waitingReminderWorkingDays,
      next.waitingReminderWorkingDays,
    ),
  };
}

/** Adds a YYYY-MM-DD holiday once, kept in date order. */
export function addHoliday(holidays: readonly string[], day: string): string[] {
  if (!YMD.test(day) || holidays.includes(day)) return [...holidays];
  return [...holidays, day].sort();
}

// ─── Checks ───────────────────────────────────────────────────────────────

/** True when the browser knows the IANA time zone (the server checks it the same way, through `Intl`). */
export function isValidTimeZone(zone: string): boolean {
  if (!zone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function hoursValue(text: string): number | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isFinite(value) || value <= 0 || value > SUPPORT_SETTINGS_LIMITS.replyHoursMax) return null;
  return Math.round(value * 100) / 100;
}

function wholeValue(text: string, min: number, max: number): number | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

const hoursMessage = `Enter hours above 0, up to ${SUPPORT_SETTINGS_LIMITS.replyHoursMax}.`;
const daysMessage = (min: number, max: number) => `Enter a whole number from ${min} to ${max}.`;

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * The changed groups as the mutation's input (with `expectedVersion`), or
 * the errors to show. `changes` counts what differs, for the save bar.
 */
export function supportSettingsPatch(
  settings: PlatformSupportSettings,
  draft: SupportSettingsDraft,
): { input: SupportSettingsInput; errors: SupportSettingsErrors; changes: number } {
  const errors: SupportSettingsErrors = {};
  const input: SupportSettingsInput = {};
  let changes = 0;

  // Calendar: sent whole when any part of it changed
  const timezone = draft.timezone.trim();
  if (!isValidTimeZone(timezone)) errors["calendar.timezone"] = "Enter a time zone such as Asia/Kolkata.";
  const weekly = draft.days.map((day, index) => {
    if (!day.isOpen) return null;
    if (!HHMM.test(day.open) || !HHMM.test(day.close)) {
      errors[`calendar.weekly.${index}`] = "Enter opening and closing times.";
    } else if (day.close <= day.open) {
      errors[`calendar.weekly.${index}`] = "Closing must be after opening.";
    }
    return { open: day.open, close: day.close };
  });
  const holidays = [...new Set(draft.holidays)].sort();
  if (holidays.some((day) => !YMD.test(day))) errors["calendar.holidays"] = "Holidays must be dates.";
  if (holidays.length > SUPPORT_SETTINGS_LIMITS.holidaysMax) {
    errors["calendar.holidays"] = `At most ${SUPPORT_SETTINGS_LIMITS.holidaysMax} holidays.`;
  }
  const saved = settings.calendar;
  const timezoneChanged = timezone !== saved.timezone;
  const changedDays = weekly.filter((day, index) => {
    const before = saved.weekly[index] ?? null;
    if (!day || !before) return day !== before;
    return day.open !== before.open || day.close !== before.close;
  }).length;
  const holidaysChanged = !sameList(holidays, [...saved.holidays].sort());
  changes += (timezoneChanged ? 1 : 0) + changedDays + (holidaysChanged ? 1 : 0);
  if (timezoneChanged || changedDays || holidaysChanged) input.calendar = { timezone, weekly, holidays };

  // First-reply promises: only the priorities that changed
  const firstReply: Partial<Record<SupportReplyPriority, number>> = {};
  for (const { key } of REPLY_PRIORITIES) {
    const value = hoursValue(draft.firstReplyHours[key]);
    if (value == null) errors[`firstReplyHours.${key}`] = hoursMessage;
    else if (value !== settings.firstReplyHours[key]) firstReply[key] = value;
  }
  if (Object.keys(firstReply).length) {
    input.firstReplyHours = firstReply;
    changes += Object.keys(firstReply).length;
  }

  const reopenReply = hoursValue(draft.reopenReplyHours);
  if (reopenReply == null) errors.reopenReplyHours = hoursMessage;
  else if (reopenReply !== settings.reopenReplyHours) {
    input.reopenReplyHours = reopenReply;
    changes += 1;
  }

  const limits = SUPPORT_SETTINGS_LIMITS;
  const autoClose = wholeValue(draft.autoCloseDays, limits.autoCloseDaysMin, limits.autoCloseDaysMax);
  if (autoClose == null) errors.autoCloseDays = daysMessage(limits.autoCloseDaysMin, limits.autoCloseDaysMax);
  else if (autoClose !== settings.autoCloseDays) {
    input.autoCloseDays = autoClose;
    changes += 1;
  }

  const parts = draft.reminderDays
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const reminders = parts.map((part) => wholeValue(part, 1, limits.reminderDayMax));
  if (reminders.some((day) => day == null)) {
    errors.reminderDays = `Enter days from 1 to ${limits.reminderDayMax}, separated by commas.`;
  } else {
    const days = [...new Set(reminders as number[])].sort((a, b) => a - b);
    const closeDay = autoClose ?? settings.autoCloseDays;
    if (days.some((day) => day >= closeDay)) errors.reminderDays = "Reminders must come before the auto-close day.";
    else if (!sameList(days, settings.reminderDays)) {
      input.reminderDays = days;
      changes += 1;
    }
  }

  const reopen = wholeValue(draft.reopenDays, 1, limits.reopenDaysMax);
  if (reopen == null) errors.reopenDays = daysMessage(1, limits.reopenDaysMax);
  else if (reopen !== settings.reopenDays) {
    input.reopenDays = reopen;
    changes += 1;
  }

  const waiting = wholeValue(draft.waitingReminderWorkingDays, 1, limits.waitingReminderDaysMax);
  if (waiting == null) errors.waitingReminderWorkingDays = daysMessage(1, limits.waitingReminderDaysMax);
  else if (waiting !== settings.waitingReminderWorkingDays) {
    input.waitingReminderWorkingDays = waiting;
    changes += 1;
  }

  if (changes) input.expectedVersion = settings.version;
  return { input, errors, changes };
}

// ─── Server errors ───────────────────────────────────────────────────────

interface GraphQLErrorLike {
  message?: string;
  extensions?: Record<string, unknown>;
}

/**
 * `INVALID_SUPPORT_SETTING` on its `extensions.field` (a whole-calendar
 * error lands on the time zone row); `VERSION_CONFLICT` on the form (the
 * page also reloads the settings).
 * `null` when it isn't a form error (toast it instead).
 */
export function supportSettingsErrorsFromServer(error: unknown): SupportSettingsErrors | null {
  const first = (error as { graphQLErrors?: GraphQLErrorLike[] })?.graphQLErrors?.[0];
  const reason = String(first?.extensions?.reason ?? "");
  if (reason === "VERSION_CONFLICT") {
    return { form: "Someone else saved these settings first. Their version is loaded with your changes on top; check them and save again." };
  }
  if (reason !== "INVALID_SUPPORT_SETTING") return null;
  const field = String(first?.extensions?.field ?? "");
  const message = first?.message || "Check this value.";
  if (field === "calendar") return { "calendar.timezone": message };
  return SERVER_FIELDS.has(field) ? { [field]: message } : { form: message };
}
