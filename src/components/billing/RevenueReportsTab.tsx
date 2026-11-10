import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltipSlot,
  XAxis,
  YAxis,
} from "recharts";
import { getPaymentGatewayLabel, getPlanLabel, PLAN_LABELS } from "../../lib/display-labels.util";
import { useMrrHistory, useRevenueOverview } from "../../hooks/use-platform-reports";
import { monthTotal } from "../../lib/api-report-adapters";
import { NOT_RECORDED_COPY, firstRecordedDay, mrrByMonth, type MrrMonthRow } from "../../lib/platform-history.util";
import { downloadCsv, rowsToCsv } from "../../lib/report-csv";
import { IconChartBar } from "../ui/icons";
import type { GatewayBreakdownRow, MonthlyPlanRevenue, PlanBreakdownRow, TopStoreRevenueRow } from "../../types/reports";
import { toasts } from "../../copy";
import type { DateRangeValue } from "../common/DateRangeComparison";
import { useSummaryKey } from "../../hooks/use-summary-key";
import {
  ChartEmpty,
  ChartTooltip,
  LogoTile,
  TableCard,
  TwoLine,
  NoDataEmpty,
  type AnalyticsTabProps,
} from "../analytics/analytics-shared";
import { MONEY_AXIS_WIDTH, legendProps, moneyAxis, storeHref, useRegisterExport } from "../analytics/analytics-tab.util";
import { CHART_BAR_RADIUS, RECHARTS_GROW_MS, chartColors, planColors, pointsForViewport, recharts, rechartsEndTicks } from "../ui/chart-theme";
import { useIsPhone } from "../ui/use-media";
import {
  Card,
  LineChart,
  useLibraryEntrance,
  EmptyState,
  ErrorState,
  Skeleton,
  SummaryPanel,
  cx,
  formatCount,
  formatDate,
  formatMoney,
  formatDelta,
  formatPercent,
  toneTextClasses,
  type DataTableColumn,
  type SummaryCell,
} from "../ui";

// Every backend tier: the server books Starter revenue too, and the CSV total includes it.
const PLAN_KEYS = ["STARTER", "PREMIUM", "PLUS", "ENTERPRISE"] as const;

/** Fixed 680 → Month 280px at 960px. */
const mrrColumns: DataTableColumn[] = [
  { key: "month", label: "Month", mobile: "primary" },
  { key: "mrr", label: "MRR at month end", width: 140, mobile: "value" },
  { key: "paying", label: "Paying stores", width: 120 },
  { key: "new", label: "New", width: 100 },
  { key: "expansion", label: "Expansion", width: 110, hideWhen: "narrow" },
  { key: "contraction", label: "Contraction", width: 110, hideWhen: "narrow" },
  { key: "churned", label: "Churned", width: 100 },
];

const planColumns: DataTableColumn[] = [
  { key: "plan", label: "Plan", mobile: "primary" },
  { key: "revenue", label: "Revenue", width: 100, mobile: "value" },
  { key: "share", label: "Share", width: 64, mobile: "meta" },
  { key: "stores", label: "Stores", width: 64, mobile: "hide" },
  { key: "mrr", label: "Monthly billing", width: 110, hideWhen: "narrow", mobile: "hide" },
];

const gatewayColumns: DataTableColumn[] = [
  { key: "gateway", label: "Gateway", mobile: "primary" },
  { key: "collected", label: "Collected", width: 100, mobile: "value" },
  { key: "failed", label: "Failed", width: 90 },
  { key: "pending", label: "Pending", width: 90, hideWhen: "narrow" },
  { key: "share", label: "Share", width: 64, mobile: "meta" },
];

/** Fixed 430 → Store 530px. */
const topStoreColumns: DataTableColumn[] = [
  { key: "store", label: "Store", mobile: "primary" },
  { key: "plan", label: "Plan", width: 110, mobile: "title" },
  { key: "collected", label: "Collected", width: 120, mobile: "value" },
  { key: "failed", label: "Failed", width: 110, mobile: "hide" },
  { key: "charges", label: "Charges", width: 90, hideWhen: "narrow", mobile: "hide" },
];

