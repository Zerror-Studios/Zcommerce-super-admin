/**
 * Store detail › Billing (design v2 board 61-SA-Store-Billing; 04 S-03d), merged with the old Subscription
 * section; also the page a Subscriptions row opens. Two columns:
 * - main: Current plan (with Change plan), why the store is in its billing state, payments, invoices and
 *   reminders, and credits;
 * - side: Plan limits (usage against the plan), Adjust (round 2 §6.3: a list of rows, Cancel subscription set
 *   apart in red), Payment status and the grace period.
 * The grace period stages in the page's one save bar (02 §7.1); leaving with unsaved changes asks first.
 */
import type { Client, Subscription } from "../../types";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { SettingsSaveBar } from "../settings/SettingsSaveBar";
import { Card, RowChevron, cx, toneTextClasses, type RowMenuItem } from "../ui";
import { ClientUsageTab } from "./ClientUsageTab";
import { GracePeriodCard, PaymentStatusCard, useGracePeriodDraft } from "./ClientBillingTab";
import { PlanSubscriptionCard, StoreCreditsCard } from "./ClientPlatformBilling";
import { StoreBillingStateCard } from "./StoreBillingStateCard";
import { StorePaymentsCard } from "./StorePaymentsCard";

export interface StoreBillingSectionProps {
  client: Client;
  subscription?: Subscription;
  defaultGracePeriodDays: number;
  onSaveGracePeriod: (days: number | undefined) => Promise<boolean>;
  onCreateCustomPlan: () => void;
  /** Opens Change plan; only when the role and the subscription allow it. */
  onChangePlan?: () => void;
  /** The subscription and money actions this role may run (Record payment, Issue credit…). */
  actions: RowMenuItem[];
  lifecycleHref: string;
}

/** Main column + 22rem side column once the content is 64rem wide; one column below (§10 detail pages). */
const columnsClass = "grid grid-cols-1 items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_22rem]";

/**
 * Adjust (round 2 §6.3): a list of rows (icon, label, ›): Record payment, Issue credit, Record refund, Mark past
 * due (and Extend trial / Activate / Reactivate when they apply), then, set apart, a red text row "Cancel
 * subscription" that opens its sm confirm.
 */
function AdjustCard({ actions }: { actions: RowMenuItem[] }) {
  if (!actions.length) return null;
  const safe = actions.filter((item) => !item.destructive);
  const risky = actions.filter((item) => item.destructive);
  const row = (item: RowMenuItem, danger = false) => {
    const Icon = item.icon;
    return (
      <li key={item.key}>
        <button
          type="button"
          disabled={item.disabled}
          onClick={() => item.onSelect?.()}
          className={cx(
            "flex min-h-12 w-full items-center gap-3 px-5 text-left text-body outline-none transition-colors duration-fast",
            "hover:bg-row-hover focus-visible:bg-row-hover disabled:pointer-events-none disabled:opacity-40",
            danger ? toneTextClasses.danger : "text-fg",
          )}
        >
          {Icon && !danger ? (
            <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-fg-muted">
              <Icon aria-hidden />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {danger ? null : <RowChevron />}
        </button>
      </li>
    );
  };
  return (
    <Card title="Adjust" padding="none">
      {safe.length ? <ul className="divide-y divide-line-subtle border-t border-line-subtle">{safe.map((item) => row(item))}</ul> : null}
      {risky.length ? (
        <ul className="mt-2 border-t border-line pb-1">{risky.map((item) => row(item, true))}</ul>
      ) : (
        <div className="pb-1" />
      )}
    </Card>
  );
}

export function StoreBillingSection({
  client,
  subscription,
  defaultGracePeriodDays,
  onSaveGracePeriod,
  onCreateCustomPlan,
  onChangePlan,
  actions,
  lifecycleHref,
}: StoreBillingSectionProps) {
  const { can } = useAuth();
  const canEditGrace = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const grace = useGracePeriodDraft({ client, defaultGracePeriodDays, onSaveGracePeriod });

  return (
    <div className="@container">
      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-4">
          <PlanSubscriptionCard
            client={client}
            subscription={subscription}
            onCreateCustomPlan={onCreateCustomPlan}
            onChangePlan={onChangePlan}
          />
          {/* PRD-025 FR-6.3: why the store is in its billing state, since when, and its payment app. */}
          <StoreBillingStateCard tenantId={client.id} subscription={subscription} />
          <StorePaymentsCard client={client} subscription={subscription} lifecycleHref={lifecycleHref} />
          <StoreCreditsCard client={client} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ClientUsageTab client={client} />
          <AdjustCard actions={actions} />
          <PaymentStatusCard client={client} subscription={subscription} defaultGracePeriodDays={defaultGracePeriodDays} />
          <GracePeriodCard draft={grace} defaultGracePeriodDays={defaultGracePeriodDays} canEdit={canEditGrace} />
        </div>
      </div>

      <SettingsSaveBar
        isDirty={grace.isDirty}
        isSaving={grace.isSaving}
        errorCount={grace.error ? 1 : 0}
        onSave={() => void grace.save()}
        onDiscard={grace.discard}
      />
    </div>
  );
}
