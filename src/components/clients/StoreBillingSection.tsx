/**
 * Store detail › Billing (design v2 board 61-SA-Store-Billing; 04 S-03d), merged with the old Subscription
 * section; also the page a Subscriptions row opens. Two columns:
 * - main: Current plan (Create custom plan and Change plan at its top right), payments, invoices and reminders, why
 *   the store is in its billing state, credits, and Plan limits (usage against the plan) last;
 * - side: Payment status, then Adjust (round 2 §6.3: a list of rows, Cancel subscription set apart in red; Grace
 *   period opens its pop-up from there). Order set by the owner, 2026-11-26.
 */
import type { Client, Subscription } from "../../types";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { Card, IconTime, RowChevron, cx, toneTextClasses, type RowMenuItem } from "../ui";
import { ClientUsageTab } from "./ClientUsageTab";
import { GracePeriodDialog, PaymentStatusCard, useGracePeriodDraft } from "./ClientBillingTab";
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

/** The Adjust row's value: "7 days" set for this store, or "Default · 5 days". */
function gracePeriodSummary(client: Client, defaultGracePeriodDays: number): string {
  const daysText = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  return client.gracePeriodDays != null ? daysText(client.gracePeriodDays) : `Default · ${daysText(defaultGracePeriodDays)}`;
}

/** Main column + 22rem side column once the content is 64rem wide; one column below (§10 detail pages). */
const columnsClass = "grid grid-cols-1 items-start gap-4 @min-[64rem]:grid-cols-[minmax(0,1fr)_22rem]";

/**
 * Adjust (round 2 §6.3): a list of rows (icon, label, ›): Record payment, Issue credit, Record refund, Mark past
 * due (and Extend trial / Activate / Reactivate when they apply), then, set apart, a red text row "Cancel
 * subscription" that opens its sm confirm. A row may show a value on the right (Grace period: "7 days").
 */
function AdjustCard({ actions, values = {} }: { actions: RowMenuItem[]; values?: Record<string, string> }) {
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
          {values[item.key] ? <span className="shrink-0 text-label text-fg-muted">{values[item.key]}</span> : null}
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
  const [graceOpen, setGraceOpen] = useState(false);
  // Grace period sits with the other adjustments (the red Cancel subscription row stays set apart below).
  const adjustActions: RowMenuItem[] = canEditGrace
    ? [...actions, { key: "grace", label: "Grace period", icon: IconTime, onSelect: () => setGraceOpen(true) }]
    : actions;

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
          <StorePaymentsCard client={client} subscription={subscription} lifecycleHref={lifecycleHref} />
          {/* PRD-025 FR-6.3: why the store is in its billing state, since when, and its payment app (below the
              payments, owner 2026-11-26). */}
          <StoreBillingStateCard tenantId={client.id} subscription={subscription} />
          <StoreCreditsCard client={client} />
          {/* Plan limits last in the main column (owner, 2026-11-26). */}
          <ClientUsageTab client={client} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <PaymentStatusCard client={client} subscription={subscription} defaultGracePeriodDays={defaultGracePeriodDays} />
          <AdjustCard actions={adjustActions} values={{ grace: gracePeriodSummary(client, defaultGracePeriodDays) }} />
        </div>
      </div>

      <GracePeriodDialog
        isOpen={graceOpen}
        onClose={() => setGraceOpen(false)}
        draft={grace}
        defaultGracePeriodDays={defaultGracePeriodDays}
        storeName={client.storeName}
      />
    </div>
  );
}
