import { describe, expect, it } from "vitest";
import { collectionRate, monthPeriod, yearPeriod } from "./periods";

const NOW = new Date("2026-10-15T12:00:00Z");

describe("periods", () => {
  it("financial year starts on 1 April", () => {
    expect(yearPeriod(new Date(2026, 1, 1), "financial").start).toEqual(new Date(2025, 3, 1));
    expect(yearPeriod(NOW, "financial").start).toEqual(new Date(2026, 3, 1));
  });
  it("month period ends on the first of the next month (exclusive)", () => {
    const period = monthPeriod(new Date(2026, 11, 20));
    expect(period.start).toEqual(new Date(2026, 11, 1));
    expect(period.end).toEqual(new Date(2027, 0, 1));
  });
  it("collection rate is null when nothing was billed", () => {
    expect(collectionRate(0, 0)).toBeNull();
    expect(collectionRate(300, 100)).toBe(75);
  });
});
