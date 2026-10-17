import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { endOfDay, endOfMonth, startOfMonth } from "date-fns";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getPaymentGatewayLabel, getPlanLabel, PLAN_LABELS } from "../../lib/display-labels.util";
import { clients, subscriptions, transactions } from "../../lib/mockData";
import { monthlyBilling } from "../../lib/metrics";
import {
  MONTHLY_PLAN_REVENUE,
  buildGatewayBreakdown,
  buildPlanBreakdown,
  buildRevenueKpis,
  buildTopStoreRevenue,
  buildTrendWithMrr,
  filterMonthlyPlanRevenue,
  monthTotal,
  type MonthlyPlanRevenue,
} from "../../lib/revenueReports";
import { downloadCsv, rowsToCsv } from "../../lib/subscriptionReports";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { dataTableClassNames } from "../common/dataTableStyles";
import { PageHeader } from "../common/PageHeader";
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
import { areaGradientStops, chartColors, planColors, recharts } from "../ui/chart-theme";
import { IconDownload } from "../ui/icons";
import {
  Button as UiButton,
  Card,
  EmptyState,
  KpiStrip,
  StatCard,
  Tooltip,
  cx,
  formatCount,
  formatMoney,
  formatPercent,
  tableRowClasses,
  toneTextClasses,
} from "../ui";
import { emptyStates } from "../../copy";

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(new Date(2026, 3, 1)),
  endDate: endOfDay(endOfMonth(new Date(2026, 8, 1))),
};

const PLAN_KEYS = ["PREMIUM", "PLUS", "ENTERPRISE"] as const;

/** Static tables inside cards: no fixed scroll height, rows are not clickable unless stated. */
const cardTableClassNames = {
  ...dataTableClassNames,
  base: "rounded-none border-0 border-t border-line overflow-x-auto bg-surface",
  tr: tableRowClasses,
};

const right = "block text-right num";

/** A label with a dotted underline that explains itself on hover. */
function Explained({ children, tip }: { children: ReactNode; tip: ReactNode }) {
  return (
    <Tooltip content={tip}>
      <span className="cursor-help border-b border-dashed border-line-strong">{children}</span>
    </Tooltip>
  );
}

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

/** Popover-style chart tooltip (docs/design/02-components.md §14). */
function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-caption text-fg-subtle">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-caption text-fg">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          <span className="text-fg-muted">{entry.name ?? entry.dataKey}</span>
          <span className="ml-auto pl-3 font-medium num">{formatMoney(entry.value ?? 0, { whole: true })}</span>
        </p>
      ))}
    </div>
  );
}

const legendProps = {
  verticalAlign: "top",
  align: "right",
  iconType: "circle",
  iconSize: 8,
  height: 28,
  wrapperStyle: { fontSize: 12 },
} as const;

const moneyAxis = (v: number) => formatMoney(v, { compact: true });

