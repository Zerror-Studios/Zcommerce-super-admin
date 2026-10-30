/** Plan display helpers shared by the plan cards and the custom plans table (04 S-07d). */
import { PLAN_LABELS } from "../../lib/display-labels.util";
import type { PlatformPlan } from "../../types/platform-api";
import { formatCount, type RowMenuItem } from "../ui";
import { IconArchive, IconEdit, IconExchange } from "../ui/icons";

/** "Unlimited" when there is no limit (a negative value). */
export function limitText(value: number | undefined): string {
  if (value == null) return "—";
  return value < 0 ? "Unlimited" : formatCount(value);
}

export function planTitle(plan: PlatformPlan): string {
  return plan.displayName || PLAN_LABELS[plan.name];
}

export function planActions(
  plan: PlatformPlan,
  on: { edit: (plan: PlatformPlan) => void; migrate: (plan: PlatformPlan) => void; archive: (plan: PlatformPlan) => void },
  { includeEdit }: { includeEdit: boolean },
): RowMenuItem[] {
  const archived = (plan.status ?? "ACTIVE") === "ARCHIVED";
  return [
    ...(includeEdit && !archived ? [{ key: "edit", label: "Edit", icon: IconEdit, onSelect: () => on.edit(plan) }] : []),
    ...((plan.subscriberCount ?? 0) > 0
      ? [{ key: "migrate", label: "Migrate stores", icon: IconExchange, onSelect: () => on.migrate(plan) }]
      : []),
    ...(!archived ? [{ key: "archive", label: "Archive", icon: IconArchive, destructive: true, onSelect: () => on.archive(plan) }] : []),
  ];
}
