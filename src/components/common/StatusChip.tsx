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

/** Kept for existing call sites. Statuses use the shared StatusChip; plan names are plain text, not badges (spec §10). */
export function StatusChip({ kind, value }: StatusChipProps) {
  if (kind === "plan") {
    return <span className="text-body text-fg">{value}</span>;
  }
  return <SharedStatusChip domain={domainByKind[kind]} status={value} />;
}
