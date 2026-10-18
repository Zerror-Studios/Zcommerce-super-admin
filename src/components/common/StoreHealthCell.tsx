import type { Client } from "../../types";
import { getStoreHealth } from "../../lib/storeHealth";
import { cx } from "../ui/cx";
import { getHealthBand } from "../ui/status-map";
import { toneDotClasses, toneTextClasses } from "../ui/tones";
import { Tooltip } from "../ui/Tooltip";

export interface StoreHealthCellProps {
  client: Client;
}

/**
 * Store health in tables (docs/design/04-super-admin.md §2): 56px thin bar + score + band label
 * (80+ Healthy, 50–79 At risk, <50 Critical). The score still comes from getStoreHealth (unchanged);
 * the factors behind it are in the tooltip.
 */
export function StoreHealthCell({ client }: StoreHealthCellProps) {
  const health = getStoreHealth(client);
  const band = getHealthBand(health.score);
  return (
    <Tooltip content={health.factors.join(" · ")}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
          <span
            className={cx("block h-full rounded-full", toneDotClasses[band.tone])}
            style={{ width: `${health.score}%` }}
          />
        </span>
        <span className={cx("font-medium num", toneTextClasses[band.tone])}>{health.score}</span>
        <span className="text-fg-muted">{band.label}</span>
      </span>
    </Tooltip>
  );
}