export function RevenueReportsTab() {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>(defaultRange);

  const monthly = useMemo(
    () =>
      filterMonthlyPlanRevenue(
        MONTHLY_PLAN_REVENUE,
        range.startDate,
        range.endDate,
      ),
    [range.endDate, range.startDate],
  );

  const trend = useMemo(
    () => buildTrendWithMrr(MONTHLY_PLAN_REVENUE, subscriptions, range.startDate, range.endDate),
    [range.endDate, range.startDate],
  );

  const kpis = useMemo(
    () =>
      buildRevenueKpis({
        monthly,
        allMonthly: MONTHLY_PLAN_REVENUE,
        transactions,
        subscriptions,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
      }),
    [monthly, range.endDate, range.startDate],
  );

  // One definition with Home and Billing (docs/design/04-super-admin.md §2), not revenueReports' activeMrr.
  const billing = useMemo(() => monthlyBilling(clients), []);

  const planRows = useMemo(
    () => buildPlanBreakdown(monthly, clients, subscriptions),
    [monthly],
  );

  const gatewayRows = useMemo(
    () =>
      buildGatewayBreakdown(transactions, range.startDate, range.endDate),
    [range.endDate, range.startDate],
  );

  const topStores = useMemo(
    () =>
      buildTopStoreRevenue(
        transactions,
        clients,
        range.startDate,
        range.endDate,
      ),
    [range.endDate, range.startDate],
  );

  const monthlyLabelled = useMemo(
    () => monthly.map((row) => ({ ...row, short: row.label.replace(/ 20\d\d$/, "") })),
    [monthly],
  );

  const exportCsv = () => {
    const columns = [
      { key: "label", label: "Month" },
      { key: "PREMIUM", label: PLAN_LABELS.PREMIUM },
      { key: "PLUS", label: PLAN_LABELS.PLUS },
      { key: "ENTERPRISE", label: PLAN_LABELS.ENTERPRISE },
      { key: "total", label: "Total" },
    ];
    const rows = monthly.map((row: MonthlyPlanRevenue) => ({
      label: row.label,
      PREMIUM: row.PREMIUM,
      PLUS: row.PLUS,
      ENTERPRISE: row.ENTERPRISE,
      total: monthTotal(row),
    }));
    downloadCsv("revenue-by-plan.csv", rowsToCsv(rows, columns));
  };

  // "Sep vs Aug" for the Bookings delta (buildRevenueKpis compares the last month in range with the one before).
  const momLabel = useMemo(() => {
    const last = monthly[monthly.length - 1];
    const index = last ? MONTHLY_PLAN_REVENUE.findIndex((row) => row.key === last.key) : -1;
    const previous = index > 0 ? MONTHLY_PLAN_REVENUE[index - 1] : undefined;
    const short = (row: MonthlyPlanRevenue) => row.label.replace(/ 20\d\d$/, "");
    return last && previous ? `${short(last)} vs ${short(previous)}` : "Plan bookings";
  }, [monthly]);

  const noData = <EmptyState compact description={emptyStates.noData} />;

  return (
    <div>
      <PageHeader
        title="Platform revenue"
        description="What stores pay Zcom for their plans."
        actions={
          <>
            <DateRangeComparison value={range} onChange={setRange} />
            <UiButton
              variant="ghost"
              startIcon={<IconDownload aria-hidden />}
              isDisabled={monthly.length === 0}
              onPress={exportCsv}
            >
              Export CSV
            </UiButton>
          </>
        }
      />

      <div className="space-y-4">
        <KpiStrip>
          <StatCard
            bare
            label={<Explained tip="Plan bookings for the months in this period">Bookings</Explained>}
            value={kpis.planRevenue}
            format="money"
            delta={kpis.momChangePercent}
            deltaLabel={kpis.momChangePercent == null ? "Plan bookings" : momLabel}
          />
          <StatCard
            bare
            label={<Explained tip="Successful payments minus refunds in this period. It can be below zero when refunds are larger than new payments.">Collected</Explained>}
            value={formatMoney(kpis.netCollected, { paise: true })}
            valueTone={kpis.netCollected < 0 ? "danger" : "default"}
            deltaLabel={
              kpis.refundedAmount > 0
                ? `After ${formatMoney(kpis.refundedAmount, { paise: true })} refunded`
                : "Successful payments"
            }
          />
          <StatCard
            bare
            label="Pending"
            value={formatMoney(kpis.pendingAmount, { paise: true })}
            deltaLabel="Awaiting settlement"
          />
          <StatCard
            bare
            label="Failed"
            value={formatMoney(kpis.failedAmount, { paise: true })}
            valueTone={kpis.failedAmount > 0 ? "danger" : "default"}
            deltaLabel="Charge failures"
          />
          <StatCard
            bare
            label={<Explained tip="Monthly recurring revenue">Monthly billing</Explained>}
            value={billing}
            format="money"
            deltaLabel={`${formatCount(kpis.payingStores)} paying ${kpis.payingStores === 1 ? "store" : "stores"}`}
          />
        </KpiStrip>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Earnings trend" description="Plan bookings per month · dashed: 3-month average" padding="none">
            <div className="h-72 px-3 pb-4">
              {trend.length === 0 ? (
                noData
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        {areaGradientStops.map((stop) => (
                          <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                        ))}
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...recharts.grid} />
                    <XAxis dataKey="month" {...recharts.axis} />
                    <YAxis {...recharts.axis} width={56} tickFormatter={moneyAxis} />
                    <ChartTooltipSlot content={<ChartTooltip />} />
                    <Legend {...legendProps} />
                    <Area
                      dataKey="revenue"
                      name="Bookings"
                      stroke={chartColors.series[0]}
                      {...recharts.area}
                      fill="url(#reportsRevenueFill)"
                    />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      name="3-month average"
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

          <Card title="Revenue by plan" description="Plan bookings per month" padding="none">
            <div className="h-72 px-3 pb-4">
              {monthly.length === 0 ? (
                noData
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyLabelled} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...recharts.grid} />
                    <XAxis dataKey="short" {...recharts.axis} />
                    <YAxis {...recharts.axis} width={56} tickFormatter={moneyAxis} />
                    <ChartTooltipSlot content={<ChartTooltip />} cursor={{ fill: chartColors.grid }} />
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
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Plan breakdown" padding="none" className="overflow-hidden">
            <Table aria-label="Plan breakdown" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Plan</TableColumn>
                <TableColumn align="end">Revenue</TableColumn>
                <TableColumn align="end">Share</TableColumn>
                <TableColumn align="end">Stores</TableColumn>
                <TableColumn align="end">
                  <Explained tip="Monthly recurring revenue">Monthly billing</Explained>
                </TableColumn>
              </TableHeader>
              <TableBody items={planRows} emptyContent={noData}>
                {(row) => (
                  <TableRow key={row.plan}>
                    <TableCell className="font-medium">{getPlanLabel(row.plan)}</TableCell>
                    <TableCell><span className={right}>{formatMoney(row.revenue, { whole: true })}</span></TableCell>
                    <TableCell><span className={right}>{formatPercent(row.sharePercent)}</span></TableCell>
                    <TableCell><span className={right}>{formatCount(row.storeCount)}</span></TableCell>
                    <TableCell>
                      <span className={right}>
                        {formatMoney(monthlyBilling(clients.filter((client) => client.plan === row.plan)), { whole: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card title="Gateway split" padding="none" className="overflow-hidden">
            <Table aria-label="Gateway split" removeWrapper classNames={cardTableClassNames}>
              <TableHeader>
                <TableColumn>Gateway</TableColumn>
                <TableColumn align="end">Collected</TableColumn>
                <TableColumn align="end">Failed</TableColumn>
                <TableColumn align="end">Pending</TableColumn>
                <TableColumn align="end">Share</TableColumn>
              </TableHeader>
              <TableBody items={gatewayRows} emptyContent={noData}>
                {(row) => (
                  <TableRow key={row.gateway}>
                    <TableCell className="font-medium">{getPaymentGatewayLabel(row.gateway)}</TableCell>
                    <TableCell><span className={right}>{formatMoney(row.collected, { paise: true })}</span></TableCell>
                    <TableCell>
                      <span className={cx(right, row.failed > 0 && toneTextClasses.danger)}>{formatMoney(row.failed, { paise: true })}</span>
                    </TableCell>
                    <TableCell><span className={right}>{formatMoney(row.pending, { paise: true })}</span></TableCell>
                    <TableCell><span className={right}>{formatPercent(row.sharePercent)}</span></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card title="Top stores by collected revenue" padding="none" className="overflow-hidden">
          <Table aria-label="Top stores by collected revenue" removeWrapper classNames={cardTableClassNames}>
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Plan</TableColumn>
              <TableColumn align="end">Collected</TableColumn>
              <TableColumn align="end">Failed</TableColumn>
              <TableColumn align="end">Charges</TableColumn>
            </TableHeader>
            <TableBody items={topStores} emptyContent={noData}>
              {(row) => (
                <TableRow
                  key={row.clientId}
                  className="cursor-pointer"
                  onClick={() => navigate(`/stores/${row.clientId}`)}
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate whitespace-nowrap font-medium text-fg">
                        {row.storeName}
                      </p>
                      <p className="truncate text-caption text-fg-subtle">
                        {row.ownerEmail}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getPlanLabel(row.plan)}</TableCell>
                  <TableCell><span className={cx(right, "font-medium")}>{formatMoney(row.collected, { paise: true })}</span></TableCell>
                  <TableCell>
                    <span className={cx(right, row.failed > 0 && toneTextClasses.danger)}>{formatMoney(row.failed, { paise: true })}</span>
                  </TableCell>
                  <TableCell><span className={right}>{formatCount(row.txnCount)}</span></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
