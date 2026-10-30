/**
 * Settings › Plans & pricing (04 S-07d, PRD-017 FR-4.1, PRD-016 FR-14)
 *
 * Plan limits (the entitlement mode, staged in the save bar; becoming Enforce asks first), the global plans as
 * cards, and custom plans per store as a table. Store counts come from the server (`tenantCount` any status,
 * `subscriberCount` non-cancelled, `pendingCount` scheduled to move in). Reading needs `platform:plans:read`;
 * create, edit, archive and migrate need `platform:plans:manage` and two-step verification (an `MFA_REQUIRED`
 * answer goes to /mfa through the Apollo link). A plan in use is locked: editing makes a new version.
 */

import { useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PLATFORM_PLANS } from "../../graphql/plans";
import { PLAN_LABELS } from "../../lib/display-labels.util";
import { billingFailureCopy } from "../../lib/mutation-errors";
import { ENTITLEMENTS_MODE_COPY } from "../../lib/platform-billing.util";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { PLAN_STATUS_LABELS } from "../../lib/plan-catalog.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { usePlatformSettings } from "../../providers/SettingsProvider";
import { entitlementsModeEnum, type EntitlementsMode, type PlatformPlan } from "../../types/platform-api";
import { ConfirmModal } from "../common/ConfirmModal";
import {
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  Switch,
  formatMoney,
  toastError,
  type DataTableColumn,
} from "../ui";
import { IconAdd, IconPlans } from "../ui/icons";
import { PlanCard } from "./PlanCard";
import { planActions, planTitle } from "./plan-card.util";
import { PlanEditorModal } from "./PlanEditorModal";
import { ArchivePlanDialog, MigratePlanDialog } from "./PlanLifecycleDialogs";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { TableCardHeader } from "./TableCardHeader";

const MODES = Object.values(entitlementsModeEnum);
/** Cards at least 260px: 2 a row in the 684px column, 3 when wider (04 S-07d). */
const PLAN_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(16.25rem,100%),1fr))] gap-4";
const MODE_TONES = { OFF: "neutral", LOG: "info", ENFORCE: "success" } as const;

/** Fixed 466 → Plan 218px in the 684px column (04 S-07d change 3). */
const CUSTOM_COLUMNS: DataTableColumn[] = [
  { key: "plan", label: "Plan" },
  { key: "store", label: "Store", width: 150 },
  { key: "version", label: "Version", width: 70 },
  { key: "monthly", label: "Monthly", width: 110 },
  { key: "stores", label: "Stores", width: 80 },
];

