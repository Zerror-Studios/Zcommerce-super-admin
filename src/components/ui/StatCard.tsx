/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Children, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "./cx";
import { formatCount, formatMoney, formatPercent } from "./money";
import { Skeleton } from "./Skeleton";
import { Tooltip } from "./Tooltip";

export interface StatCardProps {
  label: ReactNode;
  /** Raw number (formatted by `format`) or pre-formatted content. */
  value: number | string | ReactNode;
  format?: "money" | "number" | "percent";
  currency?: string;
  /** Change (6.7 means +6.7%, or +6.7 pts with deltaUnit "pts"). Omit to hide the arrow. */
  delta?: number | null;
  deltaUnit?: "%" | "pts";
  /** Tertiary context after the delta: "vs previous 30 days", "3 of 7 stores paid". */
  deltaLabel?: ReactNode;
  /** The number in red (overdue) or orange (due, nothing overdue), e.g. Outstanding. */
  valueTone?: "default" | "warning" | "danger";
  /** LEGACY: ignored. KPIs have no icons (docs/design/02-components.md §5). */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  isLoading?: boolean;
  isError?: boolean;
  /** Makes the whole cell a link. */
  href?: string;
  /** Render without its own card (inside KpiStrip). */
  bare?: boolean;
  className?: string;
}

function formatValue(value: StatCardProps["value"], format: StatCardProps["format"], currency?: string): ReactNode {
  if (typeof value !== "number") return value;
  if (format === "money") return formatMoney(value, { currency, whole: true });
  if (format === "percent") return formatPercent(value);
  return formatCount(value);
}

/**
 * KPI cell (01 §7.13): label 13/500 muted → the number (32px when the cell is at least 200px wide, else 24px;
 * tabular) → the change as a small chip ("↑ 100.7%", green or red) whose tooltip says "vs previous 30 days", or a
 * muted sub-line when there is no change to show. Use several inside <KpiStrip>; alone it renders its own card.
 */
export function StatCard({
  label,
  value,
  format = "number",
  currency,
  delta,
  deltaUnit = "%",
  deltaLabel = "vs previous period",
  valueTone = "default",
  isLoading = false,
  isError = false,
  href,
  bare = false,
  className,
}: StatCardProps) {
  const body = (
    <>
      <p className="truncate text-label font-medium text-fg-muted">{label}</p>
      {isLoading ? (
        <>
          <Skeleton className="mt-2 h-7 w-30 rounded-md" />
          <Skeleton className="mt-2 h-5.5 w-16 rounded-md" />
        </>
      ) : isError ? (
        <>
          <p className="zc-kpi-value mt-1 text-fg-subtle">—</p>
          <p className="mt-1 text-caption text-fg-muted">Couldn't load</p>
        </>
      ) : (
        <>
          <p className={cx("zc-kpi-value mt-1 num", valueTone === "danger" ? "text-tone-danger-text" : valueTone === "warning" ? "text-tone-warning" : "text-fg")}>
            {formatValue(value, format, currency)}
          </p>
          <Delta delta={delta} unit={deltaUnit} label={deltaLabel} />
        </>
      )}
    </>
  );
  const classes = cx(
    "zc-kpi-cell block min-w-0 bg-surface px-5 py-4",
    !bare && "rounded-[var(--zc-radius-card)] border border-line",
    href && "transition-colors duration-fast ease-standard hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none",
    className,
  );
  return href ? (
    <Link to={href} className={classes}>
      {body}
    </Link>
  ) : (
    <section className={classes}>{body}</section>
  );
}

function Delta({ delta: raw, unit, label }: { delta?: number | null; unit: "%" | "pts"; label: ReactNode }) {
  // No change to show: the label (if any) is a muted sub-line ("Connect Google Analytics").
  if (raw == null || !Number.isFinite(raw)) {
    return label ? <p className="mt-1 truncate text-caption font-normal text-fg-muted">{label}</p> : null;
  }
  const shown = Number(Math.abs(raw).toFixed(1));
  const up = raw > 0 && shown > 0;
  const down = raw < 0 && shown > 0;
  const amount = unit === "pts" ? `${shown} pts` : formatPercent(Math.abs(raw));
  const chip = (
    <span
      className={cx(
        "mt-1.5 inline-flex h-5.5 items-center rounded-md px-[7px] text-caption-strong num",
        up ? "bg-tone-success-soft text-tone-success" : down ? "bg-tone-danger-soft text-tone-danger-text" : "bg-tone-neutral-soft text-tone-neutral",
      )}
    >
      {up ? "↑ " : down ? "↓ " : ""}
      {amount}
    </span>
  );
  return label ? (
    <Tooltip content={label} placement="bottom-start">
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

export interface KpiStripProps {
  children: ReactNode;
  className?: string;
}

/**
 * KPI strip (01 §7.13): one card split into equal cells by 1px dividers; 4, 5 or 6 cells. Desktop: one row (6 =
 * two rows of three). Tablet: 4 → 2 + 2, 5 → 3 + 2, 6 → 3 + 3. Phone: two columns, an odd last cell spans both.
 */
export function KpiStrip({ children, className }: KpiStripProps) {
  const cells = Children.toArray(children).filter(Boolean).length;
  return (
    <section data-cells={cells} className={cx("zc-kpi-strip", className)}>
      {children}
    </section>
  );
}
