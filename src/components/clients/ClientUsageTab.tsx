import type { Client, Plan } from "../../types";
import { usageBarOf } from "../../lib/api-adapters";
import { getPlanLabel } from "../../lib/display-labels.util";
import { formatNumber } from "../../lib/utils";
import { Card, cx } from "../ui";

export interface ClientUsageTabProps {
  client: Client;
  plan?: Plan;
  className?: string;
}

interface UsageMetric {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
}

/** Thin neutral bar; warning colour over 80%, critical over 95% (docs/design/04-super-admin.md §3.4). */
function barClass(percent: number): string {
  if (percent > 95) return "bg-tone-danger-dot";
  if (percent > 80) return "bg-tone-warning-dot";
  return "bg-fg";
}

export function ClientUsageTab({ client, plan, className }: ClientUsageTabProps) {
  // No plan → no limits to compare against; never invent defaults (UX-23).
  const limits = plan?.limits ?? {
    products: null,
    storageGb: null,
    bandwidthGb: null,
  };

  const allMetrics: UsageMetric[] = [
    {
      key: "products",
      label: "Products",
      used: client.usage.products,
      limit: limits.products,
      unit: "",
    },
    {
      key: "storage",
      label: "Storage",
      used: client.usage.storageGb,
      limit: limits.storageGb,
      unit: "GB",
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      used: client.usage.bandwidthGb,
      limit: limits.bandwidthGb,
      unit: "GB",
    },
  ];
  // A metric with neither a measured value nor a limit (bandwidth today)
  // has nothing to show.
  const metrics = allMetrics.filter(
    (metric) => metric.used !== null || metric.limit !== null,
  );

  return (
    <Card title="Plan usage" description={`Against the ${getPlanLabel(client.plan)} plan limits`} className={className}>
      <div className="flex flex-col gap-4">
        {metrics.map((metric) => {
          const bar = usageBarOf(metric.used, metric.limit);
          const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
          return (
            <div key={metric.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-body">
                <span className="font-medium text-fg">{metric.label}</span>
                <span className="text-fg-muted num">
                  {metric.used === null ? "—" : `${formatNumber(metric.used)}${unitSuffix}`}
                  {" / "}
                  {bar.unlimited ? "No limit" : `${formatNumber(metric.limit ?? 0)}${unitSuffix}`}
                </span>
              </div>
              {bar.percent === null ? null : (
                <div
                  role="progressbar"
                  aria-label={`${metric.label} usage`}
                  aria-valuenow={bar.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div className={cx("h-full rounded-full", barClass(bar.percent))} style={{ width: `${bar.percent}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
