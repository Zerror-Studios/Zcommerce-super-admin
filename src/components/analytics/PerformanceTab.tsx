import { useCallback, useMemo } from "react";
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
import { changePercent, changePoints, lastDaysRange, type PerformanceRangeDays } from "../../lib/analytics-health";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import type { StorePerformanceRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { areaGradientStops, chartColors, recharts } from "../ui/chart-theme";
import {
  Card,
  ErrorState,
  KpiStrip,
  Skeleton,
  StatCard,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  type DataTableColumn,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";
import {
  ChangeCell,
  ChartEmpty,
  ChartTooltip,
  DaysSwitch,
  TableCard,
  TwoLine,
  NoDataEmpty,
  type AnalyticsTabProps,
} from "./analytics-shared";
import { COUNT_AXIS_WIDTH, MONEY_AXIS_WIDTH, countAxis, legendProps, moneyAxis, storeHref, useRegisterExport } from "./analytics-tab.util";

/** GMV is money, the rest are counts. */
const tooltipValue = (value: number | null | undefined, key: string) =>
  key === "gmv" ? formatMoney(value ?? 0, { whole: true }) : formatCount(value ?? 0);

export interface PerformanceTabProps extends AnalyticsTabProps {
  days: PerformanceRangeDays;
  onDaysChange: (days: PerformanceRangeDays) => void;
}

/**
 * Analytics › Performance (04 S-05c, PRD-012 FR-8.3): platform-wide sessions, orders, GMV and conversion for
 * the last 7/30/90 days, the daily trend, and the top stores by GMV and by growth. Every figure is the
 * server's; since PRD-024 FR-3.3 the store rows' `*30d` fields hold the chosen window's sums (the labels say so).
 */
export function PerformanceTab({ tabRow, registerExport, days, onDaysChange }: PerformanceTabProps) {
  const navigate = useNavigate();
  const range = useMemo(() => lastDaysRange(days), [days]);

  const api = useAnalyticsOverview(range);
  const overview = api.data;
  const kpis = overview?.kpis;
  const previous = overview?.previous;
  const trend = useMemo(() => overview?.trend ?? [], [overview]);
  const previousLabel = `vs previous ${days} days`;

  const exportCsv = useCallback(() => {
    const columns = [
      { key: "date", label: "Date" },
      { key: "gmv", label: "GMV" },
      { key: "sessions", label: "Sessions" },
      { key: "orders", label: "Orders" },
    ];
    downloadCsv(`performance-${days}-days.csv`, rowsToCsv(trend.map((point) => ({ date: point.date, gmv: point.gmv, sessions: point.sessions, orders: point.orders })), columns));
  }, [days, trend]);
  useRegisterExport(registerExport, trend.length > 0 && !api.error ? exportCsv : null);

  /** Fixed 700 → Store 260px at 960px. */
  const storeColumns: DataTableColumn[] = [
    { key: "store", label: "Store" },
    { key: "sessions", label: `Sessions · ${days}d`, width: 110 },
    { key: "orders", label: `Orders · ${days}d`, width: 100 },
    { key: "sales", label: `Net sales · ${days}d`, width: 130 },
    { key: "growth", label: "vs previous period", width: 130 },
    { key: "conversion", label: "Conversion", width: 100 },
    { key: "analytics", label: "Analytics", width: 130, hideWhen: "narrow", skeleton: "badge" },
  ];

  const renderStoreCell = (row: StorePerformanceRow, key: string) => {
    switch (key) {
      case "store":
        return <TwoLine main={row.name} sub={row.slug} />;
      case "sessions":
        return <span className="num">{formatCount(row.sessions30d)}</span>;
      case "orders":
        return <span className="num">{formatCount(row.orders30d)}</span>;
      case "sales":
        return <span className="font-medium num">{formatMoney(row.revenue30d, { whole: true })}</span>;
      case "growth":
        // PRD-024 FR-2.1: null = the window before sold nothing; there is no change to show.
        return <ChangeCell value={row.growthPercent} />;
      case "conversion":
        return <span className="num">{row.sessions30d > 0 ? formatPercent(row.conversionRate30d) : "—"}</span>;
      case "analytics":
        return <AnalyticsHealthChip health={row.analyticsHealth} />;
      default:
        return null;
    }
  };

  const storeTable = (title: string, description: string, rows: StorePerformanceRow[]) => (
    <TableCard<StorePerformanceRow>
      title={title}
      description={description}
      aria-label={title}
      columns={storeColumns}
      rows={rows}
      getRowKey={(row) => row.tenantId}
      isLoading={api.loading}
      rowHeight="tall"
      onRowAction={(row) => navigate(storeHref(row.tenantId))}
      emptyContent={<NoDataEmpty />}
      renderCell={renderStoreCell}
    />
  );

  return (
    <div>
      {tabRow(<DaysSwitch value={days} onChange={onDaysChange} />)}

      {api.error ? (
        <ErrorState title="Couldn't load performance." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : (
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
              value={formatMoney(kpis?.gmv ?? 0, { whole: true })}
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
              deltaLabel={
                kpis
                  ? `from ${formatCount(kpis.storesWithSessions)} ${kpis.storesWithSessions === 1 ? "store" : "stores"} with session data`
                  : previousLabel
              }
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
            <div className="h-70 px-3 pb-4">
              {api.loading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : trend.length === 0 ? (
                <ChartEmpty />
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
                    <XAxis dataKey="date" {...recharts.axis} tickFormatter={(value: string) => formatDate(value)} minTickGap={24} />
                    <YAxis yAxisId="money" {...recharts.axis} width={MONEY_AXIS_WIDTH} tickFormatter={moneyAxis} />
                    <YAxis yAxisId="count" orientation="right" {...recharts.axis} width={COUNT_AXIS_WIDTH} tickFormatter={countAxis} />
                    <ChartTooltipSlot content={<ChartTooltip formatLabel={formatDate} formatValue={tooltipValue} />} />
                    <Legend {...legendProps} />
                    <Area yAxisId="money" dataKey="gmv" name="GMV" stroke={chartColors.series[0]} {...recharts.area} fill="url(#performanceGmvFill)" />
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

          {storeTable("Top stores by GMV", `Net sales in the last ${days} days`, overview?.topStoresByGmv ?? [])}
          {storeTable("Top stores by growth", `Largest rise in net sales against the ${days} days before`, overview?.topStoresByGrowth ?? [])}
        </div>
      )}
    </div>
  );
}
