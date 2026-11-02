/**
 * Breakdown cards for the snapshot tabs (backend PRD-026, guide §4): a
 * metric's items as ranked bars (stores link to their page), and the
 * special shapes: the MRR movement (New, Expansion, Contraction, Churned),
 * retention bands ("5 of 7"), the go-live cohort table and churn reasons.
 * Every figure is the server's; nothing is turned into a rate here.
 */

import { Link } from "react-router-dom";

import { Card, RankedBars, Tooltip } from "../../ui";
import { cx } from "../../ui/cx";
import { IconInfo } from "../../ui/icons";
import { toneTextClasses } from "../../ui/tones";
import {
  churnReasonLabel,
  coverageText,
  formatMetricValue,
  metricHelp,
  smallSampleNote,
  smallSampleText,
} from "../../../lib/platform-insights.util";
import type { PlatformMetric } from "../../../types/platform-insights";
import {
  COHORT_KEYS,
  cohortMonthLabel,
  cohortRows,
  itemDisplay,
  mrrMovementRows,
} from "./snapshot-tabs.util";

// ─── Shared ───────────────────────────────────────────────────────────────

function BreakdownCard({
  metric,
  smallSampleThreshold,
  children,
}: {
  metric: PlatformMetric;
  smallSampleThreshold: number | null;
  children: React.ReactNode;
}) {
  const help = metricHelp(metric);
  const coverage = coverageText(metric.coverage);
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1">
          {metric.label}
          {help ? (
            <Tooltip content={<span className="whitespace-pre-line">{help}</span>} placement="top-start">
              <button type="button" aria-label={`About ${metric.label}`} className="text-fg-subtle">
                <IconInfo aria-hidden className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </span>
      }
      description={
        metric.status === "SMALL_SAMPLE"
          ? `${smallSampleText(metric)} · ${smallSampleNote(metric, smallSampleThreshold)}`
          : (coverage ?? metric.reason ?? undefined)
      }
    >
      {children}
    </Card>
  );
}

// ─── Bars ─────────────────────────────────────────────────────────────────

/** Any metric's items as ranked bars, in the metric's unit. */
function ItemBars({ metric }: { metric: PlatformMetric }) {
  const items = (metric.items ?? []).map((item, index) => ({
    key: `${item.tenantId ?? item.label}-${index}`,
    label: item.tenantId ? (
      <Link to={`/stores/${item.tenantId}`} className="hover:underline">
        {item.label}
      </Link>
    ) : (
      item.label
    ),
    value: Math.max(0, Number(item.value ?? 0)),
    display: itemDisplay(item, metric.unit),
  }));
  return <RankedBars items={items} />;
}

/** Churn reasons by their labels ("Not recorded" for old cancels). */
function ChurnReasons({ metric }: { metric: PlatformMetric }) {
  const items = (metric.items ?? []).map((item, index) => ({
    key: `${item.label}-${index}`,
    label: churnReasonLabel(item.label),
    value: Math.max(0, Number(item.value ?? 0)),
    display: formatMetricValue(item.value, "COUNT"),
  }));
  return <RankedBars items={items} />;
}

/** The MRR movement: each part signed, ups green and downs red, net last. */
function MrrMovement({ metric }: { metric: PlatformMetric }) {
  const rows = mrrMovementRows(metric);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-body">
            <span className="text-fg">{row.label}</span>
            <span
              className={cx(
                "num",
                row.direction === "up" ? toneTextClasses.success : row.direction === "down" ? toneTextClasses.danger : "text-fg-muted",
              )}
            >
              {row.value > 0 ? "+" : ""}
              {formatMetricValue(row.value, "CURRENCY")}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-surface-sunken">
            <div
              className={cx("h-1 rounded-full", row.direction === "down" ? "bg-tone-danger" : "bg-tone-success")}
              style={{ width: max > 0 ? `${(Math.abs(row.value) / max) * 100}%` : 0 }}
            />
          </div>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-3 border-t border-line pt-3 text-body">
        <span className="font-medium text-fg">Net new MRR</span>
        <span className="font-medium num text-fg">{formatMetricValue(metric.value, "CURRENCY")}</span>
      </li>
    </ul>
  );
}

/** Go-live cohorts: stores per month and still active after 1, 3, 6 and 12 months. */
function CohortTable({ metric }: { metric: PlatformMetric }) {
  const rows = cohortRows(metric);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-body">
        <caption className="sr-only">Stores still active after N months, by go-live month</caption>
        <thead>
          <tr className="text-left text-label text-fg-muted">
            <th scope="col" className="pb-2 pr-4 font-medium">Went live</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Stores</th>
            {COHORT_KEYS.map((key) => (
              <th key={key} scope="col" className="pb-2 pr-4 font-medium">
                After {key.slice(1)} {key === "m1" ? "month" : "months"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-fg">
                {cohortMonthLabel(row.label)}
              </th>
              <td className="py-2 pr-4 num">{formatMetricValue(row.stores, "COUNT")}</td>
              {row.cells.map((cell, index) => (
                <td key={COHORT_KEYS[index]} className={cx("py-2 pr-4 num", cell == null && "text-fg-subtle")}>
                  {cell == null ? (
                    <span title="Not reached yet">—</span>
                  ) : (
                    `${formatMetricValue(cell, "COUNT")} of ${formatMetricValue(row.stores, "COUNT")}`
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-fg-muted">"—" means the cohort hasn't reached that month yet.</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export function MetricBreakdown({
  metric,
  smallSampleThreshold,
}: {
  metric: PlatformMetric;
  smallSampleThreshold: number | null;
}) {
  let body: React.ReactNode;
  if (metric.key === "netNewMrr") body = <MrrMovement metric={metric} />;
  else if (metric.key === "tenureCohorts") body = <CohortTable metric={metric} />;
  else if (metric.key === "churnReasons") body = <ChurnReasons metric={metric} />;
  else body = <ItemBars metric={metric} />;
  return (
    <BreakdownCard metric={metric} smallSampleThreshold={smallSampleThreshold}>
      {body}
    </BreakdownCard>
  );
}

export default MetricBreakdown;
