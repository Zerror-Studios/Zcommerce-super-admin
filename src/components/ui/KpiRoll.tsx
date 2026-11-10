/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * KPI number roll-in (round 3 D2): the digits rise from 8px below with a fade, 400ms, the first time the number
 * shows in this page visit (`rollKey`). No counting up through every value; a later value change just swaps the
 * text. Without a key it rolls on every mount. Reduced motion: no roll (styles/chart-motion.css).
 */
import type { ReactNode } from "react";

import { cx } from "./cx";
import { useEntranceOnce } from "./use-chart-entrance";

export function KpiRoll({ rollKey, children, className }: { rollKey?: string; children: ReactNode; className?: string }) {
  const first = useEntranceOnce(rollKey ?? "");
  const roll = rollKey ? first : true;
  return (
    <span className={cx("zc-kpi-roll", className)} data-static={roll ? undefined : "true"}>
      {children}
    </span>
  );
}
