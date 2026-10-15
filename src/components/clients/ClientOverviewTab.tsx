import {
  CartesianGrid,
  Line,
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type { Client, Subscription } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "../../lib/utils";
import { StatusChip } from "../common/StatusChip";
import { StatCard } from "../dashboard/StatCard";
import { areaGradientStops, chartColors, recharts } from "../ui/chart-theme";
import { IconCustomers, IconDollar, IconOrders, IconTrendUp } from "../ui/icons";
import { CardWrapper } from "../ui/CardWrapper";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
}

interface MonthPoint {
  month: string;
  revenue: number;
  orders: number;
}

function buildClientTrend(client: Client): MonthPoint[] {
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const baseRevenue = Math.max(client.revenue / 12, 200);
  const baseOrders = Math.max(client.orders30d / 1.2, 5);

  return months.map((month, index) => {
    const factor = 0.75 + index * 0.05 + (client.growthPercent / 100) * 0.1;
    return {
      month,
      revenue: Math.round(baseRevenue * factor),
      orders: Math.round(baseOrders * factor),
    };
  });
}

interface TooltipPayloadItem {
  value?: number;
  dataKey?: string | number;
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
        <p key={String(entry.dataKey)} className="text-body font-bold">
          {entry.dataKey === "revenue"
            ? `Revenue: ${formatCurrency(entry.value ?? 0)}`
            : `Orders: ${formatNumber(entry.value ?? 0)}`}
        </p>
      ))}
    </div>
  );
}

export function ClientOverviewTab({ client, subscription }: ClientOverviewTabProps) {
  const trend = buildClientTrend(client);
  const subscriptionStatus =
    subscription?.status ?? (client.status === "trial" ? "trialing" : "active");

  return (
    <div className="space-y-4">
      <CardWrapper title="Store profile" description={<>Account and billing summary for {client.storeName}</>} bodyClassName="p-8 py-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryItem label="Owner" value={client.ownerName} />
          <SummaryItem label="Email" value={client.ownerEmail} />
          <SummaryItem
            label="Status"
            valueNode={<StatusChip kind="client" value={client.status} />}
          />
          <SummaryItem label="Plan" value={subscription?.plan ?? client.plan} />
          <SummaryItem
            label="Joined"
            value={formatDate(client.joinedDate)}
          />
          <SummaryItem
            label="Renewal date"
            value={
              subscription?.renewalDate
                ? formatDate(subscription.renewalDate)
                : "—"
            }
          />
          <SummaryItem
            label="Subscription"
            valueNode={
              <StatusChip kind="subscription" value={subscriptionStatus} />
            }
          />
      </CardWrapper>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Store Revenue"
          value={formatCurrency(client.revenue)}
          change={client.growthPercent}
          icon={IconDollar}
        />
        <StatCard
          title="Monthly Recurring Revenue (₹)"
          value={formatNumber(client.mrr)}
          change={client.status === "trial" ? 0 : 2.4}
          icon={IconTrendUp}
        />
        <StatCard
          title="Orders (30d)"
          value={formatNumber(client.orders30d)}
          change={client.growthPercent * 0.6}
          icon={IconOrders}
        />
        <StatCard
          title="Growth"
          value={formatPercent(client.growthPercent)}
          change={client.growthPercent}
          icon={IconCustomers}
        />
      </div>

      <CardWrapper title="Performance trend" description={<>Estimated monthly revenue & orders for {client.storeName}</>}>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    {areaGradientStops.map((stop) => (
                      <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid {...recharts.grid} />
                <XAxis dataKey="month" {...recharts.axis} />
                <YAxis
                  yAxisId="left"
                  {...recharts.axis}
                  tickFormatter={(v: number) => formatCurrency(v, "INR", true)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...recharts.axis}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  yAxisId="left"
                  dataKey="revenue"
                  stroke={chartColors.series[0]}
                    {...recharts.area}
                    fill="url(#clientRevenueFill)"
                  />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  stroke={chartColors.categorical[2]}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
      </CardWrapper>
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}

function SummaryItem({ label, value, valueNode }: SummaryItemProps) {
  return (
    <div className="rounded-xl bg-default-50 px-4 py-3">
      <p className="text-caption text-default-500">{label}</p>
      <div className="mt-1 text-body font-bold">{valueNode ?? value}</div>
    </div>
  );
}
