import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateRange, type Range, type RangeKeyDict } from "react-date-range";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "./dateRangeComparison.css";
import { yearPeriod } from "../../lib/periods";
import { chartColors } from "../ui/chart-theme";
import { cx } from "../ui/cx";
import { IconCalendar, IconCaret, IconCheck } from "../ui/icons";
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

/** Presets from docs/design/04-super-admin.md §3.1 (This month / Last month / This year / Financial year / Custom). */
function buildPresets(today: Date): Preset[] {
  return [
    {
      label: "This month",
      getRange: () => ({ startDate: startOfMonth(today), endDate: endOfDay(today) }),
    },
    {
      label: "Last month",
      getRange: () => {
        const month = subMonths(today, 1);
        return { startDate: startOfMonth(month), endDate: endOfDay(endOfMonth(month)) };
      },
    },
    {
      label: "This year",
      getRange: () => ({ startDate: yearPeriod(today, "calendar").start, endDate: endOfDay(today) }),
    },
    {
      label: "Financial year",
      getRange: () => ({ startDate: yearPeriod(today, "financial").start, endDate: endOfDay(today) }),
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

/** "15 Sep – 14 Oct"; the year only when it isn't the current one (docs/design/05-wording.md §2). */
function formatRangeLabel(start: Date, end: Date) {
  const thisYear = new Date().getFullYear();
  const day = (date: Date) => format(date, date.getFullYear() === thisYear ? "d MMM" : "d MMM yyyy");
  return sameDay(start, end) ? day(start) : `${day(start)} – ${day(end)}`;
}

/**
 * Date control (docs/design/02-components.md §2): one secondary "📅 This month ⌄" button; presets and a
 * custom calendar in a popover. The comparison period is shown inside the popover, not beside the button.
 */
export function DateRangeComparison({ value, onChange }: DateRangeComparisonProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
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
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
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
    onChange({ startDate: startOfDay(range.startDate), endDate: endOfDay(range.endDate) });
    setOpen(false);
  };

  const handleApply = () => {
    onChange({
      startDate: startOfDay(draftStart),
      endDate: endOfDay(draftEnd),
    });
    setOpen(false);
  };

  const presetItemClass = (selected: boolean) =>
    cx(
      "flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-body transition-colors duration-instant ease-standard",
      selected ? "bg-brand-soft font-medium text-brand-text" : "text-fg hover:bg-surface-sunken",
    );

  return (
    <div ref={rootRef} className="relative">
      <UiButton
        variant="secondary"
        startIcon={<IconCalendar aria-hidden />}
        endIcon={<IconCaret aria-hidden className="text-fg-muted" />}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPress={() => {
          if (!open) {
            // Start each visit from the applied range.
            setDraft([{ startDate: value.startDate, endDate: value.endDate, key: "selection" }]);
            setCustom(!activePreset);
          }
          setOpen(!open);
        }}
      >
        <span className="num">{activePreset ?? formatRangeLabel(value.startDate, value.endDate)}</span>
      </UiButton>

      {open ? (
        <div
          role="dialog"
          aria-label="Date range"
          className="date-range-comparison absolute left-0 z-40 mt-2 w-[min(calc(100vw-2rem),34rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-popover sm:left-auto sm:right-0"
        >
          <div className="flex flex-col sm:flex-row">
            <ul className="shrink-0 space-y-0.5 border-b border-line p-1 sm:w-44 sm:border-b-0 sm:border-r">
              {presets.map((preset) => {
                const selected = !custom && activePreset === preset.label;
                return (
                  <li key={preset.label}>
                    <button type="button" onClick={() => applyPreset(preset)} className={presetItemClass(selected)}>
                      {preset.label}
                      {selected ? <IconCheck aria-hidden className="size-4" /> : null}
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => setCustom(true)} className={presetItemClass(custom)}>
                  Custom
                  {custom ? <IconCheck aria-hidden className="size-4" /> : null}
                </button>
              </li>
            </ul>

            <div className="min-w-0 flex-1">
              {custom ? (
                <DateRange
                  ranges={draft}
                  onChange={handleSelect}
                  months={1}
                  direction="horizontal"
                  showDateDisplay={false}
                  showMonthAndYearPickers
                  rangeColors={[chartColors.series[0]]}
                  maxDate={today}
                  weekdayDisplayFormat="EEEEEE"
                  monthDisplayFormat="MMMM"
                />
              ) : (
                <div className="space-y-1 px-4 py-3">
                  <p className="text-label font-medium text-fg-muted">Selected</p>
                  <p className="text-body text-fg num">{formatRangeLabel(value.startDate, value.endDate)}</p>
                  <p className="pt-2 text-label font-medium text-fg-muted">Compared with</p>
                  <p className="text-body text-fg num">
                    {formatRangeLabel(previousPeriod.startDate, previousPeriod.endDate)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {custom ? (
            <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-fg-muted num">
                {formatRangeLabel(draftStart, draftEnd)} · compared with the previous{" "}
                {differenceInCalendarDays(draftEnd, draftStart) + 1} days
              </p>
              <div className="flex items-center gap-2">
                <UiButton variant="ghost" size="sm" onPress={() => setOpen(false)}>
                  Cancel
                </UiButton>
                <UiButton variant="primary" size="sm" onPress={handleApply}>
                  Apply
                </UiButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