export function PlansSettings() {
  const { can, user } = useAuth();
  const { getClient } = useClients();
  const canRead = can(PLATFORM_PERMISSIONS.PLANS_READ);
  const canManage = can(PLATFORM_PERMISSIONS.PLANS_MANAGE);
  const [createOpen, setCreateOpen] = useState(false);
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
  const globalPlans = useMemo(
    () => visible.filter((plan) => !plan.tenantId).sort((a, b) => tierOrder(a) - tierOrder(b) || (b.version ?? 1) - (a.version ?? 1)),
    [visible],
  );
  const customPlans = useMemo(() => visible.filter((plan) => !!plan.tenantId), [visible]);
  const storeName = (tenantId: string) => getClient(tenantId)?.storeName ?? "A store";
  const handlers = { edit: setEditing, migrate: setMigrating, archive: setArchiving };
  const limits = usePlanLimitsDraft();

  const createButton = canManage ? (
    <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
      Create plan
    </Button>
  ) : undefined;

  return (
    <div>
      <SettingsSectionHeader section="plans" actions={createButton} />
      <div className="flex flex-col gap-4">
        <PlanLimitsCard limits={limits} />

        {!canRead ? (
          <Card>
            <EmptyState icon={IconPlans} title="You can't see plans" description="Plans need the plans permission. Ask a platform owner." />
          </Card>
        ) : (
          <>
            {canManage && user && !user.mfaEnabled ? (
              <p className="rounded-2xl border border-line bg-surface-muted p-3 text-label text-fg" role="note">
                Changing plans needs two-step verification.{" "}
                <Link to="/mfa" className="font-medium text-brand underline">
                  Set it up
                </Link>{" "}
                before you create or edit one.
              </p>
            ) : null}

            <section id="plans-on-sale" data-settings-field aria-labelledby="plans-on-sale-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="plans-on-sale-title" className="text-title-3 text-fg">
                    Plans on sale
                  </h3>
                  <p className="mt-0.5 text-label text-fg-muted">
                    A plan in use is locked; editing it makes a new version, and its stores keep the old one until you migrate them.
                  </p>
                </div>
                <Switch size="sm" isSelected={showArchived} onValueChange={setShowArchived}>
                  Show archived
                </Switch>
              </div>

              {query.error && !query.data ? (
                <ErrorState title="Couldn't load the plans." onRetry={() => void query.refetch()} />
              ) : query.loading && !query.data ? (
                <div className={PLAN_GRID} role="status" aria-label="Loading plans">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-96 w-full rounded-2xl" />
                  ))}
                </div>
              ) : globalPlans.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={IconPlans}
                    title="No plans yet"
                    description="Create the plans stores can buy."
                    action={
                      canManage ? (
                        <Button variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => setCreateOpen(true)}>
                          Create plan
                        </Button>
                      ) : undefined
                    }
                  />
                </Card>
              ) : (
                <div className={PLAN_GRID}>
                  {globalPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      canManage={canManage}
                      onEdit={setEditing}
                      onMigrate={setMigrating}
                      onArchive={setArchiving}
                    />
                  ))}
                </div>
              )}
            </section>

            {customPlans.length > 0 ? (
              <div id="custom-plans" data-settings-field>
                <DataTable
                  aria-label="Custom plans"
                  toolbar={<TableCardHeader title="Custom plans" description="Plans made for one store." />}
                  columns={CUSTOM_COLUMNS}
                  rows={customPlans}
                  getRowKey={(plan) => plan.id}
                  rowHeight="tall"
                  rowActions={canManage ? (plan) => planActions(plan, handlers, { includeEdit: true }) : undefined}
                  rowActionsLabel={(plan) => `Actions for ${planTitle(plan)} v${plan.version ?? 1}`}
                  renderCell={(plan, key) => {
                    switch (key) {
                      case "plan": {
                        const status = plan.status ?? (plan.isActive ? "ACTIVE" : "ARCHIVED");
                        return (
                          <div className="min-w-0">
                            <p className="truncate text-body font-medium text-fg">{planTitle(plan)}</p>
                            <p className="truncate text-label text-fg-muted">
                              {PLAN_LABELS[plan.name]} tier · {PLAN_STATUS_LABELS[status]}
                            </p>
                          </div>
                        );
                      }
                      case "store":
                        return <span className="block truncate">{plan.tenantId ? storeName(plan.tenantId) : "—"}</span>;
                      case "version":
                        return <span className="num">v{plan.version ?? 1}</span>;
                      case "monthly":
                        return <span className="num">{formatMoney(plan.price.monthly, { currency: plan.price.currency })}</span>;
                      case "stores":
                        return <span className="num">{plan.tenantCount ?? 0}</span>;
                      default:
                        return null;
                    }
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {limits.readOnly ? null : (
        <SettingsSaveBar
          isDirty={limits.mode !== limits.saved}
          onDiscard={() => limits.setMode(limits.saved)}
          onSave={limits.save}
          isSaving={limits.busy}
          dirtyCount={1}
        />
      )}
      <ConfirmModal
        isOpen={limits.confirming}
        onClose={() => limits.setConfirming(false)}
        onConfirm={() => void limits.commit()}
        title="Enforce plan limits?"
        description="Stores over a limit will be blocked from adding more."
        confirmLabel="Enforce limits"
        confirmColor="primary"
      />

      <PlanEditorModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <PlanEditorModal isOpen={editing != null} plan={editing} tenantId={editing?.tenantId ?? null} onClose={() => setEditing(null)} />
      <ArchivePlanDialog plan={archiving} plans={plans} onClose={() => setArchiving(null)} />
      <MigratePlanDialog plan={migrating} plans={plans} onClose={() => setMigrating(null)} />
    </div>
  );
}

const TIERS = Object.keys(PLAN_LABELS);
const tierOrder = (plan: PlatformPlan) => TIERS.indexOf(plan.name);

/**
 * Plan limits (moved from billing rules, 04 S-07d change 2): Off · Log only · Enforce as a radio group, staged
 * in the page's save bar. Saving Enforce asks first. The server writes the before and after to the audit log.
 */
function usePlanLimitsDraft() {
  const { settings, loading, updateSettingsPatch } = usePlatformSettings();
  const { can } = useAuth();
  const readOnly = !can(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  const saved: EntitlementsMode = settings.entitlementsMode ?? "LOG";
  const [mode, setMode] = useState<EntitlementsMode>(saved);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(saved);
  }, [saved]);

  const commit = async () => {
    setBusy(true);
    try {
      await updateSettingsPatch({ entitlementsMode: mode });
      addToast({ title: `Plan limits: ${ENTITLEMENTS_MODE_COPY[mode].label}.` });
    } catch (error) {
      const message = billingFailureCopy(error);
      if (message) toastError(message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const save = () => {
    if (mode === "ENFORCE") setConfirming(true);
    else void commit();
  };

  return { saved, mode, setMode, readOnly, disabled: readOnly || loading || busy, busy, confirming, setConfirming, save, commit };
}

function PlanLimitsCard({ limits }: { limits: ReturnType<typeof usePlanLimitsDraft> }) {
  const { saved, mode, setMode, disabled } = limits;
  return (
    <Card
      id="plan-limits"
      data-settings-field
      title="Plan limits"
      description="Whether stores are held to their plan's limits (products, staff, messages, sales channels)."
      actions={<Chip tone={MODE_TONES[saved]}>{ENTITLEMENTS_MODE_COPY[saved].label}</Chip>}
    >
      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-fg">Mode</span>
        <div className={disabled ? "pointer-events-none opacity-60" : undefined} aria-disabled={disabled || undefined}>
          <SegmentedControl<EntitlementsMode>
            aria-label="Plan limits mode"
            options={MODES.map((key) => ({ value: key, label: ENTITLEMENTS_MODE_COPY[key].label }))}
            value={mode}
            onChange={setMode}
          />
        </div>
        <p className="text-caption text-fg-muted">
          Start with Log only, check a week of would-block counts against each store's plan, then enforce.
        </p>
      </div>
    </Card>
  );
}
