import type { Client, Plan } from "../../types";
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
  used: number;
  /** 0 when the plan sets no limit (storage is not on the backend plan yet). */
  limit: number;
  unit: string;
}

/** Thin neutral bar; warning colour over 80%, critical over 95% (docs/design/04-super-admin.md §3.4). */
function barClass(percent: number): string {
  if (percent > 95) return "bg-tone-danger-dot";
  if (percent > 80) return "bg-tone-warning-dot";
  return "bg-fg";
}

export function ClientUsageTab({ client, plan, className }: ClientUsageTabProps) {
  // No plan match (e.g. a custom plan): show usage without a limit, never made-up limits.
  const limits = plan?.limits ?? { products: 0, storageGb: 0, bandwidthGb: 0 };

  // Bandwidth is not measured yet (the adapter always sends 0), so it is left out.
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
  ];

  return (
    <Card title="Plan usage" description={`Against the ${getPlanLabel(client.plan)} plan limits`} className={className}>
      <div className="flex flex-col gap-4">
        {metrics.map((metric) => {
          const hasLimit = metric.limit > 0;
          const percent = hasLimit ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : 0;
          const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
          return (
            <div key={metric.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-body">
                <span className="font-medium text-fg">{metric.label}</span>
                <span className="text-fg-muted num">
                  {formatNumber(metric.used)}
                  {unitSuffix}
                  {hasLimit ? ` / ${formatNumber(metric.limit)}${unitSuffix}` : " · no limit set"}
                </span>
              </div>
              {hasLimit ? (
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
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
