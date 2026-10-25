import { analyticsHealthChip, integrationStatusChip } from "../../lib/analytics-health";
import { Chip } from "../ui";

export interface AnalyticsHealthChipProps {
  /** `OK | ERROR | QUOTA_PAUSED | BACKFILLING | NOT_CONNECTED`, or null without an analytics app. */
  health: string | null | undefined;
  className?: string;
}

/** The one way to show a store's analytics sync health (PRD-012 FR-8.3): same value, same chip everywhere. */
export function AnalyticsHealthChip({ health, className }: AnalyticsHealthChipProps) {
  const info = analyticsHealthChip(health);
  return (
    <Chip tone={info.tone} className={className}>
      {info.label}
    </Chip>
  );
}

export interface IntegrationStatusChipProps {
  /** `ACTIVE | INACTIVE | ERROR` from `channel_connection.status`. */
  status: string | null | undefined;
  className?: string;
}

/** Connection status of any installed app. */
export function IntegrationStatusChip({ status, className }: IntegrationStatusChipProps) {
  const info = integrationStatusChip(status);
  return (
    <Chip tone={info.tone} className={className}>
      {info.label}
    </Chip>
  );
}
