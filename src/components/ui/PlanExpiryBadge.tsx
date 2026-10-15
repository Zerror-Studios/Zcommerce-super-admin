/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Chip } from "./Chip";
import { IconPlanExpiry } from "./icons";
import { fullDate, getExpiryStatus } from "./status-map";
import type { StatusInfo } from "./status-map";
import { Tooltip } from "./Tooltip";

export interface PlanExpiryBadgeProps {
  expiresAt: Date | string | number | null | undefined;
  /**
   * Use when the backend (or existing data rule) already decides the state, e.g. "Overdue by 3d".
   * The badge then shows this instead of recomputing (status-mappings §6).
   */
  override?: StatusInfo;
  now?: Date;
}

/** Days to plan expiry (component-specs §21): hourglass chip, tooltip with the full date. */
export function PlanExpiryBadge({ expiresAt, override, now }: PlanExpiryBadgeProps) {
  const info = override ?? getExpiryStatus(expiresAt, now);
  const date = expiresAt == null || expiresAt === "" ? null : new Date(expiresAt);
  const chip = (
    <Chip tone={info.tone} dot={false} startIcon={<IconPlanExpiry aria-hidden className="size-3 shrink-0" />}>
      {info.label}
    </Chip>
  );
  if (!date || Number.isNaN(date.getTime())) return chip;
  return (
    <Tooltip content={fullDate.format(date)}>
      <span className="inline-flex">{chip}</span>
    </Tooltip>
  );
}
