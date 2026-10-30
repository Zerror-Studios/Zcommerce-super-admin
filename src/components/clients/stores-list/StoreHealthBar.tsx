import type { Client } from "../../../types";
import { getStoreHealth } from "../../../lib/storeHealth";
import { Tooltip, cx, getHealthBand, toneDotClasses, toneTextClasses } from "../../ui";

/**
 * Health in the Stores table (S-02 change 3): a 40px bar in the band's colour, 8px gap, the score in the band's
 * text colour. The band's word is in the cell's aria-label and the tooltip ("At risk · 53 out of 100").
 */
export function StoreHealthBar({ client }: { client: Client }) {
  const { score } = getStoreHealth(client);
  const band = getHealthBand(score);
  return (
    <Tooltip content={`${band.label} · ${score} out of 100`}>
      <span
        role="img"
        aria-label={`${band.label}, ${score} out of 100`}
        className="inline-flex items-center gap-2 whitespace-nowrap"
      >
        <span aria-hidden className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
          <span className={cx("block h-full rounded-full", toneDotClasses[band.tone])} style={{ width: `${score}%` }} />
        </span>
        <span aria-hidden className={cx("text-body num", toneTextClasses[band.tone])}>
          {score}
        </span>
      </span>
    </Tooltip>
  );
}
