/**
 * One snapshot metric as a KPI cell (backend PRD-026, guide §1). It fits
 * inside `KpiStrip` like `StatCard` (`bare`), or stands alone.
 *
 * - OK: the value in its unit, the change against the previous period
 *   (green or red the right way round), the definition and formula in a
 *   tooltip, and coverage ("Based on 12 of 15 stores").
 * - SMALL_SAMPLE: no value; the count and the store names, and the note
 *   "Rates are shown from 20 stores".
 * - UNAVAILABLE: a grey cell with the reason and, when given, the fix.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Skeleton, Tooltip } from "../ui";
import { cx } from "../ui/cx";
import { IconInfo } from "../ui/icons";
import {
  changeTone,
  coverageText,
  formatMetricChange,
  formatMetricValue,
  metricHelp,
  smallSampleNote,
  smallSampleText,
} from "../../lib/platform-insights.util";
import type { PlatformMetric } from "../../types/platform-insights";

export interface MetricCardProps {
  metric: PlatformMetric | null | undefined;
  /** Overrides the server's label (e.g. "Stores lost" for `churned`). */
  label?: ReactNode;
  /** The snapshot's small-sample threshold, for the note. */
  smallSampleThreshold?: number | null;
  /** Inside a `KpiStrip`: no border of its own. */
  bare?: boolean;
  isLoading?: boolean;
  href?: string;
  className?: string;
}

const CHANGE_CLASSES = {
  success: "bg-tone-success-soft text-tone-success",
  danger: "bg-tone-danger-soft text-tone-danger-text",
  neutral: "bg-tone-neutral-soft text-tone-neutral",
} as const;

function MetricBody({
  metric,
  label,
  smallSampleThreshold,
  isLoading,
}: Pick<MetricCardProps, "metric" | "label" | "smallSampleThreshold" | "isLoading">) {
  const title = label ?? metric?.label ?? "—";
  if (isLoading || !metric) {
    return (
      <>
        <p className="truncate text-label font-medium text-fg-muted">{title}</p>
        {isLoading ? (
          <>
            <Skeleton className="mt-2 h-7 w-30 rounded-md" />
            <Skeleton className="mt-2 h-5.5 w-16 rounded-md" />
          </>
        ) : (
          <p className="zc-kpi-value mt-1 text-fg-subtle">—</p>
        )}
      </>
    );
  }

  const help = metricHelp(metric);
  const heading = (
    <div className="flex min-w-0 items-center gap-1">
      <p className="truncate text-label font-medium text-fg-muted">{title}</p>
      {help ? (
        <Tooltip content={<span className="whitespace-pre-line">{help}</span>} placement="top-start">
          <button type="button" aria-label={`About ${metric.label}`} className="shrink-0 text-fg-subtle">
            <IconInfo aria-hidden className="size-3.5" />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );

  if (metric.status === "UNAVAILABLE") {
    return (
      <>
        {heading}
        <p className="zc-kpi-value mt-1 text-fg-subtle">—</p>
        <p className="mt-1 text-caption text-fg-muted">{metric.reason ?? "Not available yet"}</p>
        {metric.fix ? <p className="mt-0.5 text-caption text-fg-subtle">{metric.fix}</p> : null}
      </>
    );
  }

  if (metric.status === "SMALL_SAMPLE") {
    return (
      <>
        {heading}
        <p className="zc-kpi-value mt-1 num text-fg">{metric.count ?? 0}</p>
        <p className="mt-1 text-caption text-fg">{smallSampleText(metric)}</p>
        <p className="mt-0.5 text-caption text-fg-muted">
          {smallSampleNote(metric, smallSampleThreshold)}
        </p>
      </>
    );
  }

  const tone = changeTone(metric);
  const change = formatMetricChange(metric);
  const coverage = coverageText(metric.coverage);
  return (
    <>
      {heading}
      <p className="zc-kpi-value mt-1 num text-fg">{formatMetricValue(metric.value, metric.unit)}</p>
      {metric.changePercent != null && Number.isFinite(metric.changePercent) ? (
        <Tooltip
          content={`vs ${formatMetricValue(metric.previousValue, metric.unit)} the previous period`}
          placement="bottom-start"
        >
          <span
            className={cx(
              "mt-1.5 inline-flex h-5.5 items-center rounded-md px-[7px] text-caption-strong num",
              CHANGE_CLASSES[tone],
            )}
          >
            {metric.changePercent > 0 ? "↑ " : metric.changePercent < 0 ? "↓ " : ""}
            {change.replace(/^[+−]/, "")}
          </span>
        </Tooltip>
      ) : null}
      {coverage ? <p className="mt-1 text-caption text-fg-muted">{coverage}</p> : null}
    </>
  );
}

export function MetricCard({
  metric,
  label,
  smallSampleThreshold,
  bare = false,
  isLoading = false,
  href,
  className,
}: MetricCardProps) {
  const classes = cx(
    "zc-kpi-cell block min-w-0 bg-surface px-5 py-4",
    !bare && "rounded-card-lg border border-line",
    metric?.status === "UNAVAILABLE" && "bg-surface-muted",
    href &&
      "transition-colors duration-fast ease-standard hover:bg-row-hover focus-visible:shadow-focus-strong focus-visible:outline-none",
    className,
  );
  const body = (
    <MetricBody
      metric={metric}
      label={label}
      smallSampleThreshold={smallSampleThreshold}
      isLoading={isLoading}
    />
  );
  return href ? (
    <Link to={href} className={classes}>
      {body}
    </Link>
  ) : (
    <section className={classes}>{body}</section>
  );
}

export default MetricCard;
