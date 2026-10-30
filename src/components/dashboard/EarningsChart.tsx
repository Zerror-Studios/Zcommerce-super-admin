import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPlanRevenue } from "../../types/reports";
import { monthTotal } from "../../lib/api-report-adapters";
import { ButtonLink, Card, Skeleton, chartColors, formatMoney, recharts } from "../ui";
import { IconExpand } from "../ui/icons";

export interface EarningsChartProps {
  /** The year's plan revenue by month from `platformRevenueOverview` (PRD-005 FR-5.3). */
  monthly: MonthlyPlanRevenue[];
  /** Current monthly billing (ACTIVE subscriptions), drawn for the months still ahead. */
  monthlyBilling: number;
  now?: Date;
  isLoading?: boolean;
}

interface EarningsPoint {
  month: string;
  /** Billed in the month; null for future months. */
  collected: number | null;
  /** Monthly billing for months still ahead; null for past months. */
  projected: number | null;
}

const monthShort = new Intl.DateTimeFormat("en-IN", { month: "short" });

/**
 * One bar per month of the year, from the first month with data: past months solid (chart-1),
 * months still ahead as dashed outlines at the current monthly billing (same rule as the server's projection).
 */
function buildEarnings(monthly: MonthlyPlanRevenue[], billing: number, now: Date): EarningsPoint[] {
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const byMonth = new Map(monthly.filter((row) => row.year === year).map((row) => [row.month - 1, monthTotal(row)]));
  const firstDataMonth = [...byMonth.keys()].reduce((min, month) => Math.min(min, month), currentMonth);

  const points: EarningsPoint[] = [];
  for (let month = firstDataMonth; month < 12; month += 1) {
    const isFuture = month > currentMonth;
    points.push({
      month: monthShort.format(new Date(year, month, 1)),
      collected: isFuture ? null : (byMonth.get(month) ?? 0),
      projected: isFuture ? billing : null,
    });
  }
  return points;
}

interface TooltipPayloadItem {
  value?: number | null;
  dataKey?: string | number;
}

function EarningsTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string | number }) {
  const entry = payload?.find((item) => item.value != null);
  if (!active || !entry) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="text-caption text-fg-muted">{label}</p>
      <p className="text-caption font-medium text-fg num">
        {entry.dataKey === "projected" ? "Projected" : "Billed"}: {formatMoney(entry.value ?? 0, { whole: true })}
      </p>
    </div>
  );
}

/** Dashed outline bar for projected months (docs/design/02-components.md §14: dashed --chart-projected). */
function ProjectedBar(props: { x?: number; y?: number; width?: number; height?: number }) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  if (height <= 0) return null;
  return (
    <rect
      x={x + 0.5}
      y={y + 0.5}
      width={Math.max(width - 1, 0)}
      height={Math.max(height - 1, 0)}
      rx={4}
      fill="none"
      strokeDasharray="3 3"
      style={{ stroke: "var(--zc-chart-projected)" }}
    />
  );
}

/**
 * "Earnings · {year}" (04 S-01): billed bars and dashed projected bars, 220px, y axis in full rupees (01 §7.25);
 * legend dots and "View full report ›" in the header. All zero → a flat baseline with "No earnings yet this year".
 */
export function EarningsChart({ monthly, monthlyBilling, now = new Date(), isLoading }: EarningsChartProps) {
  const data = useMemo(() => buildEarnings(monthly, monthlyBilling, now), [monthly, monthlyBilling, now]);
  const hasProjected = data.some((point) => point.projected != null);
  const allZero = data.every((point) => !point.collected && !point.projected);

  return (
    <Card
      title={`Earnings · ${now.getFullYear()}`}
      className="h-full"
      actions={
        <div className="flex items-center gap-4">
          {allZero ? null : (
            <div className="flex items-center gap-3 text-caption text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-chart-1" />
                Billed
              </span>
              {hasProjected ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full border border-dashed border-chart-projected" />
                  Projected
                </span>
              ) : null}
            </div>
          )}
          <ButtonLink variant="tertiary" size="sm" to="/analytics/revenue" endIcon={<IconExpand aria-hidden />}>
            View full report
          </ButtonLink>
        </div>
      }
    >
      {isLoading ? (
        <Skeleton className="h-55 w-full rounded-xl" />
      ) : allZero ? (
        <div className="flex h-55 w-full flex-col justify-end">
          <p className="mb-auto mt-auto text-center text-label text-fg-subtle">No earnings yet this year</p>
          <div aria-hidden className="h-px w-full bg-chart-baseline" />
        </div>
      ) : (
        <div className="h-55 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid {...recharts.grid} />
              <XAxis dataKey="month" {...recharts.axis} />
              <YAxis {...recharts.axis} width={72} tickFormatter={(v: number) => formatMoney(v, { whole: true })} />
              <Tooltip content={<EarningsTooltip />} cursor={{ fill: chartColors.grid, opacity: 0.4 }} />
              <Bar dataKey="collected" stackId="earnings" fill={chartColors.series[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="projected" stackId="earnings" shape={<ProjectedBar />} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
