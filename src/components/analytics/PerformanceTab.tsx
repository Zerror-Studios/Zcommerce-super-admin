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
import { areaGradientStops, chartColors, pointsForViewport, recharts, rechartsEndTicks } from "../ui/chart-theme";
import { useIsPhone } from "../ui/use-media";
import { useSummaryKey } from "../../hooks/use-summary-key";
import {
  Card,
  ErrorState,
  Skeleton,
  SummaryPanel,
  formatCount,
  formatDate,
  formatDelta,
  formatMoney,
  formatPercent,
  type DataTableColumn,
  type SummaryCell,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";
import {
  ChangeCell,
  ChartEmpty,
  ChartTooltip,
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
  /** The window; its 7 · 30 · 90 days switch sits in the Analytics title row. */
  days: PerformanceRangeDays;
}

/**
 * Analytics › Performance (04 S-05c, PRD-012 FR-8.3): platform-wide sessions, orders, GMV and conversion for
 * the last 7/30/90 days, the daily trend, and the top stores by GMV and by growth. Every figure is the
 * server's; since PRD-024 FR-3.3 the store rows' `*30d` fields hold the chosen window's sums (the labels say so).
 */
export function PerformanceTab({ tabRow, registerExport, days }: PerformanceTabProps) {
  const navigate = useNavigate();
  const summaryKey = useSummaryKey("analytics-performance");
  const range = useMemo(() => lastDaysRange(days), [days]);

  const api = useAnalyticsOverview(range);
  const overview = api.data;
  const kpis = overview?.kpis;
  const previous = overview?.previous;
  const trend = useMemo(() => overview?.trend ?? [], [overview]);
  // v2 §10: phones keep the shape with the last 14 days, labelled at the start and end only.
  const isPhone = useIsPhone();
  const chartTrend = useMemo(() => pointsForViewport(trend, isPhone), [trend, isPhone]);
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
    { key: "store", label: "Store", mobile: "primary" },
    { key: "sessions", label: `Sessions · ${days}d`, width: 110, hideWhen: "narrow", mobile: "hide" },
    { key: "orders", label: `Orders · ${days}d`, width: 100, mobile: "hide" },
    { key: "sales", label: `Net sales · ${days}d`, width: 130, mobile: "value" },
    { key: "growth", label: "vs previous period", width: 130, mobile: "meta" },
    { key: "conversion", label: "Conversion", width: 100, hideWhen: "narrow", mobile: "hide" },
    { key: "analytics", label: "Analytics", width: 130, hideWhen: "narrow", skeleton: "badge", mobile: "badge" },
  ];

  /** "+12% vs previous 30 days", or the window alone when there is nothing to compare. */
  const changeNote = (change: number | null, unit = "") =>
    change == null ? previousLabel : `${unit ? `${formatDelta(change).replace("%", "")} ${unit}` : formatDelta(change)} ${previousLabel}`;

  // Design v2 §4.2: four numbers; "stores with traffic" rides in the Sessions note.
  const summaryCells: SummaryCell[] = [
    {
      key: "gmv",
      label: "GMV",
      value: formatMoney(kpis?.gmv ?? 0, { whole: true }),
      note: changeNote(kpis && previous ? changePercent(kpis.gmv, previous.gmv) : null),
      chart: trend.length > 1 ? { kind: "bars", values: trend.map((point) => point.gmv) } : undefined,
    },
    {
      key: "orders",
      label: "Orders",
      value: formatCount(kpis?.orders ?? 0),
      note: changeNote(kpis && previous ? changePercent(kpis.orders, previous.orders) : null),
    },
    {
      key: "sessions",
      label: "Sessions",
      value: formatCount(kpis?.sessions ?? 0),
      note: `${formatCount(kpis?.storesWithTraffic ?? 0)} of ${formatCount(kpis?.storesTotal ?? 0)} stores reported sessions`,
      chart: trend.length > 1 ? { kind: "bars", values: trend.map((point) => point.sessions) } : undefined,
    },
    {
      key: "conversion",
      label: "Conversion rate",
      value: formatPercent(kpis?.conversionRate ?? 0),
      note: kpis
        ? `from ${formatCount(kpis.storesWithSessions)} ${kpis.storesWithSessions === 1 ? "store" : "stores"} with session data · ${changeNote(previous ? changePoints(kpis.conversionRate, previous.conversionRate) : null, "pts")}`
        : previousLabel,
    },
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
      {tabRow()}

      {api.error ? (
        <ErrorState title="Couldn't load performance." description={toasts.genericError} onRetry={() => void api.refetch()} />
      ) : (
        <div className="space-y-4">
          <SummaryPanel cells={summaryCells} isLoading={api.loading} storageKey={summaryKey} aria-label="Performance summary" />

          <Card title="Trend" description="GMV per day · lines: sessions and orders" padding="none">
            <div className="h-70 px-3 pb-4">
              {api.loading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : trend.length === 0 ? (
                <ChartEmpty />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="performanceGmvFill" x1="0" y1="0" x2="0" y2="1">
                        {areaGradientStops.map((stop) => (
                          <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                        ))}
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...recharts.grid} />
                    {isPhone ? (
                      <XAxis dataKey="date" {...rechartsEndTicks(chartTrend, (point) => point.date)} tickFormatter={(value: string) => formatDate(value)} />
                    ) : (
                      <XAxis dataKey="date" {...recharts.axis} tickFormatter={(value: string) => formatDate(value)} minTickGap={24} />
                    )}
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
