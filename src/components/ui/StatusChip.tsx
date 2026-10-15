/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Chip } from "./Chip";
import type { ChipProps } from "./Chip";
import { getStatus } from "./status-map";
import type { StatusDomain } from "./status-map";

export interface StatusChipProps extends Omit<ChipProps, "tone" | "children"> {
  domain: StatusDomain;
  status: unknown;
  /** Override the mapped label (keep the mapped tone). */
  label?: string;
}

/** The only way to render a status (status-mappings §8): same status → same tone in both products. */
export function StatusChip({ domain, status, label, ...rest }: StatusChipProps) {
  const info = getStatus(domain, status);
  return (
    <Chip tone={info.tone} {...rest}>
      {label ?? info.label}
    </Chip>
  );
}
