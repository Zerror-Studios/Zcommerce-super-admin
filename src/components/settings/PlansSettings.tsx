/**
 * Settings › Plans (PRD-017 FR-4.1)
 *
 * Every plan version, global plans first and then custom plans per store,
 * with its status, prices and the server's store counts (`tenantCount`
 * any status, `subscriberCount` non-cancelled, `pendingCount` scheduled to
 * move to it). Reading needs `platform:plans:read`; create, edit, archive
 * and migrate need `platform:plans:manage` and two-step verification (an
 * `MFA_REQUIRED` answer goes to /mfa through the Apollo link).
 */

import { useQuery } from "@apollo/client";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState, type Key } from "react";
import { Link } from "react-router-dom";
import { PLATFORM_PLANS } from "../../graphql/plans";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { groupPlans, PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "../../lib/plan-catalog.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import type { PlatformPlan } from "../../types/platform-api";
import { compactTableClassNames } from "../common/dataTableStyles";
import {
  Card,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  Switch,
  formatMoney,
  menuItemDangerClasses,
} from "../ui";
import { IconMore, IconPlans } from "../ui/icons";
import { PlanEditorModal } from "./PlanEditorModal";
import { ArchivePlanDialog, MigratePlanDialog } from "./PlanLifecycleDialogs";

export interface PlansSettingsProps {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

const columns = [
  { key: "plan", label: "Plan" },
  { key: "version", label: "Version" },
  { key: "status", label: "Status" },
  { key: "listed", label: "Listed" },
  { key: "monthly", label: "Monthly", end: true },
  { key: "yearly", label: "Yearly", end: true },
  { key: "stores", label: "Stores", end: true },
  { key: "subscribers", label: "Subscribers", end: true },
  { key: "pending", label: "Moving in", end: true },
  { key: "actions", label: "", end: true },
];

type PlanAction = "edit" | "migrate" | "archive";

export function PlansSettings({ createOpen, onCreateOpenChange }: PlansSettingsProps) {
  const { can, user } = useAuth();
  const { getClient } = useClients();
  const canRead = can(PLATFORM_PERMISSIONS.PLANS_READ);
  const canManage = can(PLATFORM_PERMISSIONS.PLANS_MANAGE);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [archiving, setArchiving] = useState<PlatformPlan | null>(null);
  const [migrating, setMigrating] = useState<PlatformPlan | null>(null);

  const query = useQuery<{ platformPlans: PlatformPlan[] }>(PLATFORM_PLANS, {
    variables: { includeInactive: true },
    skip: !canRead,
    fetchPolicy: "cache-and-network",
  });
  const plans = useMemo(() => query.data?.platformPlans ?? [], [query.data]);
  const visible = useMemo(
    () => (showArchived ? plans : plans.filter((plan) => plan.status !== "ARCHIVED")),
    [plans, showArchived],
  );
  const groups = useMemo(
    () => groupPlans(visible, (tenantId) => getClient(tenantId)?.storeName ?? "a store"),
    [getClient, visible],
  );

  if (!canRead) {
    return (
      <Card>
        <EmptyState
          icon={IconPlans}
          title="You can't see plans"
          description="Plans need the plans permission. Ask a platform owner."
        />
      </Card>
    );
  }

  const onAction = (plan: PlatformPlan, key: Key) => {
    const action = key as PlanAction;
    if (action === "edit") setEditing(plan);
    else if (action === "migrate") setMigrating(plan);
    else if (action === "archive") setArchiving(plan);
  };

  const renderCell = (plan: PlatformPlan, key: string) => {
    switch (key) {
      case "plan":
        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{plan.displayName || PLAN_LABELS[plan.name]}</p>
            <p className="truncate text-caption text-fg-subtle">{PLAN_LABELS[plan.name]} tier</p>
          </div>
        );
      case "version":
        return <span className="num">v{plan.version ?? 1}</span>;
      case "status": {
        const status = plan.status ?? (plan.isActive ? "ACTIVE" : "ARCHIVED");
        return <Chip tone={PLAN_STATUS_TONES[status]}>{PLAN_STATUS_LABELS[status]}</Chip>;
      }
      case "listed":
        return plan.tenantId ? "Custom" : plan.isPublic === false ? "Hidden" : "Public";
      case "monthly":
        return <span className="num">{formatMoney(plan.price.monthly, { currency: plan.price.currency })}</span>;
      case "yearly":
        return <span className="num">{formatMoney(plan.price.yearly, { currency: plan.price.currency })}</span>;
      case "stores":
        return <span className="num">{plan.tenantCount ?? 0}</span>;
      case "subscribers":
        return <span className="num">{plan.subscriberCount ?? 0}</span>;
      case "pending":
        return <span className="num">{plan.pendingCount ?? 0}</span>;
      case "actions": {
        if (!canManage) return null;
        const status = plan.status ?? "ACTIVE";
        const items = [
          // LEGACY: display fields and AI settings only (PRD-017 D14)
          ...(status !== "ARCHIVED" ? [{ key: "edit", label: "Edit" }] : []),
          ...((plan.subscriberCount ?? 0) > 0 ? [{ key: "migrate", label: "Migrate stores" }] : []),
          ...(status !== "ARCHIVED" ? [{ key: "archive", label: "Archive", danger: true }] : []),
        ];
        if (items.length === 0) return null;
        return (
          <div className="flex justify-end">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label={`Actions for ${plan.displayName || PLAN_LABELS[plan.name]} v${plan.version ?? 1}`} showTooltip={false} size="sm">
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu aria-label="Plan actions" onAction={(key) => onAction(plan, key)}>
                {items.map((item) => (
                  <DropdownItem key={item.key} className={"danger" in item ? menuItemDangerClasses : undefined}>
                    {item.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && user && !user.mfaEnabled ? (
        <p className="rounded-card border border-line bg-surface-muted p-3 text-label text-fg" role="note">
          Changing plans needs two-step verification.{" "}
          <Link to="/mfa" className="font-medium text-brand underline">
            Set it up
          </Link>{" "}
          before you create or edit one.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-fg-muted">
          Prices and limits of a plan in use are locked; editing them creates a new version and the stores on the old
          one keep it until you migrate them.
        </p>
        <Switch isSelected={showArchived} onValueChange={setShowArchived}>
          Show archived
        </Switch>
      </div>

      {query.error && !query.data ? (
        <ErrorState title="Couldn't load the plans." onRetry={() => void query.refetch()} />
      ) : query.loading && !query.data ? (
        <div className="space-y-3" role="status" aria-label="Loading plans">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={IconPlans}
            title="No plans yet"
            description={canManage ? "Create the first one." : "Plans appear here once a platform admin creates them."}
          />
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.key} title={group.title} padding="none" className="overflow-hidden">
            <Table aria-label={group.title} removeWrapper classNames={compactTableClassNames}>
              <TableHeader columns={columns}>
                {(column) => (
                  <TableColumn key={column.key} align={column.end ? "end" : "start"}>
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={group.plans}>
                {(plan) => (
                  <TableRow key={plan.id}>
                    {(columnKey) => <TableCell>{renderCell(plan, String(columnKey))}</TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        ))
      )}

      <PlanEditorModal isOpen={createOpen} onClose={() => onCreateOpenChange(false)} />
      <PlanEditorModal
        isOpen={editing != null}
        plan={editing}
        tenantId={editing?.tenantId ?? null}
        onClose={() => setEditing(null)}
      />
      <ArchivePlanDialog plan={archiving} plans={plans} onClose={() => setArchiving(null)} />
      <MigratePlanDialog plan={migrating} plans={plans} onClose={() => setMigrating(null)} />
    </div>
  );
}
