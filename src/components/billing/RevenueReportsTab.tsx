import { Card, CardBody, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { endOfDay, endOfMonth, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clients, transactions } from "../../lib/mockData";
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
import { formatCurrency, formatNumber, formatPercent } from "../../lib/utils";
import {
  DateRangeComparison,
  type DateRangeValue,
} from "../common/DateRangeComparison";
import { dataTableClassNames } from "../common/dataTableStyles";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { StatusChip } from "../common/StatusChip";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { areaGradientStops, chartColors, planColors, recharts } from "../ui/chart-theme";
import { IconDownload, IconTrendDown, IconTrendUp } from "../ui/icons";
import { Button as UiButton } from "../ui";
import { CardWrapper } from "../ui/CardWrapper";

const defaultRange: DateRangeValue = {
  startDate: startOfMonth(new Date(2026, 3, 1)),
  endDate: endOfDay(endOfMonth(new Date(2026, 8, 1))),
};

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number | null;
}

function SummaryCard({ title, value, subtitle, change }: SummaryCardProps) {
  const positive = change != null && change >= 0;
  return (
    <Card shadow="none" className="border border-line bg-surface">
      <CardBody className="gap-1 p-4">
        <p className="text-caption font-medium text-default-500">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {change != null ? (
          <p
            className={`flex items-center gap-0.5 text-caption font-medium ${
              positive ? "text-success" : "text-danger"
            }`}
          >
            {positive ? (
              <IconTrendUp size={12} />
            ) : (
              <IconTrendDown size={12} />
            )}
            {formatPercent(Math.abs(change))} MoM
          </p>
        ) : subtitle ? (
          <p className="text-caption text-default-400">{subtitle}</p>
        ) : null}
      </CardBody>
    </Card>
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

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-default-200 bg-content1 px-3 py-2 shadow-md">
      <p className="mb-1 text-caption font-medium text-default-500">{label}</p>
      {payload.map((entry) => (
        <p
          key={String(entry.dataKey)}
          className="text-body font-bold"
          style={{ color: entry.color }}
        >
          {entry.name ?? entry.dataKey}: {formatCurrency(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

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

  const trend = useMemo(() => buildTrendWithMrr(monthly), [monthly]);

  const kpis = useMemo(
    () =>
      buildRevenueKpis({
        monthly,
        allMonthly: MONTHLY_PLAN_REVENUE,
        transactions,
        clients,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
      }),
    [monthly, range.endDate, range.startDate],
  );

  const planRows = useMemo(
    () => buildPlanBreakdown(monthly, clients),
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

  const exportCsv = () => {
    const columns = [
      { key: "label", label: "Month" },
      { key: "Starter", label: "Starter" },
      { key: "Pro", label: "Pro" },
      { key: "Enterprise", label: "Enterprise" },
      { key: "total", label: "Total" },
    ];
    const rows = monthly.map((row: MonthlyPlanRevenue) => ({
      label: row.label,
      Starter: row.Starter,
      Pro: row.Pro,
      Enterprise: row.Enterprise,
      total: monthTotal(row),
    }));
    downloadCsv("revenue-by-plan.csv", rowsToCsv(rows, columns));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeComparison value={range} onChange={setRange} />
        <UiButton
          variant="outline"
          size="sm"
          startIcon={<IconDownload size={14} strokeWidth={2.5} />}
          isDisabled={monthly.length === 0}
          onPress={exportCsv}
        >
          Export CSV
        </UiButton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          title="Plan revenue"
          value={formatCurrency(kpis.planRevenue)}
          change={kpis.momChangePercent}
        />
        <SummaryCard
          title="Net collected"
          value={formatCurrency(kpis.netCollected)}
          subtitle="Success − refunds in range"
        />
        <SummaryCard
          title="Pending"
          value={formatCurrency(kpis.pendingAmount)}
          subtitle="Awaiting settlement"
        />
        <SummaryCard
          title="Failed"
          value={formatCurrency(kpis.failedAmount)}
          subtitle={
            kpis.refundedAmount > 0
              ? `${formatCurrency(kpis.refundedAmount)} refunded`
              : "Charge failures"
          }
        />
        <SummaryCard
          title="Active MRR"
          value={formatCurrency(kpis.activeMrr)}
          subtitle="Current paid + trial MRR"
        />
        <SummaryCard
          title="Paying stores"
          value={formatNumber(kpis.payingStores)}
          subtitle="Active with MRR > 0"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CardWrapper title="Revenue trend" description="Monthly plan bookings vs trailing 3‑month average" bodyClassName="p-2 h-[300px]">
            {trend.length === 0 ? (
              <NoDataPlaceholder
                title="No months in range"
                description="Widen the date range to see revenue trend."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      {areaGradientStops.map((stop) => (
                        <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                      ))}
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...recharts.grid} />
                  <XAxis dataKey="month" {...recharts.axis} />
                  <YAxis
                    {...recharts.axis}
                    tickFormatter={(v: number) => formatCurrency(v, "INR", true)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Area
                    dataKey="revenue"
                    name="Revenue"
                    stroke={chartColors.series[0]}
                    {...recharts.area}
                    fill="url(#reportsRevenueFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    name="Trailing avg"
                    stroke={chartColors.categorical[2]}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
        </CardWrapper>

        <CardWrapper title="Revenue by plan" description="Stacked subscription bookings per month" bodyClassName="p-2 h-[300px]">
            {monthly.length === 0 ? (
              <NoDataPlaceholder
                title="No months in range"
                description="Widen the date range to see plan mix."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...recharts.grid} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => String(v).replace(/ 20\d\d$/, "")}
                  />
                  <YAxis
                    {...recharts.axis}
                    tickFormatter={(v: number) => formatCurrency(v, "INR", true)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Starter" stackId="a" fill={planColors.Starter} />
                  <Bar dataKey="Pro" stackId="a" fill={planColors.Pro} />
                  <Bar
                    dataKey="Enterprise"
                    stackId="a"
                    fill={planColors.Enterprise}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
        </CardWrapper>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CardWrapper title="Plan breakdown" description="Share of period revenue, store count, and live MRR" bodyClassName="p-0" className="overflow-hidden">
            <Table
              aria-label="Plan revenue breakdown"
              removeWrapper
              classNames={{
                ...dataTableClassNames,
                base: "rounded-none border-0 border-t border-default-200 overflow-hidden bg-surface",
              }}
            >
              <TableHeader>
                <TableColumn>Plan</TableColumn>
                <TableColumn>Revenue</TableColumn>
                <TableColumn>Share</TableColumn>
                <TableColumn>Stores</TableColumn>
                <TableColumn>MRR</TableColumn>
              </TableHeader>
              <TableBody
                items={planRows}
                emptyContent={
                  <NoDataPlaceholder
                    title="No plan revenue"
                    description="No plan bookings in this range."
                  />
                }
              >
                {(row) => (
                  <TableRow key={row.plan}>
                    <TableCell>
                      <StatusChip kind="plan" value={row.plan} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell>{row.sharePercent.toFixed(1)}%</TableCell>
                    <TableCell>{formatNumber(row.storeCount)}</TableCell>
                    <TableCell>{formatCurrency(row.mrr)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardWrapper>

        <CardWrapper title="Gateway split" description="Collected vs failed charges by payment gateway" bodyClassName="p-0" className="overflow-hidden">
            <Table
              aria-label="Gateway revenue breakdown"
              removeWrapper
              classNames={{
                ...dataTableClassNames,
                base: "rounded-none border-0 border-t border-default-200 overflow-hidden bg-surface",
              }}
            >
              <TableHeader>
                <TableColumn>Gateway</TableColumn>
                <TableColumn>Collected</TableColumn>
                <TableColumn>Failed</TableColumn>
                <TableColumn>Pending</TableColumn>
                <TableColumn>Share</TableColumn>
              </TableHeader>
              <TableBody
                items={gatewayRows}
                emptyContent={
                  <NoDataPlaceholder
                    title="No charges in range"
                    description="Transactions in this period will show here."
                  />
                }
              >
                {(row) => (
                  <TableRow key={row.gateway}>
                    <TableCell className="font-medium">{row.gateway}</TableCell>
                    <TableCell>{formatCurrency(row.collected)}</TableCell>
                    <TableCell className="text-danger">
                      {formatCurrency(row.failed)}
                    </TableCell>
                    <TableCell>{formatCurrency(row.pending)}</TableCell>
                    <TableCell>{row.sharePercent.toFixed(1)}%</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardWrapper>
      </div>

      <CardWrapper title="Top stores by collected revenue" description="Successful charges in the selected range" bodyClassName="p-0" className="overflow-hidden">
          <Table
            aria-label="Top stores by revenue"
            removeWrapper
            classNames={{
              ...dataTableClassNames,
              base: "rounded-none border-0 border-t border-default-200 overflow-hidden bg-surface",
            }}
          >
            <TableHeader>
              <TableColumn>Store</TableColumn>
              <TableColumn>Plan</TableColumn>
              <TableColumn>Collected</TableColumn>
              <TableColumn>Failed</TableColumn>
              <TableColumn>Charges</TableColumn>
            </TableHeader>
            <TableBody
              items={topStores}
              emptyContent={
                <NoDataPlaceholder
                  title="No store charges"
                  description="Successful payments in this range will rank here."
                />
              }
            >
              {(row) => (
                <TableRow
                  key={row.clientId}
                  className="cursor-pointer"
                  onClick={() => navigate(`/clients/${row.clientId}`)}
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium whitespace-nowrap">
                        {row.storeName}
                      </p>
                      <p className="truncate text-caption text-default-400">
                        {row.ownerEmail}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="plan" value={row.plan} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(row.collected)}
                  </TableCell>
                  <TableCell className="text-danger">
                    {formatCurrency(row.failed)}
                  </TableCell>
                  <TableCell>{formatNumber(row.txnCount)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardWrapper>
    </div>
  );
}
