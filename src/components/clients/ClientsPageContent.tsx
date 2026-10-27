import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { isOverdue, isUnpaid } from "../../lib/store-table.util";
import { storeLifecycleEnum, storeLifecycleKey } from "../../lib/storeStatus";
import { latestSubscriptionByClient } from "../../lib/subscription-lookup.util";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { PageHeader } from "../common/PageHeader";
import { ClientsTable } from "./ClientsTable";
import { RemovedStoresPanel } from "./RemovedStoresPanel";
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
  const { loading, loadingMore, incomplete, pageGuardReached, loadRemaining, error, refetch, totalCount, subscriptions } =
    useClients();
  const { can } = useAuth();

  const summary = useMemo(() => {
    const byClient = latestSubscriptionByClient(subscriptions);
    let live = 0;
    let unpaid = 0;
    let overdue = 0;
    clients.forEach((client) => {
      const sub = byClient.get(client.id);
      if (storeLifecycleKey(client) === storeLifecycleEnum.LIVE) live += 1;
      if (isUnpaid(sub)) unpaid += 1;
      if (isOverdue(sub)) overdue += 1;
    });
    const line = `${formatCount(live)} live · ${formatCount(unpaid)} unpaid · ${formatCount(overdue)} overdue`;
    // PRD-024 FR-1.6 (B-06): these are counted from the loaded rows; say so until every store is loaded.
    return clients.length < totalCount ? `${line} in ${formatCount(clients.length)} loaded stores` : line;
  }, [clients, subscriptions, totalCount]);

  return (
    <div>
      <PageHeader
        type="list"
        icon={<IconStore aria-hidden />}
        section="teal"
        title="Stores"
        count={totalCount}
        description={loading ? "Every store on the Zcom platform and its plan" : summary}
        actions={
          can(PLATFORM_PERMISSIONS.TENANTS_MANAGE) ? (
            <UiButton variant="primary" startIcon={<IconAdd aria-hidden />} onPress={() => navigate("/stores/new")}>
              Add store
            </UiButton>
          ) : undefined
        }
      />

      {/* Pages of 100 load one after another (FE-09); say so while they do, or if one failed. */}
      {!error && loadingMore ? (
        <p role="status" className="mb-3 text-label text-fg-muted">
          Loading stores… {clients.length} of {totalCount}.
        </p>
      ) : null}
      {incomplete ? (
        <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
          {/* W2V2-06: at the 5,000-row guard the button reads on instead of retrying nothing. */}
          {pageGuardReached
            ? `Showing the first ${clients.length} of ${totalCount} stores; the console reads them 5,000 at a time.`
            : `Showing ${clients.length} of ${totalCount} stores; the rest couldn't be loaded.`}{" "}
          <button type="button" className="underline" onClick={loadRemaining}>
            {pageGuardReached ? "Load the next 5,000" : "Retry"}
          </button>
        </p>
      ) : null}

      {error ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable clients={clients} isLoading={loading} allowColumnChoice syncUrl />
      )}

      {/* PRD-018 FR-2.3, FR-2.5: deleted (restorable) and purged stores. */}
      <div className="mt-8">
        <RemovedStoresPanel />
      </div>
    </div>
  );
}
