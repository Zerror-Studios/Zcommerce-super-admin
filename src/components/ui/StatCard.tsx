/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "./cx";
import { IconTrendDown, IconTrendUp } from "./icons";
import { formatCount, formatMoney, formatPercent } from "./money";
import { Skeleton } from "./Skeleton";

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
  /** Shows the value in red (e.g. Outstanding > 0). */
  valueTone?: "default" | "danger";
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
 * KPI cell (docs/design/02-components.md §5): label 13/500 secondary → value 26/600 tabular →
 * one 12px line: green/red arrow + change, then tertiary context. No icons.
 * Use several inside <KpiStrip> (one card, equal cells, vertical dividers); alone it renders its own card.
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
      <p className="text-label font-medium text-fg-muted">{label}</p>
      {isLoading ? (
        <>
          <Skeleton className="mt-2 h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-40" />
        </>
      ) : isError ? (
        <>
          <p className="mt-1 text-display font-semibold text-fg-subtle">—</p>
          <p className="mt-1 text-caption text-fg-muted">Couldn't load</p>
        </>
      ) : (
        <>
          <p
            className={cx(
              "mt-1 text-display font-semibold num",
              valueTone === "danger" ? "text-tone-danger-text" : "text-fg",
            )}
          >
            {formatValue(value, format, currency)}
          </p>
          <Delta delta={delta} unit={deltaUnit} label={deltaLabel} />
        </>
      )}
    </>
  );

  const classes = cx(
    "block min-w-0 px-5 py-4",
    !bare && "rounded-card border border-line bg-surface",
    href &&
      "transition-colors duration-instant ease-standard hover:bg-surface-muted focus-visible:shadow-focus",
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

function Delta({ delta, unit, label }: { delta?: number | null; unit: "%" | "pts"; label: ReactNode }) {
  if (delta == null && !label) return null;
  const tone = delta == null || delta === 0 ? "text-fg-muted" : delta > 0 ? "text-tone-success" : "text-tone-danger-text";
  const Arrow = delta == null || delta === 0 ? null : delta > 0 ? IconTrendUp : IconTrendDown;
  const amount = delta == null ? null : unit === "pts" ? `${Number(Math.abs(delta).toFixed(1))} pts` : formatPercent(Math.abs(delta));
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1 text-caption">
      {amount != null ? (
        <span className={cx("inline-flex items-center gap-0.5 font-medium num", tone)}>
          {Arrow ? <Arrow aria-hidden className="size-3" /> : null}
          {amount}
        </span>
      ) : null}
      {label ? <span className="text-fg-subtle">{label}</span> : null}
    </p>
  );
}

export interface KpiStripProps {
  children: ReactNode;
  className?: string;
}

/** KPI strip: one card, equal cells, 1px vertical dividers (stacked with horizontal dividers on phones). Max 4–5 cells. */
export function KpiStrip({ children, className }: KpiStripProps) {
  return (
    <section
      className={cx(
        "flex flex-col divide-y divide-line rounded-card border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0 [&>*]:flex-1",
        className,
      )}
    >
      {children}
    </section>
  );
}
