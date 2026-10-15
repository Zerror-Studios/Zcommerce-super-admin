import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenuePoint } from "../../types";
import { formatCurrency, formatNumber } from "../../lib/utils";
import { CardWrapper } from "../ui/CardWrapper";
import { areaGradientStops, chartColors, recharts } from "../ui/chart-theme";
import { Skeleton } from "../ui/Skeleton";

export interface RevenueChartProps {
  data: RevenuePoint[];
  isLoading?: boolean;
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
    <div className="rounded-field border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-caption text-fg-muted">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-caption font-medium text-fg tabular-nums">
          {entry.dataKey === "revenue" ? "Revenue" : "MRR"}:{" "}
          {entry.dataKey === "mrr"
            ? formatNumber(entry.value ?? 0)
            : formatCurrency(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  return (
    <CardWrapper title="Revenue trend" description="Platform-wide revenue — last 12 months" className="h-full">
      {isLoading ? (
        <Skeleton className="h-70 w-full" />
      ) : (
        <div className="h-70 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  {areaGradientStops.map((stop) => (
                    <stop key={stop.offset} offset={stop.offset} stopColor={chartColors.series[0]} stopOpacity={stop.stopOpacity} />
                  ))}
                </linearGradient>
              </defs>
              <CartesianGrid {...recharts.grid} />
              <XAxis dataKey="month" {...recharts.axis} />
              <YAxis {...recharts.axis} tickFormatter={(v: number) => formatCurrency(v, "INR", true)} />
              <Tooltip content={<ChartTooltip />} />
              <Area {...recharts.area} dataKey="revenue" stroke={chartColors.series[0]} fill="url(#revenueFill)" />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke={chartColors.categorical[2]}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardWrapper>
  );
}
