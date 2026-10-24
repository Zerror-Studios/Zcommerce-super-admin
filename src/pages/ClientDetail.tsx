import { useMemo, useState, type Key, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClientBillingTab } from "../components/clients/ClientBillingTab";
import { ClientDangerZone } from "../components/clients/ClientDangerZone";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { OnboardingCard } from "../components/clients/OnboardingCard";
import { SubscriptionActions } from "../components/clients/SubscriptionActions";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore } from "../components/clients/storeLogin";
import { PageHeader } from "../components/common/PageHeader";
import { findLatestSubscription } from "../lib/subscription-lookup.util";
import { mutationFailureCopy } from "../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../lib/permissions";
import { paymentState, storeLifecycle } from "../lib/storeStatus";
import { useAuth } from "../providers/AuthProvider";
import { useClients } from "../providers/ClientsProvider";
import { usePlatformSettings } from "../providers/SettingsProvider";
import { toasts } from "../copy";
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
 * laid out as the two-column editor (08 §2.14). Activity is left out: there is no per-store activity data yet.
 */
export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, updateClient, plans, subscriptions, loading, error, refetch } = useClients();
  // Read through the provider so the page re-renders when the server settings arrive.
  const { settings } = usePlatformSettings();
  const { can } = useAuth();
  const [action, setAction] = useState<StoreAction | null>(null);
  // Client-side mirror of the backend guard (review C-M5): the server still decides.
  const canManage = can(PLATFORM_PERMISSIONS.TENANTS_MANAGE);
  const canImpersonate = can(PLATFORM_PERMISSIONS.TENANTS_IMPERSONATE);
  const canManageBilling = can(PLATFORM_PERMISSIONS.BILLING_MANAGE);

  const client = id ? getClient(id) : undefined;
  const defaultGracePeriodDays = settings.gracePeriodDays;

  const plan = useMemo(
    () => (client ? plans.find((p) => p.name === client.plan) : undefined),
    [client, plans],
  );

  const subscription = useMemo(
    () => (client ? findLatestSubscription(subscriptions, client.id) : undefined),
    [client, subscriptions],
  );

  if (!id) {
    return <Navigate to="/stores" replace />;
  }

  // Deep links land here before `platformTenants` has answered: wait, don't say "not found".
  if (!client && loading) {
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
  const isSuspended = client.status === "suspended";

  // The save is fire-and-forget for the form; a failure still has to be seen (review C-L6).
  const onSaveGracePeriod = (days: number | undefined) =>
    updateClient(client.id, { gracePeriodDays: days }).catch((error: unknown) => {
      const message = mutationFailureCopy(error);
      if (message) toastError(message);
    });

  const onMenuAction = (key: Key) => {
    if (key === "suspend" || key === "reactivate" || key === "delete") setAction(key);
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
                <DropdownSection showDivider aria-label="Store">
                  <DropdownItem key={isSuspended ? "reactivate" : "suspend"}>
                    {isSuspended ? "Reactivate store" : "Suspend store"}
                  </DropdownItem>
                </DropdownSection>
                <DropdownSection aria-label="Danger">
                  <DropdownItem key="delete" className={menuItemDangerClasses}>
                    Delete store
                  </DropdownItem>
                </DropdownSection>
              </DropdownMenu>
            </Dropdown>
            ) : null}
            {canImpersonate ? (
              <UiButton variant="primary" startIcon={<IconLogin aria-hidden />} onPress={() => void logInToStore(client)}>
                Log in
              </UiButton>
            ) : null}
          </>
        }
      />

      {/* Two-column editor (docs/design/08-fixes-and-screens.md §2.14): the work on the left, the facts and
          the per-store controls in a sticky rail on the right, danger zone last. One page, no tabs. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <OnboardingCard client={client} />
          <ClientOverviewTab part="main" client={client} subscription={subscription} plan={plan} />
          <ClientBillingTab
            part="main"
            client={client}
            subscription={subscription}
            defaultGracePeriodDays={defaultGracePeriodDays}
            onSaveGracePeriod={onSaveGracePeriod}
            canEdit={canManage}
          />
          {canManageBilling ? (
            <Section id="store-subscription" title="Subscription">
              <SubscriptionActions client={client} subscription={subscription} plans={plans} />
            </Section>
          ) : null}
        </div>

        <aside
          aria-label="Store details"
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto lg:custom-scroll"
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
          {canManage ? (
            <Section id="store-settings" title="Danger zone">
              <ClientDangerZone client={client} onDeleted={() => navigate("/stores")} />
            </Section>
          ) : null}
        </aside>
      </div>

      <StoreActionDialog
        client={client}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() => navigate("/stores")}
      />
    </div>
  );
}
