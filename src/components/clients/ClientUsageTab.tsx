import type { Client } from "../../types";
import { usageBarOf } from "../../lib/api-adapters";
import { clientPlanLabel } from "../../lib/plan-identity.util";
import { formatDate, formatNumber } from "../../lib/utils";
import { Card, cx } from "../ui";

export interface ClientUsageTabProps {
  client: Client;
  className?: string;
}

interface UsageMetric {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
  /** Shown instead of " / limit" for a figure that has no single plan limit. */
  note?: string;
}

/** Thin neutral bar; warning colour over 80%, critical over 95% (docs/design/04-super-admin.md §3.4). */
function barClass(percent: number): string {
  if (percent > 95) return "bg-tone-danger-dot";
  if (percent > 80) return "bg-tone-warning-dot";
  return "bg-fg";
}

export function ClientUsageTab({ client, className }: ClientUsageTabProps) {
  // PRD-024 FR-1.3 (D-03): the limits of the store's own plan version, never
  // a plan matched by tier name. No plan → no limits; never invent defaults (UX-23).
  const limits = client.planRef?.limits ?? { products: null, staff: null };
  // PRD-024 FR-1.7 (B-03): without a snapshot nothing was measured: "—".
  const measured = client.hasUsage !== false;

  const allMetrics: UsageMetric[] = [
    {
      key: "products",
      label: "Products",
      used: measured ? client.usage.products : null,
      limit: limits.products,
      unit: "",
    },
    // PRD-024 FR-1.12 (P-05): staff accounts against the plan's maximum.
    {
      key: "staff",
      label: "Staff accounts",
      used: measured ? (client.staffCount ?? null) : null,
      limit: limits.staff,
      unit: "",
    },
    // PRD-024 FR-3.7: every channel together; the plan limits are per
    // channel, so there is no single limit to measure it against.
    {
      key: "messages",
      label: "Messages this month",
      used: measured ? (client.messagesThisMonth ?? null) : null,
      limit: null,
      unit: "",
      note: "Email, SMS and WhatsApp",
    },
    // Plans have no storage limit field: the measured size only.
    {
      key: "storage",
      label: "Storage",
      used: measured ? client.usage.storageGb : null,
      limit: null,
      unit: "GB",
    },
  ];
  // A metric with neither a measured value nor a limit (bandwidth today)
  // has nothing to show.
  const metrics = allMetrics.filter(
    (metric) => metric.used !== null || metric.limit !== null,
  );

  const asOf = measured && client.usageAsOf ? ` · as of ${formatDate(client.usageAsOf)}` : "";

  return (
    <Card
      title="Plan usage"
      description={`Against the ${clientPlanLabel(client)} plan limits${asOf}`}
      className={className}
    >
      <div className="flex flex-col gap-4">
        {measured ? null : <p className="text-label text-fg-muted">No usage snapshot yet.</p>}
        {/* PRD-024 FR-2.7: a collector failed, so some figures are the previous snapshot's. */}
        {measured && client.usagePartial ? (
          <p className="text-label text-tone-warning">Some figures carried from the previous snapshot.</p>
        ) : null}
        {metrics.map((metric) => {
          const bar = usageBarOf(metric.used, metric.limit);
          const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
          return (
            <div key={metric.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-body">
                <span className="font-medium text-fg">{metric.label}</span>
                <span className="text-fg-muted num">
                  {metric.used === null ? "—" : `${formatNumber(metric.used)}${unitSuffix}`}
                  {metric.note ? ` · ${metric.note}` : null}
                  {metric.note ? null : " / "}
                  {metric.note ? null : bar.unlimited ? "No limit" : `${formatNumber(metric.limit ?? 0)}${unitSuffix}`}
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
