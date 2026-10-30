/**
 * Store page › Performance (PRD-024 FR-1.12, P-03)
 *
 * Charts the store's monthly usage snapshots (`platformUsage`): each month's
 * last snapshot, with its rolling 30-day net sales and orders. Shares the
 * Usage history query, so the page asks the server once.
 */

import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PLATFORM_USAGE } from "../../graphql/tenants";
import {
  performanceSeries,
  USAGE_HISTORY_MONTHS,
  type UsageSnapshot,
} from "../../lib/usage-history.util";
import { formatNumber } from "../../lib/utils";
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  chartColors,
  formatMoney,
  recharts,
} from "../ui";
import { IconAnalytics } from "../ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────

const MONTH_FORMAT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function monthLabel(month: string): string {
  return MONTH_FORMAT.format(new Date(`${month}-01T00:00:00Z`));
}

interface TooltipItem {
  payload?: { revenue30d: number; orders30d: number; date: string };
}

function PerformanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="text-caption text-fg-muted">{label}</p>
      <p className="text-caption font-medium text-fg num">
        Net sales · 30d: {formatMoney(point.revenue30d, { whole: true })}
      </p>
      <p className="text-caption text-fg-muted num">
        Orders · 30d: {formatNumber(point.orders30d)}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function ClientPerformanceCard({ tenantId }: { tenantId: string }) {
  const query = useQuery<{ platformUsage: UsageSnapshot[] }>(PLATFORM_USAGE, {
    variables: { tenantId, months: USAGE_HISTORY_MONTHS },
    fetchPolicy: "cache-and-network",
  });
  const points = useMemo(
    () =>
      performanceSeries(query.data?.platformUsage ?? []).map((point) => ({
        ...point,
        label: monthLabel(point.month),
      })),
    [query.data],
  );

  return (
    <Card
      title="Performance"
      description="Net sales in the 30 days before each month's last snapshot."
    >
      {query.error ? (
        <ErrorState
          inline
          title="Couldn't load the store's snapshots."
          onRetry={() => void query.refetch()}
        />
      ) : query.loading && !query.data ? (
        <Skeleton className="h-55 w-full" />
      ) : points.length === 0 ? (
        <EmptyState
          compact
          icon={IconAnalytics}
          title="No snapshots yet"
          description="The nightly usage snapshot fills this in."
        />
      ) : (
        <div className="h-55 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid {...recharts.grid} />
              <XAxis dataKey="label" {...recharts.axis} />
              <YAxis
                {...recharts.axis}
                width={80}
                // Full rupees on the axis, never "₹20L" (04 S-03a).
                tickFormatter={(value: number) => formatMoney(value, { whole: true })}
              />
              <Tooltip
                content={<PerformanceTooltip />}
                cursor={{ fill: chartColors.grid, opacity: 0.4 }}
              />
              <Bar
                dataKey="revenue30d"
                fill={chartColors.series[0]}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default ClientPerformanceCard;
