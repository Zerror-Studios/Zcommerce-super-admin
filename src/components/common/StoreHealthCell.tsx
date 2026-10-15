import type { Client, Subscription } from "../../types";
import { getStoreHealth } from "../../lib/storeHealth";
import { HealthScore } from "../ui/HealthScore";

export interface StoreHealthCellProps {
  client: Client;
  subscription?: Subscription;
}

/**
 * Store health in tables. The score still comes from getStoreHealth (unchanged); the shared HealthScore
 * maps it to the design-system bands (status-mappings §7). The factors stay available in the tooltip.
 */
export function StoreHealthCell({ client, subscription }: StoreHealthCellProps) {
  const health = getStoreHealth(client, subscription);
  return (
    <HealthScore
      score={health.score}
      variant="compact"
      details={health.factors.slice(0, 4).join(" · ")}
    />
  );
}
