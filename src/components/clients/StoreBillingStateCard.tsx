/**
 * Store detail › Billing state (PRD-025 FR-1.1, FR-1.3, FR-4.5, FR-6.3)
 *
 * Why the store is in its billing state and since when
 * (`billingStateReason`, `billingStateSince`), the dunning dates the
 * subscription carries (past due since, orders paused since), the payment
 * app the store takes payments with, and the cancellation reason and note
 * once staff or the merchant cancelled. The state chip is the same rule
 * `ClientPlatformBilling` shows (`billingStateView`).
 */

import type { ReactNode } from "react";

import { useTenantProfile } from "../../hooks/use-tenant-profile";
import { cancelReasonLabel } from "../../lib/billing-reasons.util";
import { billingStateView } from "../../lib/platform-billing.util";
import { billingStateReasonLabel, paymentProviderLabel } from "../../lib/store-profile.util";
import { formatDate } from "../../lib/utils";
import type { Subscription } from "../../types";
import { Card, Chip, ErrorState, Skeleton } from "../ui";

// ─── Component ────────────────────────────────────────────────────────────

export interface StoreBillingStateCardProps {
  tenantId: string;
  subscription?: Subscription;
}

export function StoreBillingStateCard({ tenantId, subscription }: StoreBillingStateCardProps) {
  const read = useTenantProfile(tenantId);
  const tenant = read.tenant;
  const state = billingStateView(subscription, formatDate);
  const reason = billingStateReasonLabel(tenant?.billingStateReason);
  const provider = paymentProviderLabel(tenant?.paymentProvider);
  const cancelReason = cancelReasonLabel(tenant?.subscription?.cancelReason);

  return (
    <Card
      title="Billing state"
      description="Why the store is in this state, and since when."
      actions={<Chip tone={state.tone}>{state.label}</Chip>}
    >
      {read.error && !tenant ? (
        <ErrorState inline title="Couldn't load the billing state." onRetry={() => void read.refetch()} />
      ) : read.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Item label="Reason">{reason ?? <span className="text-fg-subtle">—</span>}</Item>
          <Item label="Since">
            {tenant?.billingStateSince ? formatDate(tenant.billingStateSince) : <span className="text-fg-subtle">—</span>}
          </Item>
          <Item label="Payment app">{provider ?? <span className="text-fg-subtle">Not set</span>}</Item>
          {tenant?.subscription?.pastDueSince ? (
            <Item label="Past due since">{formatDate(tenant.subscription.pastDueSince)}</Item>
          ) : null}
          {tenant?.subscription?.ordersPausedAt ? (
            <Item label="Orders paused since">{formatDate(tenant.subscription.ordersPausedAt)}</Item>
          ) : null}
          {cancelReason ? (
            <Item label="Cancellation">
              <span className="flex flex-col">
                <span>{cancelReason}</span>
                {tenant?.subscription?.cancelNote ? (
                  <span className="text-caption text-fg-muted wrap-anywhere">{tenant.subscription.cancelNote}</span>
                ) : null}
              </span>
            </Item>
          ) : null}
        </dl>
      )}
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-1 text-body text-fg">{children}</dd>
    </div>
  );
}

export default StoreBillingStateCard;
