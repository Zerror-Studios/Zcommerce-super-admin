import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { isOverdue, isUnpaid } from "../../lib/store-table.util";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { PageHeader } from "../common/PageHeader";
import { ClientsTable } from "./ClientsTable";
import { IconAdd, IconStore } from "../ui/icons";
import { Button as UiButton, ErrorState, cx, formatCount, toneTextClasses } from "../ui";

export interface ClientsPageContentProps {
  clients: Client[];
}

/**
 * Stores page (docs/design/04-super-admin.md §3.3, header A in 09 §2): tinted teal header with the count and a
 * live line, primary "Add store", then the shared stores table with its state in the URL.
 */
export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  const navigate = useNavigate();
  const { loading, error, refetch, totalCount, subscriptions } = useClients();
  const { can } = useAuth();

  const summary = useMemo(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    let live = 0;
    let unpaid = 0;
    let overdue = 0;
    clients.forEach((client) => {
      const sub = byClient.get(client.id);
      if (client.status === "active") live += 1;
      if (isUnpaid(sub)) unpaid += 1;
      if (isOverdue(sub)) overdue += 1;
    });
    return `${formatCount(live)} live · ${formatCount(unpaid)} unpaid · ${formatCount(overdue)} overdue`;
  }, [clients, subscriptions]);

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconStore aria-hidden />}
        section="teal"
        title="Stores"
        count={clients.length}
        description={loading ? "Every store on the Zcom platform and its plan" : summary}
        actions={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </UiButton>
          ) : undefined
        }
      />

      {/* The list reads one page of 200; say so when the platform has outgrown it (review C-L9). */}
      {!error && totalCount > clients.length ? (
        <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
          Showing the first {clients.length} of {totalCount} stores. Search covers only the stores shown.
        </p>
      ) : null}

      {error ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable clients={clients} isLoading={loading} allowColumnChoice syncUrl />
      )}
    </div>
  );
}
