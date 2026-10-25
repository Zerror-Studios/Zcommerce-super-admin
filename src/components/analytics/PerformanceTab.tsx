import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltipSlot,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalyticsOverview } from "../../hooks/use-platform-analytics";
import {
  DEFAULT_PERFORMANCE_RANGE_DAYS,
  PERFORMANCE_RANGE_DAYS,
  changePercent,
  changePoints,
  lastDaysRange,
  type PerformanceRangeDays,
} from "../../lib/analytics-health";
import type { StorePerformanceRow } from "../../types/platform-api";
import { emptyStates, toasts } from "../../copy";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
import { areaGradientStops, chartColors, recharts } from "../ui/chart-theme";
import {
  Card,
  EmptyState,
  ErrorState,
  KpiStrip,
  SegmentedControl,
  StatCard,
  cx,
  formatCount,
  formatDate,
  formatDelta,
  formatMoney,
  formatPercent,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";

const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

const rangeOptions = PERFORMANCE_RANGE_DAYS.map((days) => ({ value: String(days), label: `${days} days` }));

const legendProps = {
  verticalAlign: "top",
  align: "right",
  iconType: "circle",
  iconSize: 8,
  height: 28,
  wrapperStyle: { fontSize: 12 },
} as const;

const moneyAxis = (v: number) => formatMoney(v, { compact: true });
const countAxis = (v: number) => formatCount(v, true);

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

/** Popover-style chart tooltip; GMV is money, the rest are counts. */
function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-caption text-fg-subtle">{formatDate(String(label))}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-caption text-fg">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          <span className="text-fg-muted">{entry.name ?? entry.dataKey}</span>
          <span className="ml-auto pl-3 font-medium num">
            {entry.dataKey === "gmv" ? formatMoney(entry.value ?? 0, { whole: true }) : formatCount(entry.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

function Growth({ value }: { value: number }) {
  // growthPercent −100 means "no sales in the previous period" (docs/design/05-wording.md §2).
  if (value <= -100) return <span className={cx(right, "text-fg-subtle")}>—</span>;
  const tone = value === 0 ? undefined : value > 0 ? toneTextClasses.success : toneTextClasses.danger;
  return <span className={cx(right, tone)}>{formatDelta(value)}</span>;
}

function StoreCell({ row }: { row: StorePerformanceRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate whitespace-nowrap font-medium text-fg">{row.name}</p>
      <p className="truncate text-caption text-fg-subtle">{row.slug}</p>
    </div>
  );
}

/**
 * Analytics › Performance (PRD-012 FR-8.3): platform-wide sessions, orders,
 * GMV and conversion for the last 7/30/90 days, the daily trend, and the top
 * stores by GMV and by growth. Every figure is the server's; the console only
 * shows the change against the previous period of the same length.
 */
export function PerformanceTab() {
  const navigate = useNavigate();
  const [days, setDays] = useState<PerformanceRangeDays>(DEFAULT_PERFORMANCE_RANGE_DAYS);
  const range = useMemo(() => lastDaysRange(days), [days]);

  /* ----- Queries & Mutations ----- */
  const api = useAnalyticsOverview(range);
  const overview = api.data;
  const kpis = overview?.kpis;
  const previous = overview?.previous;
  const trend = overview?.trend ?? [];

  const noData = <EmptyState compact description={emptyStates.noData} />;
  const openStore = (tenantId: string) => navigate(`/stores/${tenantId}`);
  const previousLabel = `vs previous ${days} days`;

  const storeColumns = (
    <TableHeader>
      <TableColumn>Store</TableColumn>
      <TableColumn align="end">Sessions · 30d</TableColumn>
      <TableColumn align="end">Orders · 30d</TableColumn>
      <TableColumn align="end">Net sales · 30d</TableColumn>
      <TableColumn align="end">vs previous 30 days</TableColumn>
      <TableColumn align="end">Conversion</TableColumn>
      <TableColumn>Analytics</TableColumn>
    </TableHeader>
  );

  const storeRow = (row: StorePerformanceRow) => (
    <TableRow key={row.tenantId} className="cursor-pointer" onClick={() => openStore(row.tenantId)}>
      <TableCell><StoreCell row={row} /></TableCell>
      <TableCell><span className={right}>{formatCount(row.sessions30d)}</span></TableCell>
      <TableCell><span className={right}>{formatCount(row.orders30d)}</span></TableCell>
      <TableCell><span className={cx(right, "font-medium")}>{formatMoney(row.revenue30d, { whole: true })}</span></TableCell>
      <TableCell><Growth value={row.growthPercent} /></TableCell>
      <TableCell>
        <span className={right}>{row.sessions30d > 0 ? formatPercent(row.conversionRate30d) : "—"}</span>
      </TableCell>
      <TableCell><AnalyticsHealthChip health={row.analyticsHealth} /></TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Traffic, orders and sales across every store, from each store's analytics and orders."
        actions={
          <SegmentedControl
            aria-label="Period"
            options={rangeOptions}
            value={String(days)}
            onChange={(value) => setDays(Number(value) as PerformanceRangeDays)}
          />
        }
      />

      {api.error ? (
        <ErrorState title="Couldn't load performance." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : null}

      <div className="space-y-4">
        <KpiStrip>
          <StatCard
            bare
            isLoading={api.loading}
            label="Sessions"
            value={kpis?.sessions ?? 0}
            delta={kpis && previous ? changePercent(kpis.sessions, previous.sessions) : null}
            deltaLabel={previousLabel}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Orders"
            value={kpis?.orders ?? 0}
            delta={kpis && previous ? changePercent(kpis.orders, previous.orders) : null}
            deltaLabel={previousLabel}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="GMV"
            value={kpis?.gmv ?? 0}
            format="money"
            delta={kpis && previous ? changePercent(kpis.gmv, previous.gmv) : null}
            deltaLabel={previousLabel}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Conversion rate"
            value={kpis?.conversionRate ?? 0}
            format="percent"
            delta={kpis && previous ? changePoints(kpis.conversionRate, previous.conversionRate) : null}
            deltaUnit="pts"
            deltaLabel={previousLabel}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Stores with traffic"
            value={formatCount(kpis?.storesWithTraffic ?? 0)}
            deltaLabel={`of ${formatCount(kpis?.storesTotal ?? 0)} stores reported sessions`}
          />
        </KpiStrip>

        <Card title="Trend" description="GMV per day · lines: sessions and orders" padding="none">
          <div className="h-72 px-3 pb-4">
            {trend.length === 0 ? (
              noData
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="performanceGmvFill" x1="0" y1="0" x2="0" y2="1">
                      {areaGradientStops.map((stop) => (
                        <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                      ))}
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...recharts.grid} />
                  <XAxis dataKey="date" {...recharts.axis} tickFormatter={(v: string) => formatDate(v)} minTickGap={24} />
                  <YAxis yAxisId="money" {...recharts.axis} width={56} tickFormatter={moneyAxis} />
                  <YAxis yAxisId="count" orientation="right" {...recharts.axis} width={44} tickFormatter={countAxis} />
                  <ChartTooltipSlot content={<ChartTooltip />} />
                  <Legend {...legendProps} />
                  <Area
                    yAxisId="money"
                    dataKey="gmv"
                    name="GMV"
                    stroke={chartColors.series[0]}
                    {...recharts.area}
                    fill="url(#performanceGmvFill)"
                  />
                  <Line yAxisId="count" dataKey="sessions" name="Sessions" stroke={chartColors.series[1]} {...recharts.line} />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke={chartColors.axis}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Top stores by GMV" description="Net sales in the last 30 days" padding="none" className="overflow-hidden">
          <Table aria-label="Top stores by GMV" removeWrapper classNames={cardTableClassNames}>
            {storeColumns}
            <TableBody items={overview?.topStoresByGmv ?? []} emptyContent={noData}>
              {storeRow}
            </TableBody>
          </Table>
        </Card>

        <Card title="Top stores by growth" description="Largest rise in net sales against the 30 days before" padding="none" className="overflow-hidden">
          <Table aria-label="Top stores by growth" removeWrapper classNames={cardTableClassNames}>
            {storeColumns}
            <TableBody items={overview?.topStoresByGrowth ?? []} emptyContent={noData}>
              {storeRow}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
