import { differenceInCalendarDays } from "date-fns";
import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { useAnalyticsOverview, useStoreSales } from "../../hooks/use-platform-analytics";
import { useSummaryKey } from "../../hooks/use-summary-key";
import { changePercent, changePoints, type DayRange } from "../../lib/analytics-health";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import {
  SALES_DROP_ALERT_PERCENT,
  storesNeedingALook,
  type StoreSalesRow,
  type StoreSalesTotal,
} from "../../lib/store-sales";
import type { StorePerformanceRow } from "../../types/platform-api";
import { toasts } from "../../copy";
import { RECHARTS_DRAW_MS, areaGradientStops, chartColors, pointsForViewport, recharts, rechartsEndTicks } from "../ui/chart-theme";
import { useIsPhone } from "../ui/use-media";
import {
  Button,
  Card,
  ChartSkeleton,
  EmptyState,
  ErrorState,
  SegmentedSwitch,
  SummaryPanel,
  TablePagination,
  formatCount,
  formatDate,
  formatDelta,
  formatMoney,
  formatPercent,
  useLibraryEntrance,
  type DataTableColumn,
  type SummaryCell,
  type TableSort,
} from "../ui";
import { AnalyticsHealthChip } from "./AnalyticsHealthChip";
import {
  ChangeCell,
  ChartEmpty,
  ChartTooltip,
  NoDataEmpty,
  SourceChip,
  TableCard,
  TwoLine,
  type AnalyticsTabProps,
} from "./analytics-shared";
import {
  COUNT_AXIS_WIDTH,
  MONEY_AXIS_WIDTH,
  STORES_SUB_TABS,
  countAxis,
  legendProps,
  moneyAxis,
  storeHref,
  useRegisterExport,
  type StoresSubTab,
} from "./analytics-tab.util";

/** §4: lists show the top 10; "Show all" pages the full list 25 at a time in the same card. */
const ALL_STORES_PAGE_SIZE = 25;

type SalesSortKey = "sales" | "previous" | "change" | "orders" | "average";

const SORT_VALUE: Record<SalesSortKey, (row: StoreSalesRow) => number> = {
  sales: (row) => row.sales,
  previous: (row) => row.previousSales,
  change: (row) => row.changePercent ?? Number.NEGATIVE_INFINITY,
  orders: (row) => row.orders,
  average: (row) => row.averageOrder ?? Number.NEGATIVE_INFINITY,
};

const isSortKey = (value: string): value is SalesSortKey => value in SORT_VALUE;

const money = (value: number, currency?: string) => formatMoney(value, { currency, whole: true });

const totalsColumns: DataTableColumn[] = [
  { key: "currency", label: "Currency", mobile: "primary" },
  { key: "sales", label: "Net sales", width: 130, mobile: "value" },
  { key: "change", label: "Change", width: 90, mobile: "meta" },
  { key: "orders", label: "Orders", width: 90, mobile: "hide" },
  { key: "stores", label: "Stores", width: 80, mobile: "hide" },
];

export interface StoresTabProps extends AnalyticsTabProps {
  /** The window from the shared date picker in the title row (1 to 366 days). */
  range: DayRange;
  subTab: StoresSubTab;
  onSubTabChange: (tab: StoresSubTab) => void;
}

/**
 * Analytics › Stores (Analytics Level 1 §3.7): the old Stores (store sales) and System (performance) pages in one,
 * since both are store performance. Summary panel (GMV, orders, visits, conversion), sticky sub-tabs, then:
 * - Overview: GMV, visits and orders per day; Totals by currency only when stores sell in more than one currency.
 * - Top stores: by GMV (top 10, "Show all" pages every store by net sales) and by growth.
 * - Needs a look: no orders, or net sales down 20% or more.
 *
 * Both reads are the server's rollups of the nightly usage snapshot (`platformAnalyticsOverview`,
 * `platformStoreSales`; PRD-024 FR-3.3/3.4). Each snapshot carries a store's last 7 complete days, so a store shows
 * only once a snapshot has run for it, and only for the days snapshots have covered (a store seeded with older
 * history does not show that history here). Demo stores are not left out.
 */
