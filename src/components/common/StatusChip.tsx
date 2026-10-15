import { planColor } from "../ui/chart-theme";
import { Chip } from "../ui/Chip";
import { StatusChip as SharedStatusChip } from "../ui/StatusChip";
import type { StatusDomain } from "../ui/status-map";

export interface StatusChipProps {
  kind: "client" | "plan" | "transaction" | "subscription" | "user";
  value: string;
}

/** Super Admin kinds → shared status domains (status-mappings.md). */
const domainByKind: Record<Exclude<StatusChipProps["kind"], "plan">, StatusDomain> = {
  client: "store",
  transaction: "payment",
  subscription: "plan",
  user: "user",
};

/** Kept for existing call sites. Statuses use the shared StatusChip; plan tiers are a neutral chip with the plan color dot. */
export function StatusChip({ kind, value }: StatusChipProps) {
  if (kind === "plan") {
    return (
      <Chip
        tone="neutral"
        startIcon={
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: planColor(value) }}
          />
        }
      >
        {value}
      </Chip>
    );
  }
  return <SharedStatusChip domain={domainByKind[kind]} status={value} />;
}
