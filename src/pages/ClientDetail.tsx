import { useMutation, useQuery } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useMemo, useState, type Key, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClientAiCard } from "../components/clients/ClientAiCard";
import { ClientAnalyticsCard } from "../components/clients/ClientAnalyticsCard";
import { ClientBillingTab } from "../components/clients/ClientBillingTab";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { ClientPlatformBilling } from "../components/clients/ClientPlatformBilling";
import { ClientUsageHistory } from "../components/clients/ClientUsageHistory";
import { OnboardingCard } from "../components/clients/OnboardingCard";
import { StoreDetailsCard } from "../components/clients/StoreDetailsCard";
import { StoreGoLiveCard } from "../components/clients/StoreGoLiveCard";
import { StoreLifecycleCard } from "../components/clients/StoreLifecycleCard";
import { SubscriptionActions } from "../components/clients/SubscriptionActions";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore } from "../components/clients/storeLogin";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { PageHeader } from "../components/common/PageHeader";
import { PLATFORM_TENANT, RESEND_OWNER_INVITE } from "../graphql/tenants";
import { subscriptionsOf, toClient } from "../lib/api-adapters";
import { findLatestSubscription } from "../lib/subscription-lookup.util";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { paymentState, storeLifecycle } from "../lib/storeStatus";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformSettings } from "../providers/SettingsProvider";
import { toasts } from "../copy";
import type { PlatformTenant } from "../types/platform-api";
import { IconLogin, IconMore, IconStore } from "../components/ui/icons";
import {
  Button as UiButton,
  Card,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  menuItemDangerClasses,
  toastError,
} from "../components/ui";

/** One titled block on the store page. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-subtitle font-semibold text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Store detail (docs/design/04-super-admin.md §3.4, header C): one page, no tabs (owner's request 2026-10-16),
 * laid out as the two-column editor (08 §2.14). The main column has Overview, Analytics, AI, Usage history,
 * Billing, Subscription, Store details (PRD-017 FR-4.5), Go live and Lifecycle (PRD-018 §6: its "tabs" are
 * sections here, keeping the one-page layout). Activity is left out: there is no per-store activity data yet.
 */