export function StoresTab({ registerExport, range, subTab, onSubTabChange }: StoresTabProps) {
  const navigate = useNavigate();
  const summaryKey = useSummaryKey("analytics-stores");
  const days = differenceInCalendarDays(range.endDate, range.startDate) + 1;
  const previousLabel = `vs previous ${days} days`;

  const overviewApi = useAnalyticsOverview(range);
  const salesApi = useStoreSales(range);
  const overview = overviewApi.data;
  const kpis = overview?.kpis;
  const previous = overview?.previous;
  const trend = useMemo(() => overview?.trend ?? [], [overview]);
  const sales = salesApi.data;
  const rows = useMemo(() => sales?.rows ?? [], [sales]);
  const totals = useMemo(() => sales?.totals ?? [], [sales]);
  const needsLook = useMemo(() => storesNeedingALook(rows), [rows]);
  const salesLoading = salesApi.loading || (!sales && !salesApi.error);

  // The overview's store rows carry no currency; the store-sales rows do (a store sells in one currency).
  const currencyOf = useMemo(() => new Map(rows.map((row) => [row.clientId, row.currency])), [rows]);
  // Largest first. The overview's GMV adds every store; with several currencies only the per-currency totals are right.
  const lead = totals[0];
  const multiCurrency = totals.length > 1;

  const isPhone = useIsPhone();
  // Round 3 D2: the trend draws in the first time it is on screen in a visit; a new range morphs (Recharts).
  const { ref: trendRef, play: trendPlay, animate: trendAnimate } = useLibraryEntrance<HTMLDivElement>("console-performance-trend");
  const trendMotion = { isAnimationActive: trendAnimate, animationDuration: RECHARTS_DRAW_MS, animationEasing: "ease-out" as const };
  const chartTrend = useMemo(() => pointsForViewport(trend, isPhone), [trend, isPhone]);

  // Top stores › by GMV: the top 10, or every store by net sales ("Show all"), sortable, 25 a page.
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TableSort>({ column: "sales", direction: "desc" });
  const sortedRows = useMemo(() => {
    if (!isSortKey(sort.column)) return rows;
    const value = SORT_VALUE[sort.column];
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => sign * (value(a) - value(b)));
  }, [rows, sort]);
  const pageRows = sortedRows.slice((page - 1) * ALL_STORES_PAGE_SIZE, page * ALL_STORES_PAGE_SIZE);

  // ⋯ Export: the daily trend on Overview, the store list on the other sub-tabs.
  const exportTrend = useCallback(() => {
    const columns = [
      { key: "date", label: "Date" },
      { key: "gmv", label: "GMV" },
      { key: "sessions", label: "Visits" },
      { key: "orders", label: "Orders" },
    ];
    downloadCsv(`stores-trend-${days}-days.csv`, rowsToCsv(trend.map((point) => ({ ...point })), columns));
  }, [days, trend]);
  const exportStores = useCallback(() => {
    const columns = [
      { key: "storeName", label: "Store" },
      { key: "slug", label: "Slug" },
      { key: "currency", label: "Currency" },
      { key: "sales", label: `Net sales (${days} days)` },
      { key: "previousSales", label: `Previous ${days} days` },
      { key: "changePercent", label: "Change %" },
      { key: "orders", label: "Orders" },
      { key: "averageOrder", label: "Average order" },
    ];
    downloadCsv(
      `store-sales-${days}-days.csv`,
      rowsToCsv(rows.map((row) => ({ ...row, changePercent: row.changePercent ?? "", averageOrder: row.averageOrder ?? "" })), columns),
    );
  }, [days, rows]);
  const exporter =
    subTab === "overview"
      ? trend.length > 0 && !overviewApi.error ? exportTrend : null
      : rows.length > 0 && !salesApi.error ? exportStores : null;
  useRegisterExport(registerExport, exporter);

  /** "+12% vs previous 30 days", or the window alone when there is nothing to compare. */
  const changeNote = (change: number | null, unit = "") =>
    change == null ? previousLabel : `${unit ? `${formatDelta(change).replace("%", "")} ${unit}` : formatDelta(change)} ${previousLabel}`;

  // §3.7: four numbers. GMV in the stores' currency; with several currencies, the largest one and a pointer to the totals.
  const summaryCells: SummaryCell[] = [
    {
      key: "gmv",
      label: "GMV",
      value: multiCurrency && lead ? money(lead.sales, lead.currency) : money(kpis?.gmv ?? 0, lead?.currency),
      note: multiCurrency && lead
        ? `${lead.currency} stores only · see Totals by currency`
        : changeNote(kpis && previous ? changePercent(kpis.gmv, previous.gmv) : null),
      chart: !multiCurrency && trend.length > 1 ? { kind: "bars", values: trend.map((point) => point.gmv) } : undefined,
    },
    {
      key: "orders",
      label: "Orders",
      value: formatCount(kpis?.orders ?? 0),
      note: changeNote(kpis && previous ? changePercent(kpis.orders, previous.orders) : null),
    },
    {
      key: "visits",
      label: "Visits",
      value: formatCount(kpis?.sessions ?? 0),
      note: `${formatCount(kpis?.storesWithTraffic ?? 0)} of ${formatCount(kpis?.storesTotal ?? 0)} stores sent Google Analytics visits`,
      chart: trend.length > 1 ? { kind: "bars", values: trend.map((point) => point.sessions) } : undefined,
    },
    {
      key: "conversion",
      label: "Conversion rate",
      value: formatPercent(kpis?.conversionRate ?? 0),
      note: kpis
        ? `from ${formatCount(kpis.storesWithSessions)} ${kpis.storesWithSessions === 1 ? "store" : "stores"} with visits · ${changeNote(previous ? changePoints(kpis.conversionRate, previous.conversionRate) : null, "pts")}`
        : previousLabel,
    },
  ];

  // ─── Store tables ──────────────────────────────────────────────────────────

  /** Fixed 700 → Store 260px at 960px. */
  const performanceColumns: DataTableColumn[] = [
    { key: "store", label: "Store", mobile: "primary" },
    { key: "sessions", label: `Visits · ${days}d`, width: 110, hideWhen: "narrow", mobile: "hide" },
    { key: "orders", label: `Orders · ${days}d`, width: 100, mobile: "hide" },
    { key: "sales", label: `Net sales · ${days}d`, width: 130, mobile: "value" },
    { key: "growth", label: "vs previous period", width: 130, mobile: "meta" },
    { key: "conversion", label: "Conversion", width: 100, hideWhen: "narrow", mobile: "hide" },
    { key: "analytics", label: "Google Analytics", width: 140, hideWhen: "narrow", skeleton: "badge", mobile: "badge" },
  ];

  const renderPerformanceCell = (row: StorePerformanceRow, key: string) => {
    switch (key) {
      case "store":
        return <TwoLine main={row.name} sub={row.slug} />;
      case "sessions":
        return <span className="num">{formatCount(row.sessions30d)}</span>;
      case "orders":
        return <span className="num">{formatCount(row.orders30d)}</span>;
      case "sales":
        return <span className="font-medium num">{money(row.revenue30d, currencyOf.get(row.tenantId))}</span>;
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

  const performanceTable = (title: string, description: string, tableRows: StorePerformanceRow[], extra?: ReactNode) => (
    <TableCard<StorePerformanceRow>
      title={title}
      description={description}
      actions={
        <>
          {extra}
          <SourceChip source="mixed" />
        </>
      }
      aria-label={title}
      columns={performanceColumns}
      rows={tableRows}
      getRowKey={(row) => row.tenantId}
      isLoading={overviewApi.loading}
      rowHeight="tall"
      onRowAction={(row) => navigate(storeHref(row.tenantId))}
      emptyContent={<NoDataEmpty />}
      renderCell={renderPerformanceCell}
    />
  );

  const allStoresColumns: DataTableColumn[] = [
    { key: "store", label: "Store", mobile: "primary" },
    { key: "sales", label: `Net sales · ${days}d`, width: 130, sortable: true, mobile: "value" },
    { key: "previous", label: `Previous ${days} days`, width: 130, sortable: true, hideWhen: "narrow", mobile: "hide" },
    { key: "change", label: "Change", width: 90, sortable: true, mobile: "meta" },
    { key: "orders", label: `Orders · ${days}d`, width: 100, sortable: true, mobile: "hide" },
    { key: "average", label: "Average order", width: 120, sortable: true, hideWhen: "narrow", mobile: "hide" },
  ];

  const renderSalesCell = (store: StoreSalesRow, key: string) => {
    switch (key) {
      case "store":
        return <TwoLine main={store.storeName} sub={store.slug} />;
      case "sales":
        return <span className="font-medium num">{money(store.sales, store.currency)}</span>;
      case "previous":
        return <span className="num">{money(store.previousSales, store.currency)}</span>;
      case "change":
        return <ChangeCell value={store.changePercent} />;
      case "orders":
        return <span className="num">{formatCount(store.orders)}</span>;
      case "average":
        return <span className="num">{store.averageOrder == null ? "—" : money(store.averageOrder, store.currency)}</span>;
      default:
        return null;
    }
  };

  const allStoresDescription =
    sales && sales.totalCount > rows.length
      ? `The top ${formatCount(rows.length)} of ${formatCount(sales.totalCount)} stores by net sales`
      : sales
        ? `Every store with figures · ${formatDate(sales.rangeStart)} – ${formatDate(sales.rangeEnd)}`
        : undefined;

  const topByGmv = showAll ? (
    <TableCard<StoreSalesRow>
      title="All stores by sales"
      description={allStoresDescription}
      actions={
        <>
          <Button variant="ghost" size="sm" onPress={() => setShowAll(false)}>
            Show top 10
          </Button>
          <SourceChip source="orders" />
        </>
      }
      aria-label="All stores by sales"
      columns={allStoresColumns}
      rows={pageRows}
      getRowKey={(store) => store.clientId}
      isLoading={salesLoading}
      rowHeight="tall"
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        setPage(1);
      }}
      onRowAction={(store) => navigate(storeHref(store.clientId))}
      emptyContent={<NoDataEmpty />}
      renderCell={renderSalesCell}
      footer={
        rows.length > ALL_STORES_PAGE_SIZE ? (
          <TablePagination page={page} pageSize={ALL_STORES_PAGE_SIZE} total={rows.length} onPageChange={setPage} />
        ) : undefined
      }
    />
  ) : (
    performanceTable(
      "Top stores by GMV",
      `Net sales in the last ${days} days`,
      overview?.topStoresByGmv ?? [],
      rows.length > (overview?.topStoresByGmv.length ?? 0) ? (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => {
            setPage(1);
            setShowAll(true);
          }}
        >
          {`Show all ${formatCount(sales?.totalCount ?? rows.length)} stores`}
        </Button>
      ) : null,
    )
  );

  // ─── Page ─────────────────────────────────────────────────────────────────

  const error = overviewApi.error ?? salesApi.error;
  if (error) {
    return (
      <ErrorState
        title="Couldn't load store figures."
        description={toasts.genericError}
        onRetry={() => {
          void overviewApi.refetch();
          void salesApi.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* §4, round 3 D1.4: the sub-tabs stick under the title row (white with a blur, 1px line under it); the app's
          pill switch, as on the store's Analytics (owner, 2026-11-11). */}
      <div className="zc-subtabs zc-subtabs--seg -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <SegmentedSwitch<StoresSubTab>
          ariaLabel="Stores sections"
          items={[...STORES_SUB_TABS]}
          value={subTab}
          onChange={onSubTabChange}
          className="max-w-full"
        />
      </div>

      <SummaryPanel cells={summaryCells} isLoading={overviewApi.loading} storageKey={summaryKey} aria-label="Stores summary" />

      {subTab === "overview" ? (
        <>
          <Card
            title="GMV over time"
            description={`GMV per day · lines: visits and orders${multiCurrency ? " · every currency added together" : ""}`}
            actions={<SourceChip source="mixed" />}
            padding="none"
          >
            <div ref={trendRef} data-play={trendPlay} className="h-70 px-3 pb-4">
              {overviewApi.loading ? (
                <ChartSkeleton height={264} shape="line" />
              ) : trend.length === 0 ? (
                <ChartEmpty />
              ) : !trendPlay ? null : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="storesGmvFill" x1="0" y1="0" x2="0" y2="1">
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
                    <ChartTooltipSlot
                      content={
                        <ChartTooltip
                          formatLabel={formatDate}
                          formatValue={(value, key) => (key === "gmv" ? money(value ?? 0, multiCurrency ? undefined : lead?.currency) : formatCount(value ?? 0))}
                        />
                      }
                    />
                    <Legend {...legendProps} />
                    <Area yAxisId="money" dataKey="gmv" name="GMV" stroke={chartColors.series[0]} {...recharts.area} fill="url(#storesGmvFill)" {...trendMotion} />
                    <Line yAxisId="count" dataKey="sessions" name="Visits" stroke={chartColors.series[1]} {...recharts.line} {...trendMotion} />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="orders"
                      name="Orders"
                      stroke={chartColors.axis}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      {...trendMotion}
                      animationBegin={trendMotion.isAnimationActive ? 200 : 0}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* §3.7: only when stores sell in more than one currency (never added together). */}
          {multiCurrency ? (
            <TableCard<StoreSalesTotal>
              title="Totals by currency"
              description="Stores selling in different currencies are never added together"
              actions={<SourceChip source="orders" />}
              aria-label="Store sales by currency"
              columns={totalsColumns}
              rows={totals}
              getRowKey={(total) => total.currency}
              isLoading={salesLoading}
              emptyContent={<NoDataEmpty />}
              renderCell={(total, key) => {
                switch (key) {
                  case "currency":
                    return <span className="font-medium text-fg">{total.currency}</span>;
                  case "sales":
                    return <span className="num">{money(total.sales, total.currency)}</span>;
                  case "change":
                    return <ChangeCell value={total.changePercent} />;
                  case "orders":
                    return <span className="num">{formatCount(total.orders)}</span>;
                  case "stores":
                    return <span className="num">{formatCount(total.stores)}</span>;
                  default:
                    return null;
                }
              }}
            />
          ) : null}
        </>
      ) : subTab === "top" ? (
        <>
          {topByGmv}
          {performanceTable(
            "Top stores by growth",
            `Largest rise in net sales against the ${days} days before`,
            overview?.topStoresByGrowth ?? [],
          )}
        </>
      ) : (
        <TableCard<StoreSalesRow>
          title="Needs a look"
          description={`No orders, or net sales down ${SALES_DROP_ALERT_PERCENT}% or more ${previousLabel}`}
          actions={<SourceChip source="orders" />}
          aria-label="Stores that need a look"
          columns={allStoresColumns.filter((column) => column.key !== "average").map((column) => ({ ...column, sortable: false }))}
          rows={needsLook}
          getRowKey={(store) => store.clientId}
          isLoading={salesLoading}
          rowHeight="tall"
          onRowAction={(store) => navigate(storeHref(store.clientId))}
          emptyContent={<EmptyState compact description="Every store is selling and none dropped sharply." />}
          renderCell={(store, key) =>
            key === "store" ? (
              <TwoLine main={store.storeName} sub={store.orders === 0 ? "No orders" : `${formatCount(store.orders)} orders`} />
            ) : (
              renderSalesCell(store, key)
            )
          }
        />
      )}
    </div>
  );
}
