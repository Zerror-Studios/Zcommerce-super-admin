/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The one date-range picker (round 2 G17, docs/review-r2/ROUND-2-FIXES.md; `.zc-drp` in src/styles/components.css).
 * - Trigger: a secondary pill with the calendar icon and the label ("Last 30 days", "1 Oct – 4 Nov"); `on-dark`
 *   on the Home hero.
 * - Popover (640, under the trigger, the popover motion): presets on the left (Today, Yesterday, Last 7 days,
 *   Last 30 days, This month, Last month, This quarter, This year, Custom); two months side by side on the right,
 *   the range filled soft blue, today ringed. Below: the "Compare to" switch (Previous period / Same period last
 *   year), optional time inputs (`withTime`, for discount and campaign dates), Cancel / Apply.
 * - Phone: a bottom sheet with the presets first and one month at a time.
 * - State: `useUrlDateRange` keeps the choice in the URL (?from=&to=&cmp=) so links keep it, and remembers the last
 *   range per section (`storageKey`, the app passes a per-store key).
 * The calendar is built here on date-fns (no picker dependency), so it works the same in both apps.
 */
import { ModalBody, ModalContent, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "./Button";
import { cx } from "./cx";
import { IconCalendar, IconCaret, IconNextPage, IconPrevPage } from "./icons";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";
import { usePresetMotion } from "./motion";
import { Switch } from "./Switch";
import { useIsPhone } from "./use-media";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "financialYear"
  | "custom";

/** "none", the previous period of the same length, or the same dates a year earlier. */
export type DateRangeCompare = "none" | "previous" | "lastYear";

export interface DateRangeValue {
  from: Date;
  to: Date;
  /** The preset the dates match ("custom" when none does). */
  preset: DateRangePreset;
  compare: DateRangeCompare;
}

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisQuarter", label: "This quarter" },
  { value: "thisYear", label: "This year" },
  { value: "financialYear", label: "Financial year" },
  { value: "custom", label: "Custom" },
];

/** The nine G17 presets (the default); "financialYear" (1 April on) is opt-in for the console's money views. */
const DEFAULT_PRESETS: DateRangePreset[] = DATE_RANGE_PRESETS.map((item) => item.value).filter(
  (value) => value !== "financialYear",
);

const COMPARE_LABELS: Record<Exclude<DateRangeCompare, "none">, string> = {
  previous: "Previous period",
  lastYear: "Same period last year",
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_FORMAT = "yyyy-MM-dd";
const DAY_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

// ─── Date math ───────────────────────────────────────────────────────────────

/** The dates a preset covers, ending today (or the whole of last month). */
export function presetRange(preset: DateRangePreset, now = new Date()): { from: Date; to: Date } {
  const today = endOfDay(now);
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: today };
    case "yesterday": {
      const day = subDays(now, 1);
      return { from: startOfDay(day), to: endOfDay(day) };
    }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: today };
    case "thisMonth":
      return { from: startOfMonth(now), to: today };
    case "lastMonth": {
      const month = subMonths(now, 1);
      return { from: startOfMonth(month), to: endOfMonth(month) };
    }
    case "thisQuarter":
      return { from: startOfQuarter(now), to: today };
    case "thisYear":
      return { from: startOfYear(now), to: today };
    case "financialYear": {
      // India: 1 April to 31 March.
      const start = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
      return { from: startOfDay(start), to: today };
    }
    case "last30":
    case "custom":
    default:
      return { from: startOfDay(subDays(now, 29)), to: today };
  }
}

/** The preset whose dates match day for day, else "custom". */
export function matchPreset(from: Date, to: Date, now = new Date()): DateRangePreset {
  const found = DATE_RANGE_PRESETS.find(({ value }) => {
    if (value === "custom") return false;
    const range = presetRange(value, now);
    return isSameDay(range.from, from) && isSameDay(range.to, to);
  });
  return found?.value ?? "custom";
}

/** "1 Oct – 4 Nov" (the year only when it isn't this year), one date when both ends are the same day. */
export function formatDateRange(from: Date, to: Date, withTime = false): string {
  const thisYear = new Date().getFullYear();
  const day = (date: Date) => format(date, date.getFullYear() === thisYear ? "d MMM" : "d MMM yyyy");
  const stamp = (date: Date) => (withTime ? `${day(date)}, ${format(date, "h:mm a")}` : day(date));
  return isSameDay(from, to) && !withTime ? day(from) : `${stamp(from)} – ${stamp(to)}`;
}

