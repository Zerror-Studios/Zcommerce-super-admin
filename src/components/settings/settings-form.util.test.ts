import { describe, expect, it } from "vitest";
import {
  billingRulesSummary,
  dayError,
  reminderRowErrors,
  remindersToRows,
  rowsToReminders,
} from "./settings-form.util";

describe("settings form helpers", () => {
  it("checks whole days in range", () => {
    expect(dayError("7", { min: 1, max: 60 })).toBeNull();
    expect(dayError("0", { min: 1, max: 60 })).toBe("Enter a whole number from 1 to 60.");
    expect(dayError("2.5", { min: 1, max: 60 })).not.toBeNull();
    expect(dayError("", { min: 1, max: 60 })).not.toBeNull();
  });

  it("turns the two day lists into reminder rows and back", () => {
    const rows = remindersToRows([1, 7], [3]);
    expect(rows).toEqual([
      { days: "7", when: "before" },
      { days: "1", when: "before" },
      { days: "3", when: "after" },
    ]);
    expect(rowsToReminders(rows)).toEqual({ daysBeforeDue: [7, 1], daysAfterDue: [3] });
  });

  it("flags two reminders on the same day", () => {
    expect(
      reminderRowErrors([
        { days: "7", when: "before" },
        { days: "7", when: "before" },
        { days: "7", when: "after" },
      ]),
    ).toEqual([null, "Another reminder is already set for this day.", null]);
  });

  it("explains the rules in days, counting the grace period (04 S-07f)", () => {
    const text = billingRulesSummary({
      due: new Date(Date.UTC(2026, 10, 15)),
      graceDays: 3,
      rows: [
        { days: "7", when: "before" },
        { days: "1", when: "after" },
        { days: "3", when: "after" },
      ],
      pauseDays: 7,
      suspendDays: 21,
      dunningOn: true,
    });
    expect(text).toBe(
      "A store due on 15 Nov gets reminders on 8 Nov, 16 Nov and 18 Nov, counts as overdue from 18 Nov (after 3 grace days), pauses orders on 25 Nov and is suspended on 9 Dec.",
    );
  });
});
