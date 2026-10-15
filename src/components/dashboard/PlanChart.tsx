import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PlanDistribution } from "../../types";
import { CardWrapper } from "../ui/CardWrapper";
import { planColor, recharts } from "../ui/chart-theme";
import { Skeleton } from "../ui/Skeleton";

export interface PlanChartProps {
  data: PlanDistribution[];
  isLoading?: boolean;
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: PlanDistribution;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-field border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="text-caption font-medium text-fg tabular-nums">
        {item.name}: {item.value} clients
      </p>
    </div>
  );
}

/** Plan colors are fixed across both products (design-system §1.4), not taken from the data. */
export function PlanChart({ data, isLoading }: PlanChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <CardWrapper title="Plan distribution" description="Clients by subscription plan" className="h-full">
      {isLoading ? (
        <Skeleton className="mx-auto size-56 rounded-full" />
      ) : (
        <>
          <div className="relative mx-auto h-56 w-full max-w-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} {...recharts.donut}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={planColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-title font-bold text-fg tabular-nums">{total}</span>
              <span className="text-caption text-fg-muted">clients</span>
            </div>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {data.map((entry) => (
              <li key={entry.name} className="flex items-center gap-2 text-body">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: planColor(entry.name) }} />
                <span className="text-fg-muted">{entry.name}</span>
                <span className="ml-auto font-medium text-fg tabular-nums">{entry.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CardWrapper>
  );
}
