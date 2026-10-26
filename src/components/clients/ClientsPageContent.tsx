import { useNavigate, useSearchParams } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { PageHeader } from "../common/PageHeader";
import { ClientsTable, type StoreTab } from "./ClientsTable";
import { RemovedStoresPanel } from "./RemovedStoresPanel";
import { IconAdd } from "../ui/icons";
import { Button as UiButton, ErrorState, cx, toneTextClasses } from "../ui";

export interface ClientsPageContentProps {
  clients: Client[];
}

const storeTabs: StoreTab[] = ["all", "live", "trial", "unpaid", "suspended"];

/** Stores page (docs/design/04-super-admin.md §3.3): "Stores" + count, primary "Add store", the shared stores table. */
export function ClientsPageContent({ clients }: ClientsPageContentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, loadingMore, incomplete, pageGuardReached, loadRemaining, error, refetch, totalCount } = useClients();
  const { can } = useAuth();

  // Home's "Needs attention" links here with ?status=… to open a tab.
  const requested = searchParams.get("status");
  const initialTab = storeTabs.find((tab) => tab === requested) ?? "all";

  return (
    <div>
      <PageHeader
        title="Stores"
        count={clients.length}
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
        <ClientsTable key={initialTab} clients={clients} isLoading={loading} allowColumnChoice initialTab={initialTab} />
      )}

      {/* PRD-018 FR-2.3, FR-2.5: deleted (restorable) and purged stores. */}
      <div className="mt-8">
        <RemovedStoresPanel />
      </div>
    </div>
  );
}