export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, updateClient, plans, subscriptions, loading, error, refetch } = useClients();
  // Read through the provider so the page re-renders when the server settings arrive.
  const { settings } = usePlatformSettings();
  const { can, user } = useAuth();
  const [action, setAction] = useState<StoreAction | null>(null);
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [resendOwnerInvite] = useMutation<{ resendOwnerInvite: boolean }>(RESEND_OWNER_INVITE);
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);
  const canReadAi = can(PLATFORM_PERMISSIONS.AI_READ);

  const listedClient = id ? getClient(id) : undefined;
  // PRD-014 FE-09: a store that isn't in the loaded list (a deep link while
  // later pages load) is read on its own; NOT_FOUND means it doesn't exist.
  const single = useQuery<{ platformTenant: PlatformTenant }>(PLATFORM_TENANT, {
    variables: { id },
    skip: !id || !!listedClient || loading,
  });
  const fetchedTenant = listedClient ? undefined : single.data?.platformTenant;
  const client = useMemo(
    () => listedClient ?? (fetchedTenant ? toClient(fetchedTenant) : undefined),
    [fetchedTenant, listedClient],
  );
  const defaultGracePeriodDays = settings.gracePeriodDays;

  const plan = useMemo(
    () => (client ? plans.find((p) => p.name === client.plan) : undefined),
    [client, plans],
  );

  const subscription = useMemo(() => {
    if (!client) return undefined;
    const source = fetchedTenant ? subscriptionsOf([fetchedTenant]) : subscriptions;
    return findLatestSubscription(source, client.id);
  }, [client, fetchedTenant, subscriptions]);

  if (!id) {
    return <Navigate to="/stores" replace />;
  }

  // Deep links land here before `platformTenants` has answered: wait, don't say "not found".
  if (!client && (loading || single.loading)) {
    return (
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Loading store…" />
      </div>
    );
  }

  // The list failed to load: say so, don't claim the store doesn't exist.
  if (!client && error) {
    return (
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Store" />
        <ErrorState title="Couldn't load the store." description={toasts.genericError} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader type="detail" back={{ href: "/stores", label: "Stores" }} title="Store not found" />
        <Card>
          <EmptyState
            icon={IconStore}
            title="This store doesn't exist"
            description="It may have been deleted, or the link may be broken."
            action={
              <UiButton variant="secondary" onPress={() => navigate("/stores")}>
                Go to stores
              </UiButton>
            }
          />
        </Card>
      </div>
    );
  }

  const lifecycle = storeLifecycle(client);
  const payment = paymentState(subscription);
  const isDeleted = client.tenantStatus === "DELETED";
  const isSuspended = !isDeleted && client.status === "suspended";
  // Q10 / PRD-018 FR-2.1: only the platform owner deletes a store.
  const isOwner = user?.role === "PLATFORM_OWNER";

  // The save is fire-and-forget for the form; a failure still has to be seen (review C-L6).
  const onSaveGracePeriod = (days: number | undefined) =>
    updateClient(client.id, { gracePeriodDays: days }).catch((error: unknown) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });

  const onMenuAction = (key: Key) => {
    if (
      key === "suspend" ||
      key === "reactivate" ||
      key === "delete" ||
      key === "restore" ||
      key === "category"
    ) {
      setAction(key);
    } else if (key === "resend-invite") setConfirmInvite(true);
  };

  // PRD-014 PLT-07: a fresh set-password email for the owner (tenants:manage).
  const sendOwnerInvite = async () => {
    try {
      await resendOwnerInvite({ variables: { tenantId: client.id } });
      addToast({ title: `Invite sent to ${client.ownerEmail}.` });
    } catch (error) {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    }
  };

  return (
    <div>
      <PageHeader
        type="detail"
        sticky
        back={{ href: "/stores", label: "Stores" }}
        title={<span className="wrap-anywhere">{client.storeName}</span>}
        badges={
          <>
            <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>
            <Chip tone={payment.tone}>{payment.label}</Chip>
          </>
        }
        description={
          <span className="wrap-anywhere">
            {`${client.ownerName} · ${client.ownerEmail}`}
            {client.domain ? (
              <>
                {" · "}
                <a
                  href={`https://${client.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  {client.domain}
                </a>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            {canManage ? (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <IconButton aria-label="More actions" showTooltip={false}>
                  <IconMore aria-hidden className="size-4" />
                </IconButton>
              </DropdownTrigger>
              <DropdownMenu aria-label={`Actions for ${client.storeName}`} onAction={onMenuAction}>
                {isDeleted ? (
                  <DropdownSection aria-label="Store">
                    <DropdownItem key="restore">Restore store</DropdownItem>
                  </DropdownSection>
                ) : (
                  <>
                    <DropdownSection showDivider aria-label="Store">
                      <DropdownItem key={isSuspended ? "reactivate" : "suspend"}>
                        {isSuspended ? "Reactivate store" : "Suspend store"}
                      </DropdownItem>
                      {isSuspended ? <DropdownItem key="category">Change suspension category</DropdownItem> : null}
                    </DropdownSection>
                    <DropdownSection showDivider={isOwner} aria-label="Owner">
                      <DropdownItem key="resend-invite">Resend owner invite</DropdownItem>
                    </DropdownSection>
                    {isOwner ? (
                      <DropdownSection aria-label="Danger">
                        <DropdownItem key="delete" className={menuItemDangerClasses}>
                          Delete store
                        </DropdownItem>
                      </DropdownSection>
                    ) : null}
                  </>
                )}
              </DropdownMenu>
            </Dropdown>
            ) : null}
            {canImpersonate && !isDeleted ? (
              <UiButton variant="primary" startIcon={<IconLogin aria-hidden />} onPress={() => void logInToStore(client)}>
                Log in
              </UiButton>
            ) : null}
          </>
        }
      />

      {/* Two-column editor (docs/design/08-fixes-and-screens.md §2.14): the work on the left, the facts and
          the per-store controls in a rail on the right; Lifecycle (suspend, delete, restore) is last in the main
          column (owner, 2026-10-26). One page, no tabs. The rail scrolls
          with the page (owner, 2026-10-26: one scrollbar, not a second one inside the rail). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <OnboardingCard client={client} />
          <ClientOverviewTab part="main" client={client} subscription={subscription} plan={plan} />

          {/* PRD-012 FR-8.3: analytics health and data-through from the master sync summary. */}
          <Section id="store-analytics" title="Analytics">
            <ClientAnalyticsCard client={client} />
          </Section>

          {/* PRD-021 FR-6.4: AI pause, limit overrides, top-ups and most-asked questions. */}
          {canReadAi ? (
            <Section id="store-ai" title="AI">
              <ClientAiCard client={client} />
            </Section>
          ) : null}

          {/* PRD-014 PLT-13: the daily usage snapshots, one row per month. */}
          <Section id="store-usage-history" title="Usage history">
            <ClientUsageHistory tenantId={client.id} />
          </Section>

          <Section id="store-billing" title="Billing">
            {/* PRD-016 FR-26, PRD-017 FR-4.2: billing state, invoices, credits. */}
            <div className="mb-4">
              <ClientPlatformBilling client={client} subscription={subscription} />
            </div>
            <ClientBillingTab
              part="main"
              client={client}
              subscription={subscription}
              defaultGracePeriodDays={defaultGracePeriodDays}
              onSaveGracePeriod={onSaveGracePeriod}
              canEdit={canManage}
            />
          </Section>
          {canManageBilling ? (
            <Section id="store-subscription" title="Subscription">
              <SubscriptionActions client={client} subscription={subscription} plans={plans} />
            </Section>
          ) : null}

          {/* PRD-017 FR-4.5: name, contacts, GSTIN, timezone, currency; the domain via Go live. */}
          <Section id="store-details" title="Store details">
            <StoreDetailsCard client={client} goLiveAnchor="store-go-live" />
          </Section>

          {/* PRD-018 FR-4: domain verification and the go-live checklist. */}
          {!isDeleted ? (
            <Section id="store-go-live" title="Go live">
              <StoreGoLiveCard client={client} />
            </Section>
          ) : null}

          {/* PRD-018 FR-1, FR-2: suspension with a category, money in flight, delete, restore. */}
          {canManage ? (
            <Section id="store-lifecycle" title="Lifecycle">
              <StoreLifecycleCard client={client} onDeleted={() => navigate("/stores")} />
            </Section>
          ) : null}
        </div>

        <aside
          aria-label="Store details"
          className="flex min-w-0 flex-col gap-4 lg:self-start"
        >
          <ClientOverviewTab part="rail" client={client} subscription={subscription} plan={plan} />
          <ClientBillingTab
            part="rail"
            client={client}
            subscription={subscription}
            defaultGracePeriodDays={defaultGracePeriodDays}
            onSaveGracePeriod={onSaveGracePeriod}
            canEdit={canManage}
          />
        </aside>
      </div>

      <ConfirmModal
        isOpen={confirmInvite}
        onClose={() => setConfirmInvite(false)}
        onConfirm={() => void sendOwnerInvite()}
        title="Resend the owner invite?"
        description={`We'll email ${client.ownerEmail} a new link to set the password for ${client.storeName}.`}
        confirmLabel="Send invite"
        confirmColor="primary"
      />

      <StoreActionDialog
        client={client}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() => navigate("/stores")}
      />
    </div>
  );
}
