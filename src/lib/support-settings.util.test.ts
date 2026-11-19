import { describe, expect, it } from "vitest";
import {
  addHoliday,
  isSupportSettingsConflict,
  rebaseSupportSettingsDraft,
  supportSettingsDraft,
  supportSettingsErrorsFromServer,
  supportSettingsPatch,
  type PlatformSupportSettings,
} from "./support-settings.util";

const SETTINGS: PlatformSupportSettings = {
  calendar: {
    timezone: "Asia/Kolkata",
    weekly: [null, ...Array.from({ length: 6 }, () => ({ open: "10:00", close: "19:00" }))],
    holidays: ["2026-12-25"],
  },
  firstReplyHours: { URGENT: 1, HIGH: 4, NORMAL: 8, LOW: 16 },
  reopenReplyHours: 9,
  autoCloseDays: 7,
  reminderDays: [3, 6],
  reopenDays: 14,
  waitingReminderWorkingDays: 5,
  version: 3,
  updatedAt: null,
};

const serverError = (extensions: Record<string, unknown>, message = "Bad value") => ({ graphQLErrors: [{ message, extensions }] });

describe("support settings form (PRD-049 FR-A33)", () => {
  it("sends nothing for an untouched form", () => {
    const result = supportSettingsPatch(SETTINGS, supportSettingsDraft(SETTINGS));
    expect(result).toEqual({ input: {}, errors: {}, changes: 0 });
  });

  it("sends only the changed groups, with the version it read", () => {
    const draft = supportSettingsDraft(SETTINGS);
    draft.firstReplyHours.HIGH = "6";
    draft.autoCloseDays = "10";
    const result = supportSettingsPatch(SETTINGS, draft);
    expect(result.errors).toEqual({});
    expect(result.changes).toBe(2);
    expect(result.input).toEqual({ firstReplyHours: { HIGH: 6 }, autoCloseDays: 10, expectedVersion: 3 });
  });

  it("sends the whole calendar when one day changes, closed days as null", () => {
    const draft = supportSettingsDraft(SETTINGS);
    draft.days[6] = { isOpen: false, open: "10:00", close: "19:00" };
    const result = supportSettingsPatch(SETTINGS, draft);
    expect(result.input.calendar?.weekly[0]).toBeNull();
    expect(result.input.calendar?.weekly[6]).toBeNull();
    expect(result.input.calendar?.weekly[1]).toEqual({ open: "10:00", close: "19:00" });
    expect(result.input.calendar?.holidays).toEqual(["2026-12-25"]);
  });

  it("checks hours, days, times and the time zone as the server does", () => {
    const draft = supportSettingsDraft(SETTINGS);
    draft.timezone = "Mars/Olympus";
    draft.days[1] = { isOpen: true, open: "19:00", close: "10:00" };
    draft.firstReplyHours.LOW = "0";
    draft.reminderDays = "3, 8";
    draft.reopenDays = "1.5";
    const { errors } = supportSettingsPatch(SETTINGS, draft);
    expect(Object.keys(errors).sort()).toEqual(
      ["calendar.timezone", "calendar.weekly.1", "firstReplyHours.LOW", "reminderDays", "reopenDays"].sort(),
    );
  });

  it("adds holidays once, in date order", () => {
    expect(addHoliday(["2026-12-25"], "2026-11-14")).toEqual(["2026-11-14", "2026-12-25"]);
    expect(addHoliday(["2026-12-25"], "2026-12-25")).toEqual(["2026-12-25"]);
    expect(addHoliday([], "25/12/2026")).toEqual([]);
  });

  it("puts server errors on their field", () => {
    expect(supportSettingsErrorsFromServer(serverError({ code: "BAD_USER_INPUT", reason: "INVALID_SUPPORT_SETTING", field: "reopenDays" }))).toEqual({
      reopenDays: "Bad value",
    });
    expect(supportSettingsErrorsFromServer(serverError({ code: "BAD_USER_INPUT", reason: "INVALID_SUPPORT_SETTING", field: "calendar" }))).toEqual({
      "calendar.timezone": "Bad value",
    });
    expect(supportSettingsErrorsFromServer(serverError({ code: "CONFLICT", reason: "VERSION_CONFLICT" }))?.form).toMatch(/Someone else/);
    expect(supportSettingsErrorsFromServer(serverError({ code: "FORBIDDEN" }))).toBeNull();
  });

  it("keeps this person's edits on top of a newer saved version after a conflict", () => {
    const edited = supportSettingsDraft(SETTINGS);
    edited.autoCloseDays = "10";
    edited.firstReplyHours.HIGH = "3";
    const theirs: PlatformSupportSettings = {
      ...SETTINGS,
      reopenDays: 21,
      firstReplyHours: { ...SETTINGS.firstReplyHours, LOW: 24 },
      version: 4,
    };
    const merged = rebaseSupportSettingsDraft(SETTINGS, edited, theirs);
    expect(merged).toMatchObject({ autoCloseDays: "10", reopenDays: "21" });
    expect(merged.firstReplyHours).toEqual({ URGENT: "1", HIGH: "3", NORMAL: "8", LOW: "24" });
    // Only the edits are sent against the newer version
    expect(supportSettingsPatch(theirs, merged).input).toEqual({ autoCloseDays: 10, firstReplyHours: { HIGH: 3 }, expectedVersion: 4 });
    expect(isSupportSettingsConflict(serverError({ code: "CONFLICT", reason: "VERSION_CONFLICT" }))).toBe(true);
    expect(isSupportSettingsConflict(serverError({ code: "BAD_USER_INPUT", reason: "INVALID_SUPPORT_SETTING" }))).toBe(false);
  });
});
