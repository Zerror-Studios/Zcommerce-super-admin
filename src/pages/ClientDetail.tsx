import { useMemo, useState, type Key, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClientBillingTab } from "../components/clients/ClientBillingTab";
import { ClientDangerZone } from "../components/clients/ClientDangerZone";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { StoreActionDialog, type StoreAction } from "../components/clients/storeActions";
import { logInToStore } from "../components/clients/storeLogin";
import { PageHeader } from "../components/common/PageHeader";
import { plans, subscriptions, transactions } from "../lib/mockData";
import { loadPlatformSettings } from "../lib/platformSettings";
import { graceDaysFor, paymentState, storeLifecycle } from "../lib/storeStatus";
import { useClients } from "../providers/ClientsProvider";
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
  IconButton,
  menuItemDangerClasses,
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
 * Store detail (docs/design/04-super-admin.md §3.4): one page, no tabs (owner's request 2026-10-16).
 * Overview, then Billing, then store settings. Activity is left out: there is no per-store activity data yet.
 */
export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, updateClient } = useClients();
  const [action, setAction] = useState<StoreAction | null>(null);

  const client = id ? getClient(id) : undefined;
  const defaultGracePeriodDays = loadPlatformSettings().gracePeriodDays;

  const plan = useMemo(
    () => (client ? plans.find((p) => p.name === client.plan) : undefined),
    [client],
  );

  const subscription = useMemo(
    () => (client ? subscriptions.find((s) => s.clientId === client.id) : undefined),
    [client],
  );

  const clientTransactions = useMemo(
    () => (client ? transactions.filter((t) => t.clientId === client.id) : []),
    [client],
  );

  if (!id) {
    return <Navigate to="/stores" replace />;
  }

  if (!client) {
    return (
      <div>
        <PageHeader back={{ href: "/stores", label: "Stores" }} title="Store not found" />
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
  const payment = paymentState(
    subscription,
    transactions,
    graceDaysFor(client, defaultGracePeriodDays),
    new Date(),
  );
  const isSuspended = client.status === "suspended";

  const onMenuAction = (key: Key) => {
    if (key === "suspend" || key === "reactivate" || key === "delete") setAction(key);
  };

  return (
    <div>
      <PageHeader
        back={{ href: "/stores", label: "Stores" }}
        title={client.storeName}
        badges={
          <>
            <Chip tone={lifecycle.tone}>{lifecycle.label}</Chip>
            <Chip tone={payment.tone}>{payment.label}</Chip>
          </>
        }
        description={`${client.ownerName} · ${client.ownerEmail}`}
        actions={
          <>
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
            <UiButton variant="primary" startIcon={<IconLogin aria-hidden />} onPress={() => logInToStore(client)}>
              Log in
            </UiButton>
          </>
        }
      />

      <div className="space-y-8">
        <ClientOverviewTab client={client} subscription={subscription} plan={plan} />

        <Section id="store-billing" title="Billing">
          <ClientBillingTab
            client={client}
            subscription={subscription}
            transactions={clientTransactions}
            defaultGracePeriodDays={defaultGracePeriodDays}
            onSaveGracePeriod={(days) => updateClient(client.id, { gracePeriodDays: days })}
          />
        </Section>

        <Section id="store-settings" title="Store settings">
          <ClientDangerZone client={client} onDeleted={() => navigate("/stores")} />
        </Section>
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
