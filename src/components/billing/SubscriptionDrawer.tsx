/**
 * Subscriptions › a row opened in a side drawer (owner, 2026-11-26: a click stays on the list instead of going to the
 * store page). The same billing cards the store's Billing tab shows, read from the same queries (Apollo shares them):
 * Current plan, Payment status, then Payments, invoices and reminders. The header carries the payment badge and the
 * row's ⋯ (Send reminder, Record payment, Change plan, Log in to store, Cancel subscription); the arrows step through
 * the rows on the page. "Open store" in the footer is there for everything else (team, apps, settings).
 */
import type { SubscriptionRow } from "./subscription-rows";
import { PaymentStatusCard } from "../clients/ClientBillingTab";
import { PlanSubscriptionCard } from "../clients/ClientPlatformBilling";
import { StorePaymentsCard } from "../clients/StorePaymentsCard";
import { ButtonLink, Chip, Drawer, EmptyState, RowMenu, type RowMenuItem } from "../ui";
import { IconStore } from "../ui/icons";

export interface SubscriptionDrawerProps {
  row: SubscriptionRow | null;
  onClose: () => void;
  /** The row's actions (the table's ⋯ without "View subscription"). */
  actions: RowMenuItem[];
  defaultGracePeriodDays: number;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

export function SubscriptionDrawer({
  row,
  onClose,
  actions,
  defaultGracePeriodDays,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: SubscriptionDrawerProps) {
  const client = row?.client;
  const storeHref = row ? `/stores/${row.id}/billing?from=subscriptions` : "/stores";

  return (
    <Drawer
      isOpen={!!row}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={row?.report.storeName ?? "Subscription"}
      subtitle={client?.ownerEmail && client.ownerEmail.includes("@") ? client.ownerEmail : undefined}
      headerActions={
        row ? (
          <span className="flex items-center gap-2">
            <Chip tone={row.payment.tone}>{row.payment.label}</Chip>
            {actions.length ? <RowMenu items={actions} label={`Actions for ${row.report.storeName}`} /> : null}
          </span>
        ) : null
      }
      onPrev={onPrev}
      onNext={onNext}
      prevDisabled={prevDisabled}
      nextDisabled={nextDisabled}
      footer={
        row ? (
          <div className="flex justify-end">
            <ButtonLink variant="secondary" to={storeHref}>
              Open store
            </ButtonLink>
          </div>
        ) : null
      }
    >
      {row && client ? (
        <div className="flex flex-col gap-4">
          <PlanSubscriptionCard client={client} subscription={row.subscription} />
          <PaymentStatusCard client={client} subscription={row.subscription} defaultGracePeriodDays={defaultGracePeriodDays} />
          <StorePaymentsCard client={client} subscription={row.subscription} lifecycleHref={`/stores/${row.id}/settings#lifecycle`} />
        </div>
      ) : row ? (
        <EmptyState icon={IconStore} title="This store isn't loaded" description="Open the store to see its billing." />
      ) : null}
    </Drawer>
  );
}