/** The trigger's label: the preset name, else the dates. */
export function dateRangeLabel(value: Pick<DateRangeValue, "from" | "to" | "preset">, withTime = false): string {
  if (value.preset !== "custom" && !withTime) {
    return DATE_RANGE_PRESETS.find((item) => item.value === value.preset)?.label ?? formatDateRange(value.from, value.to);
  }
  return formatDateRange(value.from, value.to, withTime);
}

/** The comparison dates, or null when compare is off. */
export function compareRange(value: DateRangeValue): { from: Date; to: Date } | null {
  if (value.compare === "lastYear") return { from: subYears(value.from, 1), to: subYears(value.to, 1) };
  if (value.compare === "previous") {
    const days = differenceInCalendarDays(value.to, value.from) + 1;
    return { from: startOfDay(subDays(value.from, days)), to: endOfDay(subDays(value.from, 1)) };
  }
  return null;
}

/** A preset as a full value. */
export function dateRangeFromPreset(preset: DateRangePreset, compare: DateRangeCompare = "none"): DateRangeValue {
  return { ...presetRange(preset), preset, compare };
}

// ─── URL state ───────────────────────────────────────────────────────────────

const CMP_PARAM: Record<DateRangeCompare, string | null> = { none: null, previous: "prev", lastYear: "yoy" };

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const parsed = parse(raw, raw.includes("T") ? DAY_TIME_FORMAT : DAY_FORMAT, new Date());
  return isValid(parsed) ? parsed : null;
}

function parseCompare(raw: string | null): DateRangeCompare | null {
  if (raw === "prev") return "previous";
  if (raw === "yoy") return "lastYear";
  if (raw === "none") return "none";
  return null;
}

/** Reads ?from=&to=&cmp= (null when the URL has no valid range). */
export function dateRangeFromParams(params: URLSearchParams, withTime = false): DateRangeValue | null {
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  if (!from || !to || isAfter(from, to)) return null;
  const start = withTime ? from : startOfDay(from);
  const end = withTime ? to : endOfDay(to);
  return { from: start, to: end, preset: matchPreset(start, end), compare: parseCompare(params.get("cmp")) ?? "none" };
}

/** Writes the range into a copy of `params`. */
export function dateRangeToParams(params: URLSearchParams, value: DateRangeValue, withTime = false): URLSearchParams {
  const next = new URLSearchParams(params);
  const pattern = withTime ? DAY_TIME_FORMAT : DAY_FORMAT;
  next.set("from", format(value.from, pattern));
  next.set("to", format(value.to, pattern));
  next.set("cmp", CMP_PARAM[value.compare] ?? "none");
  return next;
}

interface StoredRange {
  preset: DateRangePreset;
  from: string;
  to: string;
  compare: DateRangeCompare;
}

function readStored(key: string | undefined): DateRangeValue | null {
  if (!key) return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as StoredRange | null;
    if (!saved) return null;
    // A preset follows today (a remembered "Last 30 days" is the last 30 days now); custom keeps its dates.
    if (saved.preset !== "custom") return dateRangeFromPreset(saved.preset, saved.compare);
    const from = new Date(saved.from);
    const to = new Date(saved.to);
    return isValid(from) && isValid(to) ? { from, to, preset: "custom", compare: saved.compare } : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | undefined, value: DateRangeValue) {
  if (!key) return;
  try {
    const saved: StoredRange = {
      preset: value.preset,
      from: value.from.toISOString(),
      to: value.to.toISOString(),
      compare: value.compare,
    };
    window.localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    /* storage blocked: the URL still holds the range */
  }
}

export interface UseUrlDateRangeOptions {
  /** Used when neither the URL nor the remembered range has one. */
  defaultPreset?: DateRangePreset;
  defaultCompare?: DateRangeCompare;
  /** Remembers the last range of this section (pass a per-store key). */
  storageKey?: string;
  withTime?: boolean;
}

/**
 * The range in the URL (?from=&to=&cmp=), else the section's remembered range, else the default. Setting it
 * replaces the URL entry (no new history entry per change) and remembers it.
 */
export function useUrlDateRange({
  defaultPreset = "last30",
  defaultCompare = "none",
  storageKey,
  withTime = false,
}: UseUrlDateRangeOptions = {}): [DateRangeValue, (value: DateRangeValue) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = useMemo(() => dateRangeFromParams(params, withTime), [params, withTime]);
  const fallback = useMemo(
    () => readStored(storageKey) ?? dateRangeFromPreset(defaultPreset, defaultCompare),
    // Read once per section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey],
  );
  const value = fromUrl ?? fallback;
  const setValue = useCallback(
    (next: DateRangeValue) => {
      writeStored(storageKey, next);
      setParams((current) => dateRangeToParams(current, next, withTime), { replace: true });
    },
    [setParams, storageKey, withTime],
  );
  return [value, setValue];
}

