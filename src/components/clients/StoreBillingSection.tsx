/**
 * Store detail › Billing & plan (04 S-03d), merged with the old Subscription section; also the page a Subscriptions
 * row opens. Cards: Plan and subscription · Payment status | Grace period · Payments, invoices and reminders ·
 * Credits. The grace period stages in the page's one save bar (02 §7.1); leaving with unsaved changes asks first.
 * Every subscription action and the Issue credit / Record refund pop-ups open from the page header.
 */
import type { Client, Subscription } from "../../types";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { SettingsSaveBar } from "../settings/SettingsSaveBar";
import { GracePeriodCard, PaymentStatusCard, useGracePeriodDraft } from "./ClientBillingTab";
import { PlanSubscriptionCard, StoreCreditsCard } from "./ClientPlatformBilling";
import { StorePaymentsCard } from "./StorePaymentsCard";

export interface StoreBillingSectionProps {
  client: Client;
  subscription?: Subscription;
  defaultGracePeriodDays: number;
  onSaveGracePeriod: (days: number | undefined) => Promise<boolean>;
  onCreateCustomPlan: () => void;
  lifecycleHref: string;
}

export function StoreBillingSection({
  client,
  subscription,
  defaultGracePeriodDays,
  onSaveGracePeriod,
  onCreateCustomPlan,
  lifecycleHref,
}: StoreBillingSectionProps) {
  const { can } = useAuth();
  const canEditGrace = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const grace = useGracePeriodDraft({ client, defaultGracePeriodDays, onSaveGracePeriod });

  return (
    <div className="@container flex flex-col gap-4">
      <PlanSubscriptionCard client={client} subscription={subscription} onCreateCustomPlan={onCreateCustomPlan} />

      <div className="grid grid-cols-1 items-stretch gap-4 @min-[40rem]:grid-cols-2">
        <PaymentStatusCard client={client} subscription={subscription} defaultGracePeriodDays={defaultGracePeriodDays} />
        <GracePeriodCard draft={grace} defaultGracePeriodDays={defaultGracePeriodDays} canEdit={canEditGrace} />
      </div>

      <StorePaymentsCard client={client} subscription={subscription} lifecycleHref={lifecycleHref} />

      <StoreCreditsCard client={client} />

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
