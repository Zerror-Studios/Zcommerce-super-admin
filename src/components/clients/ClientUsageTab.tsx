import { Progress } from "@heroui/react";
import type { Client, Plan } from "../../types";
import { formatNumber } from "../../lib/utils";
import { CardWrapper } from "../ui/CardWrapper";

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

function usageColor(percent: number): "success" | "warning" | "danger" | "primary" {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "primary";
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
    <CardWrapper title="Plan usage" description={<>Resource consumption vs {client.plan} plan limits</>} bodyClassName="p-8 py-6 flex flex-col gap-6">
        {metrics.map((metric) => {
          const percent = Math.min(100, Math.round((metric.used / metric.limit) * 100));
          const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
          return (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-body font-bold">{metric.label}</p>
                  <p className="text-caption text-default-500">
                    {formatNumber(metric.used)}
                    {unitSuffix} of {formatNumber(metric.limit)}
                    {unitSuffix}
                  </p>
                </div>
                <span className="text-body font-medium text-default-600">{percent}%</span>
              </div>
              <Progress
                aria-label={`${metric.label} usage`}
                value={percent}
                color={usageColor(percent)}
                className="max-w-full"
                size="md"
              />
            </div>
          );
        })}
    </CardWrapper>
  );
}
