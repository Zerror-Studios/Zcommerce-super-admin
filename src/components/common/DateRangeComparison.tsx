/**
 * The console's date control (round 2 G17): the shared kit `DateRangePicker` (presets, two months, Cancel / Apply)
 * with the console's money presets (This month, Last month, This year, Financial year, Last 30 days, Custom),
 * keeping the old `{ startDate, endDate }` value so the pages (Analytics › Revenue, Billing) need no change.
 * react-date-range is no longer loaded here.
 */
import { endOfDay, startOfDay } from "date-fns";

import { DateRangePicker, matchPreset, type DateRangePreset } from "../ui/DateRangePicker";

export interface DateRangeValue {
  startDate: Date;
  endDate: Date;
}

export interface DateRangeComparisonProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** LEGACY: no page passes it any more ("Any due date" option). */
  anyLabel?: string;
  /** LEGACY: see `anyLabel`. */
  isAny?: boolean;
  /** LEGACY: see `anyLabel`. */
  onClear?: () => void;
  /** null: future days allowed. Default: up to today. */
  maxDate?: Date | null;
  /** LEGACY: the pages compute their own comparison (the old footer line "Compared with …" is gone). */
  compare?: boolean;
}

const CONSOLE_PRESETS: DateRangePreset[] = ["thisMonth", "lastMonth", "thisYear", "financialYear", "last30", "custom"];

export function DateRangeComparison({ value, onChange, maxDate }: DateRangeComparisonProps) {
  return (
    <DateRangePicker
      value={{
        from: value.startDate,
        to: value.endDate,
        preset: matchPreset(value.startDate, value.endDate),
        compare: "none",
      }}
      onChange={(next) => onChange({ startDate: startOfDay(next.from), endDate: endOfDay(next.to) })}
      presets={CONSOLE_PRESETS}
      // The pages compute their own comparison, so the value carries none and the switch stays hidden.
      compareModes={[]}
      maxDate={maxDate}
    />
  );
}

export default DateRangeComparison;
