/**
 * Store detail › Billing (design v2 board 61-SA-Store-Billing; 04 S-03d), merged with the old Subscription
 * section; also the page a Subscriptions row opens. Two columns:
 * - main: Current plan (with Change plan), why the store is in its billing state, payments, invoices and
 *   reminders, and credits;
 * - side: Plan limits (usage against the plan), Adjust (every subscription action, Issue credit and Record
 *   refund, which used to sit in the header ⋯), Payment status and the grace period.
 * The grace period stages in the page's one save bar (02 §7.1); leaving with unsaved changes asks first.
 */
import type { Client, Subscription } from "../../types";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { SettingsSaveBar } from "../settings/SettingsSaveBar";
import { Button, Card, type RowMenuItem } from "../ui";
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

/** Board 61 "Adjust": one full-width light-blue button per action; the destructive ones in red text. */
function AdjustCard({ actions }: { actions: RowMenuItem[] }) {
  if (!actions.length) return null;
  return (
    <Card title="Adjust">
      <div className="flex flex-col gap-2">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              variant={item.destructive ? "destructive-secondary" : "secondary"}
              size="sm"
              className="w-full justify-start"
              startIcon={Icon ? <Icon aria-hidden /> : undefined}
              isDisabled={item.disabled}
              onPress={() => item.onSelect?.()}
            >
              {item.label}
            </Button>
          );
        })}
      </div>
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
