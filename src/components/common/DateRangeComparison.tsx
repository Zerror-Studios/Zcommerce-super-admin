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
  /**
   * A filter that may be empty (Invoices' due date): an extra first option with this label ("Any due date").
   * While `isAny` is true the button shows it and `value` only seeds the calendar; picking it calls `onClear`.
   */
  anyLabel?: string;
  isAny?: boolean;
  onClear?: () => void;
  /** Latest pickable day; default today, null for none (due dates can be in the future). */
  maxDate?: Date | null;
  /** Show the comparison period (reports). Off for plain filters. Default true. */
  compare?: boolean;
}

interface Preset {
  label: string;
  getRange: () => DateRangeValue;
}

/**
 * Presets from docs/design/04-super-admin.md §3.1 (This month / Last month / This year / Financial year / Custom).
 * Reports end the current periods today; `wholePeriods` (no max date, e.g. due dates) runs them to their end.
 */
function buildPresets(today: Date, wholePeriods = false): Preset[] {
  const periodEnd = (end: Date) => (wholePeriods ? endOfDay(subDays(end, 1)) : endOfDay(today));
  return [
    {
      label: "This month",
      getRange: () => ({
        startDate: startOfMonth(today),
        endDate: wholePeriods ? endOfDay(endOfMonth(today)) : endOfDay(today),
      }),
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
      getRange: () => ({ startDate: yearPeriod(today, "calendar").start, endDate: periodEnd(yearPeriod(today, "calendar").end) }),
    },
    {
      label: "Financial year",
      getRange: () => ({ startDate: yearPeriod(today, "financial").start, endDate: periodEnd(yearPeriod(today, "financial").end) }),
    },
  ];
}

/** The picker's non-preset options. */
const CUSTOM = "custom";
const ANY = "any";

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
 * Date control (docs/design/02-components.md §2): one secondary "📅 This month ⌄" button; presets beside a
 * calendar in a popover. The calendar shows for every option (owner 2026-10-28): a preset marks its range on
 * it, picking days there is Custom, and Apply sets the range. The comparison period is in the footer.
 */
export function DateRangeComparison({
  value,
  onChange,
  anyLabel,
  isAny = false,
  onClear,
  maxDate,
  compare = true,
}: DateRangeComparisonProps) {
  const [open, setOpen] = useState(false);
  /** The highlighted option while open: the "any" option, a preset's label or Custom. */
  const [choice, setChoice] = useState<string>(CUSTOM);
  const [draft, setDraft] = useState<Range[]>([
    {
      startDate: value.startDate,
      endDate: value.endDate,
      key: "selection",
    },
  ]);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);
  const presets = useMemo(() => buildPresets(today, maxDate === null), [maxDate, today]);

  const matchedPreset = presets.find((preset) => {
    const range = preset.getRange();
    return (
      sameDay(range.startDate, value.startDate) &&
      sameDay(range.endDate, value.endDate)
    );
  })?.label;
  const activePreset = anyLabel && isAny ? anyLabel : matchedPreset;

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
    setChoice(CUSTOM);
  };

  // A preset marks its range on the calendar; Apply sets it.
  const pickPreset = (preset: Preset) => {
    const range = preset.getRange();
    setDraft([{ startDate: startOfDay(range.startDate), endDate: endOfDay(range.endDate), key: "selection" }]);
    setChoice(preset.label);
  };

  const handleApply = () => {
    if (choice === ANY) {
      onClear?.();
    } else {
      onChange({
        startDate: startOfDay(draftStart),
        endDate: endOfDay(draftEnd),
      });
    }
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
            setChoice(anyLabel && isAny ? ANY : (matchedPreset ?? CUSTOM));
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
              {anyLabel ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setChoice(ANY)}
                    className={presetItemClass(choice === ANY)}
                  >
                    {anyLabel}
                    {choice === ANY ? <IconCheck aria-hidden className="size-4" /> : null}
                  </button>
                </li>
              ) : null}
              {presets.map((preset) => {
                const selected = choice === preset.label;
                return (
                  <li key={preset.label}>
                    <button type="button" onClick={() => pickPreset(preset)} className={presetItemClass(selected)}>
                      {preset.label}
                      {selected ? <IconCheck aria-hidden className="size-4" /> : null}
                    </button>
                  </li>
                );
              })}
              <li>
                <button type="button" onClick={() => setChoice(CUSTOM)} className={presetItemClass(choice === CUSTOM)}>
                  Custom
                  {choice === CUSTOM ? <IconCheck aria-hidden className="size-4" /> : null}
                </button>
              </li>
            </ul>

            <div className="min-w-0 flex-1">
              <DateRange
                ranges={draft}
                onChange={handleSelect}
                months={1}
                direction="horizontal"
                showDateDisplay={false}
                showMonthAndYearPickers
                rangeColors={[chartColors.series[0]]}
                maxDate={maxDate === null ? undefined : (maxDate ?? today)}
                weekdayDisplayFormat="EEEEEE"
                monthDisplayFormat="MMMM"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-fg-muted num">
              {choice === ANY ? anyLabel : formatRangeLabel(draftStart, draftEnd)}
              {compare && choice !== ANY
                ? ` · compared with ${formatRangeLabel(
                    getPreviousPeriod(draftStart, draftEnd).startDate,
                    getPreviousPeriod(draftStart, draftEnd).endDate,
                  )}`
                : null}
            </p>
            <div className="flex items-center gap-2">
              <UiButton variant="secondary" size="sm" onPress={() => setOpen(false)}>
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
