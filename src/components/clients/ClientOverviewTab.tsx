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
import type { Client, Plan, Subscription } from "../../types";
import { getStoreHealth } from "../../lib/storeHealth";
import { formatDate } from "../../lib/utils";
import { areaGradientStops, chartColors, recharts } from "../ui/chart-theme";
import { AiInsightCard, Card, HealthScore, KpiStrip, StatCard, Tooltip as UiTooltip, formatCount, formatMoney, formatRange, getHealthBand, useAiEnabled } from "../ui";
import { useState } from "react";
import { storeInsight } from "../../lib/aiSamples";
import { transactions } from "../../lib/mockData";
import { loadPlatformSettings } from "../../lib/platformSettings";
import { ClientUsageTab } from "./ClientUsageTab";

export interface ClientOverviewTabProps {
  client: Client;
  subscription?: Subscription;
  plan?: Plan;
}

interface MonthPoint {
  month: string;
  revenue: number;
  orders: number;
}

/** Synthetic trend from the store's totals (unchanged; there is no monthly store data yet). */
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
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-caption text-fg-muted">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-caption font-medium text-fg num">
          {entry.dataKey === "revenue"
            ? `Store sales: ${formatMoney(entry.value ?? 0, { whole: true })}`
            : `Orders: ${formatCount(entry.value ?? 0)}`}
        </p>
      ))}
    </div>
  );
}

/** Store detail › Overview (docs/design/04-super-admin.md §3.4): KPIs → Performance → Health → Plan usage; Profile and Notes on the side. */
export function ClientOverviewTab({ client, subscription, plan }: ClientOverviewTabProps) {
  const trend = buildClientTrend(client);
  const health = getStoreHealth(client, subscription);
  // growthPercent −100 means the comparison can't be shown as a real change (docs/design/05-wording.md §2).
  const growthUnknown = client.growthPercent <= -100;
  // Insight card (AI flag), written from this store's own payment and health data.
  const aiEnabled = useAiEnabled();
  const [insightDismissed, setInsightDismissed] = useState(false);
  const insight = aiEnabled && !insightDismissed
    ? storeInsight(client, subscription, transactions, loadPlatformSettings().gracePeriodDays, new Date())
    : null;

  return (
    // Top: numbers + chart beside profile + notes (both columns end level). Below: health and plan usage, full width.
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <KpiStrip>
            <StatCard
              bare
              label="Store sales · 30d"
              value={client.revenue}
              format="money"
              delta={growthUnknown ? null : client.growthPercent}
              deltaLabel={
                growthUnknown ? (
                  <UiTooltip content="No sales in the previous period">
                    <span>—</span>
                  </UiTooltip>
                ) : (
                  "vs previous 30 days"
                )
              }
            />
            <StatCard bare label="Orders · 30d" value={client.orders30d} deltaLabel={null} />
            <StatCard
              bare
              label="Health"
              value={health.score}
              deltaLabel={getHealthBand(health.score).label}
            />
            <StatCard bare label="Monthly fee" value={client.mrr} format="money" deltaLabel={`${client.plan} plan`} />
          </KpiStrip>

          {insight ? (
            <AiInsightCard
              title={insight.title}
              body={insight.body}
              source={`Based on this store's payments, orders and activity, ${formatRange(new Date(new Date().getTime() - 30 * 86_400_000), new Date())}`}
              onDismiss={() => setInsightDismissed(true)}
            />
          ) : null}

          <Card
            title="Performance"
            actions={
              <div className="flex items-center gap-3 text-caption text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-1" />
                  Store sales
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="w-3 border-t border-dashed border-chart-compare" />
                  Orders
                </span>
              </div>
            }
          >
            <div className="h-65 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
                    width={56}
                    tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                  />
                  <YAxis yAxisId="right" orientation="right" {...recharts.axis} width={40} />
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
                    stroke="var(--zc-chart-compare)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Profile">
            <dl className="flex flex-col gap-3">
              <ProfileRow label="Owner">{client.ownerName}</ProfileRow>
              <ProfileRow label="Email">
                <a href={`mailto:${client.ownerEmail}`} className="break-all text-brand hover:underline">
                  {client.ownerEmail}
                </a>
              </ProfileRow>
              <ProfileRow label="Plan">{subscription?.plan ?? client.plan}</ProfileRow>
              <ProfileRow label="Joined">{formatDate(client.joinedDate)}</ProfileRow>
              <ProfileRow label="Renewal">
                {subscription?.renewalDate ? formatDate(subscription.renewalDate) : <span className="text-fg-subtle">—</span>}
              </ProfileRow>
              <ProfileRow label="Monthly fee">
                <span className="num">{formatMoney(client.mrr, { whole: true })}</span>
              </ProfileRow>
            </dl>
          </Card>

          <Card title="Notes" className="flex-1">
            {client.notes ? (
              <p className="whitespace-pre-line text-body text-fg">{client.notes}</p>
            ) : (
              <p className="text-body text-fg-muted">No notes yet.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Health" className="h-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <HealthScore score={health.score} />
            <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-2 sm:pt-2.5">
              {health.factors.map((factor) => (
                <li key={factor} className="text-body text-fg-muted">
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <ClientUsageTab client={client} plan={plan} className="h-full" />
      </div>
    </div>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-label text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-body text-fg">{children}</dd>
    </div>
  );
}
