import { addToast, Card, CardBody } from "@heroui/react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ClientBillingTab } from "../components/clients/ClientBillingTab";
import { ClientDangerZone } from "../components/clients/ClientDangerZone";
import { ClientOverviewTab } from "../components/clients/ClientOverviewTab";
import { ClientUsageTab } from "../components/clients/ClientUsageTab";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { PageHeader } from "../components/common/PageHeader";
import { StatusChip } from "../components/common/StatusChip";
import { plans, subscriptions, transactions } from "../lib/mockData";
import { loadPlatformSettings } from "../lib/platformSettings";
import { useClients } from "../providers/ClientsProvider";
import { IconLogin } from "../components/ui/icons";
import { Button as UiButton } from "../components/ui";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, updateClient, setClientStatus, deleteClient } = useClients();
  const [loginOpen, setLoginOpen] = useState(false);

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
    return <Navigate to="/clients" replace />;
  }

  if (!client) {
    return (
      <div>
        <PageHeader
          title="Client not found"
          description="This client may have been deleted or the link is invalid."
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Clients", href: "/clients" },
            { label: "Not found" },
          ]}
        />
        <Card shadow="none" className="border border-line bg-surface">
          <CardBody className="items-center gap-3 py-16 text-center">
            <p className="text-default-500">No client with id “{id}”.</p>
            <UiButton variant="outline" onPress={() => navigate("/clients")}>
              Back to clients
            </UiButton>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={client.storeName}
        description={`${client.ownerName} · ${client.ownerEmail}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Clients", href: "/clients" },
          { label: client.storeName },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip kind="plan" value={client.plan} />
            <StatusChip kind="client" value={client.status} />
            <UiButton
              variant="primary"
              size="sm"
              startIcon={<IconLogin size={14} strokeWidth={2.5} />}
              onPress={() => setLoginOpen(true)}
            >
              Login as client
            </UiButton>
          </div>
        }
      />

      <div className="space-y-6">
        <ClientOverviewTab client={client} subscription={subscription} />
        <ClientBillingTab
          client={client}
          transactions={clientTransactions}
          defaultGracePeriodDays={defaultGracePeriodDays}
          onSaveGracePeriod={(days) =>
            updateClient(client.id, { gracePeriodDays: days })
          }
        />
        <ClientUsageTab client={client} plan={plan} />
        <ClientDangerZone
          client={client}
          onStatusChange={(status) => setClientStatus(client.id, status)}
          onDelete={() => {
            deleteClient(client.id);
            navigate("/clients");
          }}
        />
      </div>

      <ConfirmModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        title={`Login as ${client.storeName}?`}
        description="This would open an impersonation session in production. In this demo, only a toast is shown."
        confirmLabel="Continue"
        confirmColor="primary"
        onConfirm={() =>
          addToast({
            title: "Impersonation started (demo)",
            description: `You would now be logged in as ${client.ownerEmail}.`,
            color: "primary",
          })
        }
      />
    </div>
  );
}
