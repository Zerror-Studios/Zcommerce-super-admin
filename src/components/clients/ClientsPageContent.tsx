import { useNavigate, useSearchParams } from "react-router-dom";
import type { Client } from "../../types";
import { toasts } from "../../copy";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { useAuth } from "../../providers/AuthProvider";
import { useClients } from "../../providers/ClientsProvider";
import { PageHeader } from "../common/PageHeader";
import { ClientsTable, type StoreTab } from "./ClientsTable";
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
  const { loading, error, refetch, totalCount } = useClients();
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

      {/* The list reads one page of 200; say so when the platform has outgrown it (review C-L9). */}
      {!error && totalCount > clients.length ? (
        <p role="status" className={cx("mb-3 text-label", toneTextClasses.warning)}>
          Showing the first {clients.length} of {totalCount} stores. Search covers only the stores shown.
        </p>
      ) : null}

      {error ? (
        <ErrorState title="Couldn't load the stores." description={toasts.genericError} onRetry={() => void refetch()} />
      ) : (
        <ClientsTable key={initialTab} clients={clients} isLoading={loading} allowColumnChoice initialTab={initialTab} />
      )}
    </div>
  );
}
