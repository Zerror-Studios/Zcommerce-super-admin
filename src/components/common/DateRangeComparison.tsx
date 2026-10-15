import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRange, type Range, type RangeKeyDict } from "react-date-range";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "./dateRangeComparison.css";
import { IconCalendarDays, IconCaret } from "../ui/icons";
import { Button as UiButton } from "../ui";

export interface DateRangeValue {
  startDate: Date;
  endDate: Date;
}

export interface DateRangeComparisonProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

interface Preset {
  label: string;
  getRange: () => DateRangeValue;
}

function buildPresets(today: Date): Preset[] {
  return [
    {
      label: "Today",
      getRange: () => ({
        startDate: startOfDay(today),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "Yesterday",
      getRange: () => {
        const day = subDays(today, 1);
        return { startDate: startOfDay(day), endDate: endOfDay(day) };
      },
    },
    {
      label: "Last 7 days",
      getRange: () => ({
        startDate: startOfDay(subDays(today, 6)),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "Last 14 days",
      getRange: () => ({
        startDate: startOfDay(subDays(today, 13)),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "Last 30 days",
      getRange: () => ({
        startDate: startOfDay(subDays(today, 29)),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "Last 90 days",
      getRange: () => ({
        startDate: startOfDay(subDays(today, 89)),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "Last 365 days",
      getRange: () => ({
        startDate: startOfDay(subDays(today, 364)),
        endDate: endOfDay(today),
      }),
    },
    {
      label: "This month",
      getRange: () => ({
        startDate: startOfMonth(today),
        endDate: endOfDay(today),
      }),
    },
  ];
}

function sameDay(a: Date, b: Date) {
  return format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
}

function getPreviousPeriod(start: Date, end: Date) {
  const length = differenceInCalendarDays(end, start) + 1;
  const prevEnd = endOfDay(subDays(start, 1));
  const prevStart = startOfDay(subDays(prevEnd, length - 1));
  return { startDate: prevStart, endDate: prevEnd };
}

function formatRangeLabel(start: Date, end: Date) {
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

export function DateRangeComparison({ value, onChange }: DateRangeComparisonProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range[]>([
    {
      startDate: value.startDate,
      endDate: value.endDate,
      key: "selection",
    },
  ]);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const presets = useMemo(() => buildPresets(today), [today]);

  const previousPeriod = useMemo(
    () => getPreviousPeriod(value.startDate, value.endDate),
    [value.endDate, value.startDate],
  );

  const activePreset = presets.find((preset) => {
    const range = preset.getRange();
    return (
      sameDay(range.startDate, value.startDate) &&
      sameDay(range.endDate, value.endDate)
    );
  })?.label;

  useEffect(() => {
    if (!open) return;
    setDraft([
      {
        startDate: value.startDate,
        endDate: value.endDate,
        key: "selection",
      },
    ]);
  }, [open, value.endDate, value.startDate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const draftStart = draft[0]?.startDate ?? value.startDate;
  const draftEnd = draft[0]?.endDate ?? value.endDate;

  const handleSelect = (ranges: RangeKeyDict) => {
    const selection = ranges.selection;
    if (!selection?.startDate || !selection.endDate) return;
    setDraft([
      {
        startDate: startOfDay(selection.startDate),
        endDate: endOfDay(selection.endDate),
        key: "selection",
      },
    ]);
  };

  const applyPreset = (preset: Preset) => {
    const range = preset.getRange();
    setDraft([
      {
        startDate: range.startDate,
        endDate: range.endDate,
        key: "selection",
      },
    ]);
  };

  const handleApply = () => {
    onChange({
      startDate: startOfDay(draftStart),
      endDate: endOfDay(draftEnd),
    });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex h-8 w-full max-w-md items-center gap-2.5 rounded-lg border border-default-200 bg-surface px-3 text-left text-body text-default-700 transition-colors hover:border-default-300 sm:w-[22rem]"
        >
          <IconCalendarDays size={15} className="shrink-0 text-primary" strokeWidth={2} />
          <span className="flex-1 truncate font-normal text-default-700">
            {formatRangeLabel(value.startDate, value.endDate)}
          </span>
          <IconCaret size={13} className="shrink-0 text-primary" strokeWidth={2} />
        </button>
        <p className="text-body text-default-500">
          compared to previous period ({format(previousPeriod.startDate, "MMM d, yyyy")})
        </p>
      </div>

      {open ? (
        <div className="date-range-comparison absolute left-0 z-40 mt-2 w-[min(100%,34rem)] overflow-hidden rounded-xl border border-default-200 bg-surface shadow-xl">
          <div className="flex flex-col sm:flex-row">
            <aside className="shrink-0 border-b border-default-200 sm:w-32 sm:border-b-0 sm:border-r sm:border-primary/20">
              <ul className="py-1.5">
                {presets.map((preset) => {
                  const selected =
                    activePreset === preset.label ||
                    (sameDay(preset.getRange().startDate, draftStart) &&
                      sameDay(preset.getRange().endDate, draftEnd));
                  return (
                    <li key={preset.label} className="border-b border-default-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`w-full px-3 py-2 text-left text-caption transition-colors ${
                          selected
                            ? "font-medium text-primary"
                            : "text-default-600 hover:bg-default-50 hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="min-w-0 flex-1">
              <DateRange
                ranges={draft}
                onChange={handleSelect}
                months={1}
                direction="horizontal"
                showDateDisplay={false}
                showMonthAndYearPickers
                rangeColors={["#3b82f6"]}
                maxDate={addDays(today, 0)}
                weekdayDisplayFormat="EEE"
                monthDisplayFormat="MMMM"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-default-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-default-500">
              {formatRangeLabel(draftStart, draftEnd)}
            </p>
            <div className="flex items-center gap-2">
              <UiButton variant="outline" size="sm" onPress={() => setOpen(false)}>
                Cancel
              </UiButton>
              <UiButton variant="primary" size="sm" onPress={handleApply}>
                Apply
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
