import type { Client, Plan } from "../../types";
import { formatNumber } from "../../lib/utils";
import { Card, cx } from "../ui";

export interface ClientUsageTabProps {
  client: Client;
  plan?: Plan;
}

interface UsageMetric {
  key: string;
  label: string;
  used: number;
  limit: number;
  unit: string;
}

/** Thin neutral bar; warning colour over 80%, critical over 95% (docs/design/04-super-admin.md §3.4). */
function barClass(percent: number): string {
  if (percent > 95) return "bg-tone-danger-dot";
  if (percent > 80) return "bg-tone-warning-dot";
  return "bg-fg";
}

export function ClientUsageTab({ client, plan }: ClientUsageTabProps) {
  const limits = plan?.limits ?? {
    products: 25,
    storageGb: 1,
    bandwidthGb: 10,
  };

  const metrics: UsageMetric[] = [
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

  return (
    <Card title="Plan usage" description={`Against the ${client.plan} plan limits`}>
      <div className="flex flex-col gap-4">
        {metrics.map((metric) => {
          const percent = Math.min(100, Math.round((metric.used / metric.limit) * 100));
          const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
          return (
            <div key={metric.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-body">
                <span className="font-medium text-fg">{metric.label}</span>
                <span className="text-fg-muted num">
                  {formatNumber(metric.used)}
                  {unitSuffix} / {formatNumber(metric.limit)}
                  {unitSuffix}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${metric.label} usage`}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
              >
                <div className={cx("h-full rounded-full", barClass(percent))} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