/** PRD-024 FR-3.1: a month before the first MRR snapshot has no figure. */
const tooltipMoney = (value: number | null | undefined) =>
  value == null ? NOT_RECORDED_COPY : formatMoney(value, { whole: true });

/** A month's MRR movement; "—" when no recorded day had one (the first day has none). */
const movement = (value: number | null) => (value == null ? "—" : formatMoney(value, { whole: true }));

/** Phone charts show the last six months (v2 §10: fewer bars, the same shape). */
const PHONE_MONTHS = 6;

/** Money that may have paise: whole rupees show no ".00" (01 §4.4). */
const money = (value: number) => formatMoney(value);

export interface RevenueReportsTabProps extends AnalyticsTabProps {
  /** The period; its picker sits in the Analytics title row. */
  range: DateRangeValue;
}

/**
 * Analytics › Platform revenue (04 S-05a): what stores pay Zcom for their plans. Every figure is the server
 * rollup for the chosen range (PRD-005 FR-5.3); MRR comes from the daily snapshot (PRD-024 FR-3.1).
 */
export function RevenueReportsTab({ tabRow, registerExport, range }: RevenueReportsTabProps) {
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const summaryKey = useSummaryKey("analytics-revenue");

  const api = useRevenueOverview(range);
  const { monthly, trend, kpis, planRows, gatewayRows, topStores, summary } = api.data;

  // MRR comes from the daily snapshot job, never rebuilt from today's subscriptions; months before its first
  // run are "Not recorded" (one row per month, Check first 05 #30). The trend rows are the monthly rows.
  const mrrApi = useMrrHistory(range);
  const mrrMonths = useMemo(() => mrrByMonth(mrrApi.data, monthly), [mrrApi.data, monthly]);
  const mrrRows = useMemo(() => [...mrrMonths].reverse(), [mrrMonths]);
  const mrrSince = firstRecordedDay(mrrApi.data);
  const trendWithMrr = useMemo(
    () => trend.map((point, index) => ({ ...point, mrr: mrrMonths[index]?.mrr ?? null })),
    [trend, mrrMonths],
  );
  // v2 §10: phones keep the shape with fewer months, labelled at the start and end only.
  // Round 3 D2: the stacked bars grow in the first time they are on screen in a visit; new data morphs.
  const { ref: planBarsRef, play: planBarsPlay, animate: planBarsAnimate } = useLibraryEntrance<HTMLDivElement>("console-revenue-by-plan");
  const trendShown = useMemo(() => pointsForViewport(trendWithMrr, isPhone, PHONE_MONTHS), [trendWithMrr, isPhone]);

  const monthlyLabelled = useMemo(
    () => monthly.map((row) => ({ ...row, short: row.label.replace(/ 20\d\d$/, "") })),
    [monthly],
  );
  const monthlyShown = useMemo(() => pointsForViewport(monthlyLabelled, isPhone, PHONE_MONTHS), [monthlyLabelled, isPhone]);

  const exportCsv = useCallback(() => {
    const columns = [
      { key: "label", label: "Month" },
      { key: "STARTER", label: PLAN_LABELS.STARTER },
      { key: "PREMIUM", label: PLAN_LABELS.PREMIUM },
      { key: "PLUS", label: PLAN_LABELS.PLUS },
      { key: "ENTERPRISE", label: PLAN_LABELS.ENTERPRISE },
      { key: "total", label: "Total" },
    ];
    const rows = monthly.map((row: MonthlyPlanRevenue) => ({
      label: row.label,
      STARTER: row.STARTER,
      PREMIUM: row.PREMIUM,
      PLUS: row.PLUS,
      ENTERPRISE: row.ENTERPRISE,
      total: monthTotal(row),
    }));
    downloadCsv("revenue-by-plan.csv", rowsToCsv(rows, columns));
  }, [monthly]);
  useRegisterExport(registerExport, monthly.length > 0 && !api.error ? exportCsv : null);

  // "Sep vs Aug" for the Bookings delta (the server compares the last month in range with the one before).
  const momLabel = useMemo(() => {
    const last = monthly[monthly.length - 1];
    const previous = monthly.length > 1 ? monthly[monthly.length - 2] : undefined;
    const short = (row: MonthlyPlanRevenue) => row.label.replace(/ 20\d\d$/, "");
    return last && previous ? `${short(last)} vs ${short(previous)}` : "Plan bookings";
  }, [monthly]);

  const chartBody = (empty: boolean, chart: ReactNode) =>
    api.loading ? <Skeleton className="h-full w-full rounded-xl" /> : empty ? <ChartEmpty /> : chart;

  const row = tabRow();

  // Design v2 §4.2: the summary panel replaces the five-number strip. Failed charges and the past-due MRR ride in
  // the notes, so every figure the strip had is still on the page (failed per gateway is in Gateway split too).
  const bookingsSeries = monthly.map(monthTotal);
  const mrrSeries = mrrMonths.map((month) => month.mrr ?? 0);
  const summaryCells: SummaryCell[] = [
    {
      key: "bookings",
      label: "Subscription revenue",
      info: "Plan bookings for the months in this period",
      value: formatMoney(kpis.planRevenue, { whole: true }),
      note: kpis.momChangePercent == null ? "Plan bookings" : `${formatDelta(kpis.momChangePercent)} · ${momLabel}`,
      chart: bookingsSeries.length > 1 ? { kind: "bars", values: bookingsSeries } : undefined,
    },
    {
      key: "collected",
      label: "Collected",
      info: "Successful payments minus refunds in this period. It can be below zero when refunds are larger than new payments.",
      value: formatMoney(kpis.netCollected, { whole: true }),
      note: kpis.refundedAmount > 0 ? `After ${formatMoney(kpis.refundedAmount, { whole: true })} refunded` : "Successful payments",
      tone: kpis.netCollected < 0 ? "danger" : "default",
    },
    {
      key: "mrr",
      label: "Monthly billing",
      info: `Monthly recurring revenue from paying (ACTIVE) subscriptions. Not included: ${formatMoney(summary.trialPipeline, { whole: true })} a month in trials and ${formatMoney(summary.atRiskMrr, { whole: true })} a month past due.`,
      value: formatMoney(kpis.activeMrr, { whole: true }),
      note:
        summary.atRiskMrr > 0
          ? `${formatCount(kpis.payingStores)} paying · ${formatMoney(summary.atRiskMrr, { whole: true })} past due`
          : `${formatCount(kpis.payingStores)} paying ${kpis.payingStores === 1 ? "store" : "stores"}`,
      tone: summary.atRiskMrr > 0 ? "danger" : "default",
      chart: mrrSeries.some((value) => value > 0) ? { kind: "bars", values: mrrSeries } : undefined,
    },
    {
      key: "open",
      label: "Open invoices",
      info: "Invoices still open whose due date is in this period",
      value: formatMoney(kpis.pendingAmount, { whole: true }),
      note:
        kpis.failedAmount > 0
          ? `Due, unpaid · ${formatMoney(kpis.failedAmount, { whole: true })} failed charges`
          : "Due in this period, unpaid · no failed charges",
      tone: kpis.failedAmount > 0 ? "danger" : "default",
    },
  ];

  // Round 2 §6.4: when every figure is ₹0 the charts would be flat lines on ₹0–₹4 axes; say why instead.
  const allZero =
    !api.loading &&
    !mrrApi.loading &&
    [kpis.planRevenue, kpis.netCollected, kpis.activeMrr, kpis.pendingAmount, kpis.failedAmount, kpis.refundedAmount].every((value) => !value) &&
    bookingsSeries.every((value) => !value) &&
    mrrSeries.every((value) => !value);

  // On error show only the error, not a page of zeros (the figures below would read as real).
  if (api.error) {
    return (
      <div>
        {row}
        <ErrorState title="Couldn't load platform revenue." description={toasts.genericError} onRetry={() => void api.refetch()} />
      </div>
    );
  }

  return (
    <div>
      {row}
      <div className="space-y-4">
        <SummaryPanel cells={summaryCells} isLoading={api.loading} storageKey={summaryKey} aria-label="Revenue summary" />

        {allZero ? (
          <Card>
            <EmptyState
              icon={IconChartBar}
              title="No paid plans yet."
              description="Revenue shows here once a store pays."
            />
          </Card>
        ) : (
        <>
        {/* 50/50; the two cards stack when the row is under 720px (01 §7.25: 280px charts). */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
            <Card
              title="Earnings trend"
              description={
                mrrSince
                  ? `Plan bookings per month · dashed: MRR at each month end, recorded since ${formatDate(mrrSince)}`
                  : "Plan bookings per month · MRR is not recorded for this period yet"
              }
              padding="none"
            >
              {/* Round 3 D2: the shared LineChart (draws in, morphs, speaks; skeleton while loading). */}
              <div className="px-3 pb-4">
                <LineChart
                  points={trendShown.map((point) => ({ label: String(point.month), value: Number(point.revenue) || 0 }))}
                  compare={trendShown.map((point) => (point.mrr == null ? null : Number(point.mrr)))}
                  name="Bookings"
                  compareName="MRR"
                  changeWords={null}
                  format={(value) => formatMoney(value, { whole: true })}
                  noun="bookings"
                  peakNoun="Best month"
                  height={280}
                  entranceKey="console-earnings-trend"
                  loading={api.loading}
                  emptyDescription="This fills in after the first plan bookings."
                  phoneWindow={false}
                />
              </div>
            </Card>

            <Card title="Revenue by plan" description="Plan bookings per month" padding="none">
              <div ref={planBarsRef} data-play={planBarsPlay} className="h-70 px-3 pb-4">
                {chartBody(
                  monthly.length === 0,
                  planBarsPlay ? <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyShown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid {...recharts.grid} />
                      <XAxis dataKey="short" {...(isPhone ? rechartsEndTicks(monthlyShown, (row) => row.short) : recharts.axis)} />
                      <YAxis {...recharts.axis} width={MONEY_AXIS_WIDTH} tickFormatter={moneyAxis} />
                      <ChartTooltipSlot content={<ChartTooltip formatValue={tooltipMoney} />} cursor={{ fill: chartColors.grid }} />
                      <Legend {...legendProps} />
                      {PLAN_KEYS.map((plan, index) => (
                        <Bar
                          key={plan}
                          dataKey={plan}
                          name={PLAN_LABELS[plan]}
                          stackId="plans"
                          fill={planColors[plan]}
                          radius={index === PLAN_KEYS.length - 1 ? [CHART_BAR_RADIUS, CHART_BAR_RADIUS, 0, 0] : undefined}
                          isAnimationActive={planBarsAnimate}
                          animationBegin={index * 25}
                          animationDuration={RECHARTS_GROW_MS}
                          animationEasing="ease-out"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer> : null,
                )}
              </div>
            </Card>
          </div>
        </div>

        <TableCard<MrrMonthRow>
          title="MRR movement"
          description={
            mrrSince
              ? `From the daily MRR snapshot, recorded since ${formatDate(mrrSince)}. Earlier months are not recorded.`
              : "From the daily MRR snapshot. Nothing is recorded for this period yet."
          }
          aria-label="MRR movement"
          columns={mrrColumns}
          rows={mrrApi.error ? [] : mrrRows}
          getRowKey={(month) => month.key}
          isLoading={mrrApi.loading}
          emptyContent={
            mrrApi.error ? (
              <div className="p-4">
                <ErrorState inline title="Couldn't load the MRR history." onRetry={() => void mrrApi.refetch()} />
              </div>
            ) : (
              <NoDataEmpty />
            )
          }
          renderCell={(month, key) => {
            switch (key) {
              case "month":
                return <span className="font-medium text-fg">{month.label}</span>;
              case "mrr":
                return month.recordedDays === 0 ? (
                  <span className="text-fg-subtle">{NOT_RECORDED_COPY}</span>
                ) : (
                  <span className="num">{formatMoney(month.mrr, { whole: true })}</span>
                );
              case "paying":
                return <span className="num">{month.payingStores == null ? "—" : formatCount(month.payingStores)}</span>;
              case "new":
                return <span className="num">{movement(month.newMrr)}</span>;
              case "expansion":
                return <span className="num">{movement(month.expansionMrr)}</span>;
              case "contraction":
                return <span className="num">{movement(month.contractionMrr)}</span>;
              case "churned":
                return (
                  <span className={cx("num", month.churnedMrr != null && month.churnedMrr > 0 && toneTextClasses.danger)}>
                    {movement(month.churnedMrr)}
                  </span>
                );
              default:
                return null;
            }
          }}
          mobileRow={(month) => (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-fg">{month.label}</span>
                <span className="shrink-0 font-semibold text-fg num">
                  {month.recordedDays === 0 ? NOT_RECORDED_COPY : formatMoney(month.mrr, { whole: true })}
                </span>
              </div>
              <p className="mt-1 truncate text-label text-fg-muted num">
                {month.payingStores == null ? "—" : formatCount(month.payingStores)} paying · New {movement(month.newMrr)} ·
                Churned {movement(month.churnedMrr)}
              </p>
            </div>
          )}
        />

        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
            <TableCard<PlanBreakdownRow>
              title="Plan breakdown"
              aria-label="Plan breakdown"
              columns={planColumns}
              rows={planRows}
              getRowKey={(plan) => plan.plan}
              isLoading={api.loading}
              emptyContent={<NoDataEmpty />}
              renderCell={(plan, key) => {
                switch (key) {
                  case "plan":
                    return <span className="font-medium text-fg">{getPlanLabel(plan.plan)}</span>;
                  case "revenue":
                    return <span className="num">{formatMoney(plan.revenue, { whole: true })}</span>;
                  case "share":
                    return <span className="num">{formatPercent(plan.sharePercent)}</span>;
                  case "stores":
                    return <span className="num">{formatCount(plan.storeCount)}</span>;
                  case "mrr":
                    return <span className="num">{formatMoney(plan.mrr, { whole: true })}</span>;
                  default:
                    return null;
                }
              }}
            />

            <TableCard<GatewayBreakdownRow>
              title="Gateway split"
              aria-label="Gateway split"
              columns={gatewayColumns}
              rows={gatewayRows}
              getRowKey={(gateway) => gateway.gateway}
              isLoading={api.loading}
              emptyContent={<NoDataEmpty />}
              renderCell={(gateway, key) => {
                switch (key) {
                  case "gateway": {
                    const label = getPaymentGatewayLabel(gateway.gateway);
                    return (
                      <span className="flex min-w-0 items-center gap-2">
                        <LogoTile name={label} />
                        <span className="truncate font-medium text-fg">{label}</span>
                      </span>
                    );
                  }
                  case "collected":
                    return <span className="num">{money(gateway.collected)}</span>;
                  case "failed":
                    return <span className={cx("num", gateway.failed > 0 && toneTextClasses.danger)}>{money(gateway.failed)}</span>;
                  case "pending":
                    return <span className="num">{money(gateway.pending)}</span>;
                  case "share":
                    return <span className="num">{formatPercent(gateway.sharePercent)}</span>;
                  default:
                    return null;
                }
              }}
            />
          </div>
        </div>

        <TableCard<TopStoreRevenueRow>
          title="Top stores by collected revenue"
          aria-label="Top stores by collected revenue"
          columns={topStoreColumns}
          rows={topStores}
          getRowKey={(store) => store.clientId}
          isLoading={api.loading}
          rowHeight="tall"
          onRowAction={(store) => navigate(storeHref(store.clientId))}
          emptyContent={<NoDataEmpty />}
          renderCell={(store, key) => {
            switch (key) {
              case "store":
                return <TwoLine main={store.storeName} sub={store.ownerEmail} />;
              case "plan":
                return getPlanLabel(store.plan);
              case "collected":
                return <span className="font-medium num">{money(store.collected)}</span>;
              case "failed":
                return <span className={cx("num", store.failed > 0 && toneTextClasses.danger)}>{money(store.failed)}</span>;
              case "charges":
                return <span className="num">{formatCount(store.txnCount)}</span>;
              default:
                return null;
            }
          }}
        />
        </>
        )}
      </div>
    </div>
  );
}
