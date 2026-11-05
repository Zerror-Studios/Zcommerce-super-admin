/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Home hero (docs/design-v2/README.md §6.1; styles `.zc-hero` in src/styles/components.css). Used by the Merchant
 * Admin Home and the Super Admin Home.
 *
 * A deep-blue band (radius 28, about 300px tall) with four soft lights drifting slowly (transform only) and a faint
 * noise overlay. Top: the date in mono and the page's one or two actions ("View store ↗", a ⋯ menu). Then
 * "Good morning, **Aarav**", the orb with a one-line summary, and a bottom row with up to three chips (a green or
 * red dot each) and the period tabs. It never holds a button that asks AI (§3.3: the bottom bar is the one place).
 * Under 768px (v2 §10) it is 220px with the greeting on one line and the AI line; the date is hidden, the lights
 * stand still, and the chips and period tabs scroll sideways in the bottom row.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { Orb } from "./Orb";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Which way a chip's number went: up (green dot), down (red dot), flat or unknown (white dot, no arrow). */
export type HomeHeroTrend = "up" | "down" | "flat";

export interface HomeHeroChip {
  key: string;
  /** "Sales" */
  label: ReactNode;
  /** "48.7%" (the arrow comes from `trend`), or a plain value when there is nothing to compare with. */
  value?: ReactNode;
  trend?: HomeHeroTrend;
  /** Tooltip, e.g. "vs the previous 30 days". */
  title?: string;
}

export interface HomeHeroPeriod<V extends string = string> {
  value: V;
  label: string;
}

export interface HomeHeroProps<V extends string = string> {
  /** Top left, shown in mono capitals. Defaults to today ("Thursday, 5 November"). */
  date?: ReactNode;
  /** Defaults to the time of day ("Good morning"). */
  greeting?: ReactNode;
  /** The first name, in 600 on its own line. Without it the greeting stands alone. */
  name?: ReactNode;
  /**
   * Top right: "View store ↗" and, where the page has rare actions, a ⋯ menu (glass buttons). One main action
   * ("Create store", board 02) uses variant="on-dark"; a primary passed in is drawn the same white way. Buttons here
   * are 34px, like the board's pills, whatever size they pass.
   */
  actions?: ReactNode;
  /** The one-line summary after the orb. Hidden when empty. */
  summary?: ReactNode;
  /** Up to three chips (Sales, Orders, Visitors). */
  chips?: HomeHeroChip[];
  periods?: HomeHeroPeriod<V>[];
  period?: V;
  onPeriodChange?: (value: V) => void;
  /** Names the period group for screen readers. */
  periodLabel?: string;
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** "Good morning" before 12, "Good afternoon" before 17, then "Good evening". */
function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const todayLabel = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

const TREND_WORD: Record<HomeHeroTrend, string> = { up: "up", down: "down", flat: "" };

// ─── Component ─────────────────────────────────────────────────────────────────

export function HomeHero<V extends string = string>({
  date,
  greeting,
  name,
  actions,
  summary,
  chips = [],
  periods = [],
  period,
  onPeriodChange,
  periodLabel = "Period",
  className,
}: HomeHeroProps<V>) {
  const tabsRef = useRef<HTMLDivElement>(null);

  // A radio group: arrow keys move the choice (and the focus), Tab leaves the group.
  const onTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step || periods.length === 0) return;
    event.preventDefault();
    const index = Math.max(0, periods.findIndex((item) => item.value === period));
    const next = periods[(index + step + periods.length) % periods.length];
    onPeriodChange?.(next.value);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <section className={cx("zc-hero", className)}>
      <span aria-hidden className="zc-hero__light zc-hero__light--3" />
      <span aria-hidden className="zc-hero__light zc-hero__light--1" />
      <span aria-hidden className="zc-hero__light zc-hero__light--2" />
      <span aria-hidden className="zc-hero__light zc-hero__light--4" />
      <span aria-hidden className="zc-hero__noise" />

      <div className="zc-hero__top">
        <span className="zc-hero__date">{date ?? todayLabel()}</span>
        {actions ? <div className="zc-hero__actions">{actions}</div> : null}
      </div>

      <h1 className="zc-hero__greeting">
        {greeting ?? greetingFor()}
        {name ? (
          <>
            ,{" "}
            {/* The name goes on its own line from 768px up; on phone the greeting is one line (the break hides). */}
            <br />
            <b>{name}</b>
          </>
        ) : null}
      </h1>

      {summary ? (
        <div className="zc-hero__summary">
          <Orb onDark />
          <p>{summary}</p>
        </div>
      ) : null}

      {chips.length > 0 || periods.length > 0 ? (
        <div className="zc-hero__bottom">
          {chips.length > 0 ? (
            <ul className="zc-hero__chips">
              {chips.map((chip) => {
                const trend = chip.trend ?? "flat";
                return (
                  <li key={chip.key} className="zc-hero__chip" title={chip.title}>
                    <span aria-hidden className="zc-hero__dot" data-trend={trend} />
                    {chip.label}
                    {chip.value != null ? (
                      <b>
                        {trend !== "flat" ? <span aria-hidden>{trend === "up" ? "↑ " : "↓ "}</span> : null}
                        {trend !== "flat" ? <span className="sr-only">{TREND_WORD[trend]} </span> : null}
                        {chip.value}
                      </b>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {periods.length > 0 ? (
            <div ref={tabsRef} role="radiogroup" aria-label={periodLabel} className="zc-hero__tabs" onKeyDown={onTabsKeyDown}>
              {periods.map((item) => {
                const selected = item.value === period;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected || (period == null && item === periods[0]) ? 0 : -1}
                    data-value={item.value}
                    className="zc-hero__tab"
                    onClick={() => onPeriodChange?.(item.value)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
