/**
 * Store detail › Lifecycle (PRD-018 FR-1, FR-2, §6 console)
 *
 * The store's state with its suspension category and reason, the money in
 * flight (FR-1.2), and the actions that fit the state: suspend (category
 * and reason), change the category or reactivate a suspended store,
 * delete (platform owner only; the server keeps the data for the grace
 * period) and restore a deleted store with the purge countdown. With
 * billing:read it lists the store's payments still pending after 48 h
 * (FR-1.8), which matters right after a reactivation. Exports (FR-3) are
 * gated on the legal review and not shown.
 */

import { useState, type ReactNode } from "react";
import { purgeCountdown, suspendCategoryLabel } from "../../lib/tenant-lifecycle.util";
import { storeLifecycle } from "../../lib/storeStatus";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import type { Client } from "../../types";
import { Button as UiButton, Card, Chip, cx, toneTextClasses } from "../ui";
import { StalePendingPayments } from "../payments/StalePendingPayments";
import { MoneyInFlightPanel } from "./MoneyInFlightPanel";
import { StoreActionDialog, type StoreAction } from "./storeActions";

export interface StoreLifecycleCardProps {
  client: Client;
  /** Runs after the store was deleted (leave the detail page). */
  onDeleted: () => void;
}

export function StoreLifecycleCard({ client, onDeleted }: StoreLifecycleCardProps) {
  const { user, can } = useAuth();
  const canReadBilling = can(PLATFORM_PERMISSIONS.BILLING_READ);
  const [action, setAction] = useState<StoreAction | null>(null);
  const isOwner = user?.role === "PLATFORM_OWNER";
  const isDeleted = client.tenantStatus === "DELETED";
  const isSuspended = !isDeleted && client.status === "suspended";
  const lifecycle = storeLifecycle(client);
  const countdown = purgeCountdown(client.purgeAfter);

  return (
    <>
      <Card padding="none">
        <div className="flex flex-col gap-2 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>
            {isSuspended ? <Chip tone="neutral">{suspendCategoryLabel(client.suspendCategory)}</Chip> : null}
          </div>
          {isSuspended ? (
            <p className="text-body text-fg-muted">
              {client.suspendedAt ? `Suspended on ${formatDate(client.suspendedAt)}` : "Suspended"}
              {client.suspendReason ? `: ${client.suspendReason}` : "."}
            </p>
          ) : null}
          {isDeleted && countdown ? (
            <p className={cx("text-body", countdown.expired ? toneTextClasses.danger : "text-fg")}>
              {countdown.expired
                ? `The grace period ended on ${formatDate(client.purgeAfter!)}; the data is being purged.`
                : `Data will be purged on ${formatDate(client.purgeAfter!)} (${countdown.daysLeft} days left).`}
            </p>
          ) : null}
        </div>

        {!isDeleted ? (
          <div className="border-t border-line-subtle px-5 py-4">
            <MoneyInFlightPanel tenantId={client.id} />
          </div>
        ) : null}

        {!isDeleted && canReadBilling ? (
          <div className="border-t border-line-subtle">
            <p className="px-5 pt-4 text-label font-medium text-fg">Payments pending over 48 hours</p>
            <StalePendingPayments tenantId={client.id} />
          </div>
        ) : null}

        {isDeleted ? (
          <LifecycleRow
            title="Restore store"
            description="Bring the store back, suspended at the owner's request, with all its data. Apps need reconnecting."
            action={
              <UiButton
                variant="secondary"
                onPress={() => setAction("restore")}
                isDisabled={!!countdown?.expired}
              >
                Restore store
              </UiButton>
            }
          />
        ) : isSuspended ? (
          <>
            <LifecycleRow
              title="Reactivate store"
              description="Bring the storefront and the owner's dashboard back online."
              action={
                <UiButton variant="secondary" onPress={() => setAction("reactivate")}>
                  Reactivate store
                </UiButton>
              }
            />
            <LifecycleRow
              title="Change category"
              description="Policy blocks store staff; the other categories let them settle orders in a restricted dashboard."
              action={
                <UiButton variant="secondary" onPress={() => setAction("category")}>
                  Change category
                </UiButton>
              }
            />
          </>
        ) : (
          <LifecycleRow
            title="Suspend store"
            description="Take the storefront offline. Payments already started still settle; orders and data are kept."
            action={
              <UiButton variant="destructive" onPress={() => setAction("suspend")}>
                Suspend store
              </UiButton>
            }
          />
        )}

        {!isDeleted ? (
          <LifecycleRow
            title="Delete store"
            description={
              isOwner
                ? "The store goes offline at once. Its data is kept for the grace period, then purged."
                : "Only the platform owner can delete a store."
            }
            action={
              isOwner ? (
                <UiButton variant="destructive" onPress={() => setAction("delete")}>
                  Delete store
                </UiButton>
              ) : null
            }
          />
        ) : null}
      </Card>

      <StoreActionDialog client={client} action={action} onClose={() => setAction(null)} onDeleted={onDeleted} />
    </>
  );
}

function LifecycleRow({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-body font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-body text-fg-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
