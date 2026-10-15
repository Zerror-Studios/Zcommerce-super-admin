import { CardWrapper } from "../ui/CardWrapper";
import { addToast, Skeleton, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Client, Subscription } from "../../types";
import { subscriptions } from "../../lib/mockData";
import {
  formatNumber,
} from "../../lib/utils";
import { ConfirmModal } from "../common/ConfirmModal";
import { dataTableClassNames } from "../common/dataTableStyles";
import { NoDataPlaceholder } from "../common/NoDataPlaceholder";
import { StatusChip } from "../common/StatusChip";
import { StoreHealthCell } from "../common/StoreHealthCell";
import { RenewalBadge } from "../common/RenewalBadge";
import { IconLogin } from "../ui/icons";
import { Button as UiButton } from "../ui";

export interface TopClientsTableProps {
  clients: Client[];
  isLoading?: boolean;
}

const columns = [
  { key: "storeName", label: "Store" },
  { key: "plan", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "storeHealth", label: "Store Health" },
  { key: "renewalDate", label: "Renewal / Due" },
  { key: "mrr", label: "MRR (₹)" },
  { key: "actions", label: "Actions" },
] as const;

export function TopClientsTable({ clients, isLoading }: TopClientsTableProps) {
  const navigate = useNavigate();
  const [loginClient, setLoginClient] = useState<Client | null>(null);

  const subscriptionByClientId = useMemo(() => {
    const map = new Map<string, Subscription>();
    subscriptions.forEach((sub) => map.set(sub.clientId, sub));
    return map;
  }, []);

  const topClients = useMemo(
    () =>
      [...clients]
        .filter((c) => c.status !== "suspended")
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    [clients],
  );

  const renderCell = (client: Client, key: string) => {
    const subscription = subscriptionByClientId.get(client.id);

    switch (key) {
      case "storeName":
        return (
          <div>
            <p className="font-medium text-foreground">{client.storeName}</p>
            <p className="text-caption text-default-400">{client.ownerEmail}</p>
          </div>
        );
      case "plan":
        return <StatusChip kind="plan" value={client.plan} />;
      case "status":
        return <StatusChip kind="client" value={client.status} />;
      case "storeHealth":
        return (
          <StoreHealthCell client={client} subscription={subscription} />
        );
      case "renewalDate":
        return <RenewalBadge subscription={subscription} />;
      case "mrr":
        return <span className="font-medium">{formatNumber(client.mrr)}</span>;
      case "actions":
        return (
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <UiButton
              variant="outline"
              size="sm"
              startIcon={<IconLogin size={14} strokeWidth={2.5} />}
              onPress={() => setLoginClient(client)}
            >
              Login
            </UiButton>
          </div>
        );
      default:
        return "—";
    }
  };

  return (
    <CardWrapper title="Top performing clients" description="Ranked by lifetime platform revenue" bodyClassName="p-0" className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table
            aria-label="Top performing clients"
            removeWrapper
            classNames={{
              ...dataTableClassNames,
              base: "rounded-none border-0 border-t border-default-200 overflow-hidden bg-surface",
            }}
          >
            <TableHeader columns={[...columns]}>
              {(column) =>
                column.key === "actions" ? (
                  <TableColumn key="actions" align="end">
                    {column.label}
                  </TableColumn>
                ) : (
                  <TableColumn key={column.key}>{column.label}</TableColumn>
                )
              }
            </TableHeader>
            <TableBody
              items={topClients}
              emptyContent={
                <NoDataPlaceholder
                  title="No clients found"
                  description="Top performing clients will appear here."
                  iconHeight={90}
                />
              }
            >
              {(client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-default-50"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  {(columnKey) => (
                    <TableCell>{renderCell(client, String(columnKey))}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

      <ConfirmModal
        isOpen={loginClient !== null}
        onClose={() => setLoginClient(null)}
        title={loginClient ? `Login as ${loginClient.storeName}?` : ""}
        description="This would open an impersonation session in production. In this demo, only a toast is shown."
        confirmLabel="Continue"
        confirmColor="primary"
        onConfirm={() => {
          if (!loginClient) return;
          addToast({
            title: "Impersonation started (demo)",
            description: `You would now be logged in as ${loginClient.ownerEmail}.`,
            color: "primary",
          });
          setLoginClient(null);
        }}
      />
    </CardWrapper>
  );
}
