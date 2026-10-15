/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx } from "./cx";
import { IconTrendDown, IconTrendUp } from "./icons";
import { formatCount, formatDelta, formatMoney } from "./money";
import { Skeleton } from "./Skeleton";

export interface StatCardProps {
  label: ReactNode;
  /** Raw number (formatted by `format`) or pre-formatted content. */
  value: number | string | ReactNode;
  format?: "money" | "number" | "percent";
  currency?: string;
  /** Change in percent (6.7 means +6.7%). Omit to hide the delta row. */
  delta?: number | null;
  deltaLabel?: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  isLoading?: boolean;
  isError?: boolean;
  /** Makes the whole card a link. */
  href?: string;
  className?: string;
}

function formatValue(value: StatCardProps["value"], format: StatCardProps["format"], currency?: string): ReactNode {
  if (typeof value !== "number") return value;
  if (format === "money") return formatMoney(value, { currency });
  if (format === "percent") return `${value.toFixed(1)}%`;
  return formatCount(value);
}

/** KPI card (component-specs §19): label + solid icon tile, 30px value, delta with arrow. */
export function StatCard({
  label,
  value,
  format = "number",
  currency,
  delta,
  deltaLabel = "vs last period",
  icon: Icon,
  isLoading = false,
  isError = false,
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-body font-medium text-fg-muted">{label}</p>
        {Icon ? (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="mt-4 h-9 w-32" />
          <Skeleton className="mt-2 h-4 w-24" />
        </>
      ) : isError ? (
        <>
          <p className="mt-4 text-display font-bold text-fg">—</p>
          <p className="mt-2 text-caption text-fg-muted">Couldn't load</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-display font-bold text-fg tabular-nums">{formatValue(value, format, currency)}</p>
          {delta != null ? <Delta delta={delta} label={deltaLabel} /> : null}
        </>
      )}
    </>
  );

  const classes = cx(
    "block min-h-40 rounded-card border border-line bg-surface p-6 shadow-card",
    href &&
      "outline-hidden transition-shadow duration-fast ease-standard hover:shadow-popover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
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

function Delta({ delta, label }: { delta: number; label: string }) {
  const tone = delta > 0 ? "text-tone-success" : delta < 0 ? "text-tone-danger-text" : "text-fg-muted";
  const Arrow = delta > 0 ? IconTrendUp : delta < 0 ? IconTrendDown : null;
  return (
    <p className="mt-2 flex items-center gap-1 text-caption">
      <span className={cx("inline-flex items-center gap-1 font-medium tabular-nums", tone)}>
        {Arrow ? <Arrow aria-hidden className="size-3" /> : null}
        {formatDelta(delta)}
      </span>
      <span className="text-fg-muted">{label}</span>
    </p>
  );
}
