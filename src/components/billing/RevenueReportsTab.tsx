import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import type { GatewayBreakdownRow, MonthlyPlanRevenue, PlanBreakdownRow, TopStoreRevenueRow } from "../../types/reports";
import { toasts } from "../../copy";
import { DateRangeComparison, type DateRangeValue } from "../common/DateRangeComparison";
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
import { areaGradientStops, chartColors, planColors, recharts } from "../ui/chart-theme";
import {
  Card,
  ErrorState,
  KpiStrip,
  Skeleton,
  StatCard,
  Tooltip,
  cx,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  toneTextClasses,
  type DataTableColumn,
} from "../ui";

// Every backend tier: the server books Starter revenue too, and the CSV total includes it.
const PLAN_KEYS = ["STARTER", "PREMIUM", "PLUS", "ENTERPRISE"] as const;

/** Fixed 680 → Month 280px at 960px. */
const mrrColumns: DataTableColumn[] = [
  { key: "month", label: "Month" },
  { key: "mrr", label: "MRR at month end", width: 140 },
  { key: "paying", label: "Paying stores", width: 120 },
  { key: "new", label: "New", width: 100 },
  { key: "expansion", label: "Expansion", width: 110 },
  { key: "contraction", label: "Contraction", width: 110 },
  { key: "churned", label: "Churned", width: 100 },
];

const planColumns: DataTableColumn[] = [
  { key: "plan", label: "Plan" },
  { key: "revenue", label: "Revenue", width: 100 },
  { key: "share", label: "Share", width: 64 },
  { key: "stores", label: "Stores", width: 64 },
  { key: "mrr", label: "Monthly billing", width: 110 },
];

const gatewayColumns: DataTableColumn[] = [
  { key: "gateway", label: "Gateway" },
  { key: "collected", label: "Collected", width: 100 },
  { key: "failed", label: "Failed", width: 90 },
  { key: "pending", label: "Pending", width: 90 },
  { key: "share", label: "Share", width: 64 },
];

/** Fixed 430 → Store 530px. */
const topStoreColumns: DataTableColumn[] = [
  { key: "store", label: "Store" },
  { key: "plan", label: "Plan", width: 110 },
  { key: "collected", label: "Collected", width: 120 },
  { key: "failed", label: "Failed", width: 110, mobile: "hide" },
  { key: "charges", label: "Charges", width: 90 },
];

/** A label with a dotted underline that explains itself on hover. */
function Explained({ children, tip }: { children: ReactNode; tip: ReactNode }) {
  return (
    <Tooltip content={tip}>
      <span className="cursor-help border-b border-dashed border-line-strong">{children}</span>
    </Tooltip>
  );
}

/** PRD-024 FR-3.1: a month before the first MRR snapshot has no figure. */
const tooltipMoney = (value: number | null | undefined) =>
  value == null ? NOT_RECORDED_COPY : formatMoney(value, { whole: true });

/** A month's MRR movement; "—" when no recorded day had one (the first day has none). */
const movement = (value: number | null) => (value == null ? "—" : formatMoney(value, { whole: true }));

/** Money that may have paise: whole rupees show no ".00" (01 §4.4). */
const money = (value: number) => formatMoney(value);

export interface RevenueReportsTabProps extends AnalyticsTabProps {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
}

/**
 * Analytics › Platform revenue (04 S-05a): what stores pay Zcom for their plans. Every figure is the server
 * rollup for the chosen range (PRD-005 FR-5.3); MRR comes from the daily snapshot (PRD-024 FR-3.1).
 */
export function RevenueReportsTab({ tabRow, registerExport, range, onRangeChange }: RevenueReportsTabProps) {
  const navigate = useNavigate();

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

  const monthlyLabelled = useMemo(
    () => monthly.map((row) => ({ ...row, short: row.label.replace(/ 20\d\d$/, "") })),
    [monthly],
  );

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

  const row = tabRow(<DateRangeComparison value={range} onChange={onRangeChange} />);

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
        <KpiStrip>
          <StatCard
            bare
            isLoading={api.loading}
            label={<Explained tip="Plan bookings for the months in this period">Bookings</Explained>}
            value={formatMoney(kpis.planRevenue, { whole: true })}
            delta={kpis.momChangePercent}
            deltaLabel={kpis.momChangePercent == null ? "Plan bookings" : momLabel}
          />
          <StatCard
            bare
            isLoading={api.loading}
            label={
              <Explained tip="Successful payments minus refunds in this period. It can be below zero when refunds are larger than new payments.">
                Collected
              </Explained>
            }
            value={formatMoney(kpis.netCollected, { whole: true })}
            valueTone={kpis.netCollected < 0 ? "danger" : "default"}
            deltaLabel={
              kpis.refundedAmount > 0 ? `After ${formatMoney(kpis.refundedAmount, { whole: true })} refunded` : "Successful payments"
            }
          />
          <StatCard
            bare
            isLoading={api.loading}
            label={<Explained tip="Invoices still open whose due date is in this period">Open invoices</Explained>}
            value={formatMoney(kpis.pendingAmount, { whole: true })}
            deltaLabel="Due in this period, unpaid"
          />
          <StatCard
            bare
            isLoading={api.loading}
            label="Failed"
            value={formatMoney(kpis.failedAmount, { whole: true })}
            valueTone={kpis.failedAmount > 0 ? "danger" : "default"}
            deltaLabel="Charge failures"
          />
          <StatCard
            bare
            isLoading={api.loading}
            label={
              <Explained
                tip={`Monthly recurring revenue from paying (ACTIVE) subscriptions. Not included: ${formatMoney(summary.trialPipeline, { whole: true })} a month in trials and ${formatMoney(summary.atRiskMrr, { whole: true })} a month past due.`}
              >
                Monthly billing
              </Explained>
            }
            value={formatMoney(kpis.activeMrr, { whole: true })}
            deltaLabel={
              summary.atRiskMrr > 0
                ? `${formatCount(kpis.payingStores)} paying · ${formatMoney(summary.atRiskMrr, { whole: true })} past due`
                : `${formatCount(kpis.payingStores)} paying ${kpis.payingStores === 1 ? "store" : "stores"}`
            }
          />
        </KpiStrip>

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
              <div className="h-70 px-3 pb-4">
                {chartBody(
                  trend.length === 0,
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendWithMrr} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          {areaGradientStops.map((stop) => (
                            <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                          ))}
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...recharts.grid} />
                      <XAxis dataKey="month" {...recharts.axis} />
                      <YAxis {...recharts.axis} width={MONEY_AXIS_WIDTH} tickFormatter={moneyAxis} />
                      <ChartTooltipSlot content={<ChartTooltip formatValue={tooltipMoney} />} />
                      <Legend {...legendProps} />
                      <Area dataKey="revenue" name="Bookings" stroke={chartColors.series[0]} {...recharts.area} fill="url(#reportsRevenueFill)" />
                      <Line
                        type="monotone"
                        dataKey="mrr"
                        name="MRR"
                        stroke={chartColors.axis}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>,
                )}
              </div>
            </Card>

            <Card title="Revenue by plan" description="Plan bookings per month" padding="none">
              <div className="h-70 px-3 pb-4">
                {chartBody(
                  monthly.length === 0,
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyLabelled} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid {...recharts.grid} />
                      <XAxis dataKey="short" {...recharts.axis} />
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
                          radius={index === PLAN_KEYS.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>,
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
      </div>
    </div>
  );
}