// ─── Calendar ────────────────────────────────────────────────────────────────

interface MonthGridProps {
  month: Date;
  from: Date | null;
  to: Date | null;
  hovered: Date | null;
  minDate?: Date;
  maxDate?: Date;
  onPick: (day: Date) => void;
  onHover: (day: Date | null) => void;
}

function MonthGrid({ month, from, to, hovered, minDate, maxDate, onPick, onHover }: MonthGridProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = new Date();
  // While the second end is being chosen, the fill follows the pointer.
  const end = to ?? hovered;
  const [low, high] = from && end ? (isBefore(end, from) ? [end, from] : [from, end]) : [from, from];
  return (
    <div className="zc-drp__month">
      <p className="zc-drp__month-title">{format(month, "MMMM yyyy")}</p>
      <div role="grid" aria-label={format(month, "MMMM yyyy")} className="zc-drp__grid">
        {WEEKDAYS.map((day) => (
          <span key={day} role="columnheader" className="zc-drp__weekday">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          if (outside) return <span key={day.toISOString()} aria-hidden className="zc-drp__day zc-drp__day--outside" />;
          const disabled = (minDate && isBefore(day, startOfDay(minDate))) || (maxDate && isAfter(day, endOfDay(maxDate)));
          const isStart = low != null && isSameDay(day, low);
          const isEnd = high != null && isSameDay(day, high);
          const inRange = low != null && high != null && isAfter(day, low) && isBefore(day, high);
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              disabled={Boolean(disabled)}
              aria-selected={isStart || isEnd || inRange}
              aria-label={format(day, "EEEE d MMMM yyyy")}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              onMouseLeave={() => onHover(null)}
              className={cx(
                "zc-drp__day",
                inRange && "is-in-range",
                (isStart || isEnd) && "is-edge",
                isStart && "is-start",
                isEnd && "is-end",
                isSameDay(day, today) && "is-today",
              )}
            >
              <span>{format(day, "d")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Picker ──────────────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Presets on the left (default the nine G17 presets; add "financialYear" where it fits). */
  presets?: DateRangePreset[];
  /** Which comparisons the page can show; [] hides "Compare to". Default both. */
  compareModes?: Exclude<DateRangeCompare, "none">[];
  /** Time inputs under the calendar (discount and campaign dates); the label shows the times. */
  withTime?: boolean;
  /** Earliest and latest pickable days. Default: no minimum, today as the latest (none with `withTime`). */
  minDate?: Date;
  maxDate?: Date | null;
  /** "secondary" pill (default) or "on-dark" (Home hero). */
  variant?: "secondary" | "on-dark";
  /** Phone: the trigger fills the row (analytics, under the title). */
  fullWidth?: boolean;
  /** Replaces the label. */
  label?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  compareModes = ["previous", "lastYear"],
  withTime = false,
  minDate,
  maxDate,
  variant = "secondary",
  fullWidth = false,
  label,
  className,
  "aria-label": ariaLabel = "Date range",
}: DateRangePickerProps) {
  const isPhone = useIsPhone();
  const popoverMotion = usePresetMotion("popover");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(subMonths(value.to, 1)));
  const latest = maxDate === undefined ? (withTime ? undefined : new Date()) : (maxDate ?? undefined);

  // Each open starts from the applied value, showing the months that hold its end.
  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setAnchor(null);
    setHovered(null);
    setMonth(startOfMonth(isPhone ? value.to : subMonths(value.to, 1)));
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choosePreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setDraft((current) => ({ ...current, preset: "custom" }));
      return;
    }
    const range = presetRange(preset);
    setDraft((current) => ({ ...current, ...range, preset }));
    setAnchor(null);
    setMonth(startOfMonth(isPhone ? range.to : subMonths(range.to, 1)));
  };

  const keepTime = (day: Date, from: Date) => {
    const next = new Date(day);
    next.setHours(from.getHours(), from.getMinutes(), 0, 0);
    return next;
  };

  const pickDay = (day: Date) => {
    if (!anchor) {
      setAnchor(day);
      setDraft((current) => ({
        ...current,
        from: withTime ? keepTime(day, current.from) : startOfDay(day),
        to: withTime ? keepTime(day, current.to) : endOfDay(day),
        preset: "custom",
      }));
      return;
    }
    const [low, high] = isBefore(day, anchor) ? [day, anchor] : [anchor, day];
    setAnchor(null);
    setDraft((current) => {
      const from = withTime ? keepTime(low, current.from) : startOfDay(low);
      const to = withTime ? keepTime(high, current.to) : endOfDay(high);
      return { ...current, from, to, preset: withTime ? "custom" : matchPreset(from, to) };
    });
  };

  const setTime = (edge: "from" | "to", raw: string) => {
    const [hours, minutes] = raw.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    setDraft((current) => {
      const next = new Date(current[edge]);
      next.setHours(hours, minutes, 0, 0);
      return { ...current, [edge]: next, preset: "custom" };
    });
  };

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const comparison = compareRange(draft);
  const triggerLabel = label ?? dateRangeLabel(value, withTime);

  const trigger = (
    <Button
      variant={variant}
      startIcon={<IconCalendar aria-hidden />}
      endIcon={<IconCaret aria-hidden />}
      aria-label={`${ariaLabel}: ${typeof triggerLabel === "string" ? triggerLabel : dateRangeLabel(value, withTime)}`}
      className={cx("num", fullWidth && "max-md:w-full max-md:justify-between", className)}
      onPress={isPhone ? () => setOpen(true) : undefined}
    >
      {triggerLabel}
    </Button>
  );

  const months = isPhone ? [month] : [month, addMonths(month, 1)];
  const body = (
    <div className="zc-drp">
      <div className="zc-drp__main">
        <div role="listbox" aria-label="Presets" className="zc-drp__presets">
          {DATE_RANGE_PRESETS.filter((item) => presets.includes(item.value)).map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={draft.preset === item.value}
              onClick={() => choosePreset(item.value)}
              className={cx("zc-drp__preset", draft.preset === item.value && "is-active")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="zc-drp__calendars">
          <div className="zc-drp__nav">
            <IconButton aria-label="Previous month" size="sm" onPress={() => setMonth((current) => subMonths(current, 1))}>
              <IconPrevPage aria-hidden />
            </IconButton>
            <IconButton aria-label="Next month" size="sm" onPress={() => setMonth((current) => addMonths(current, 1))}>
              <IconNextPage aria-hidden />
            </IconButton>
          </div>
          <div className="zc-drp__months">
            {months.map((item) => (
              <MonthGrid
                key={item.toISOString()}
                month={item}
                from={draft.from}
                to={anchor ? null : draft.to}
                hovered={anchor ? hovered : null}
                minDate={minDate}
                maxDate={latest}
                onPick={pickDay}
                onHover={setHovered}
              />
            ))}
          </div>
          {withTime ? (
            <div className="zc-drp__times">
              <label className="zc-drp__time">
                <span>Starts</span>
                <input
                  type="time"
                  value={format(draft.from, "HH:mm")}
                  onChange={(event) => setTime("from", event.target.value)}
                />
              </label>
              <label className="zc-drp__time">
                <span>Ends</span>
                <input type="time" value={format(draft.to, "HH:mm")} onChange={(event) => setTime("to", event.target.value)} />
              </label>
            </div>
          ) : null}
        </div>
      </div>
      <div className="zc-drp__foot">
        {compareModes.length ? (
          <div className="zc-drp__compare">
            <Switch
              isSelected={draft.compare !== "none"}
              onValueChange={(on) => setDraft((current) => ({ ...current, compare: on ? compareModes[0] : "none" }))}
            >
              Compare to
            </Switch>
            {draft.compare !== "none" && compareModes.length > 1 ? (
              <div role="radiogroup" aria-label="Compare to" className="zc-drp__compare-modes">
                {compareModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={draft.compare === mode}
                    onClick={() => setDraft((current) => ({ ...current, compare: mode }))}
                    className={cx("zc-drp__preset", draft.compare === mode && "is-active")}
                  >
                    {COMPARE_LABELS[mode]}
                  </button>
                ))}
              </div>
            ) : draft.compare !== "none" ? (
              <span className="text-label text-fg-muted">{COMPARE_LABELS[draft.compare]}</span>
            ) : null}
          </div>
        ) : null}
        <p className="zc-drp__summary num">
          {formatDateRange(draft.from, draft.to, withTime)}
          {comparison ? <span className="text-fg-muted"> · vs {formatDateRange(comparison.from, comparison.to)}</span> : null}
        </p>
        <div className="zc-drp__actions">
          <Button variant="secondary" size="sm" onPress={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onPress={apply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );

  if (isPhone) {
    return (
      <>
        {trigger}
        <Modal isOpen={open} onOpenChange={setOpen} size="md" sheet hideCloseButton aria-label={ariaLabel} classNames={{ body: "!p-0" }}>
          <ModalContent>
            <ModalBody className="!p-0">{body}</ModalBody>
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <Popover
      placement="bottom-end"
      offset={8}
      isOpen={open}
      onOpenChange={setOpen}
      motionProps={popoverMotion}
      classNames={{ content: "zc-drp-popover" }}
    >
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent aria-label={ariaLabel}>{body}</PopoverContent>
    </Popover>
  );
}
